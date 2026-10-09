using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Mime;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Data.Enums;
using Jellyfin.Plugin.JellioDirect.Helpers;
using Jellyfin.Plugin.JellioDirect.Models;
using Jellyfin.Plugin.JellioDirect.Services;
using MediaBrowser.Controller.Dto;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.JellioDirect.Controllers;

[ApiController]
[ConfigAuthorize]
[Route("jelliodirect/{config}")]
[Produces(MediaTypeNames.Application.Json)]
public class AddonController : ControllerBase
{
    private const string TranscodingModeAdaptive = "adaptive";
    private const string TranscodingModeForce = "force";
    private const string TranscodingModeDisabled = "disabled";

    internal const string StreamDeliveryDirect = "direct";
    internal const string StreamDeliveryHls = "hls";
    internal const string StreamDeliveryBoth = "both";

    private static readonly string PluginVersion =
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.0.0";

    private readonly IUserManager _userManager;
    private readonly IUserViewManager _userViewManager;
    private readonly IDtoService _dtoService;
    private readonly ILibraryManager _libraryManager;
    private static readonly HttpClient _httpClient = new();

    public AddonController(
        IUserManager userManager,
        IUserViewManager userViewManager,
        IDtoService dtoService,
        ILibraryManager libraryManager
    )
    {
        _userManager = userManager;
        _userViewManager = userViewManager;
        _dtoService = dtoService;
        _libraryManager = libraryManager;
    }

    private async Task<string?> GetTitleFromCinemeta(string imdbId, string type)
    {
        try
        {
            var stremioType = type == "movie" ? "movie" : "series";
            var response = await _httpClient.GetAsync($"https://v3-cinemeta.strem.io/meta/{stremioType}/tt{imdbId}.json");
            if (response.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(await response.Content.ReadAsStreamAsync());
                if (doc.RootElement.TryGetProperty("meta", out var meta) &&
                    meta.TryGetProperty("name", out var name))
                {
                    return name.GetString();
                }
            }
        }
        catch
        {
            // If Cinemeta fails, we'll just return null
        }

        return null;
    }

    private async Task<IActionResult> GetJellyseerrFallbackStream(
        ConfigModel config, string imdbId, string type, int? season = null, int? episode = null)
    {
        if (!config.JellyseerrEnabled || string.IsNullOrWhiteSpace(config.JellyseerrUrl))
            return Ok(new { streams = Array.Empty<object>() });

        var title = await GetTitleFromCinemeta(imdbId, type);

        using var client = JellyseerrHttpClient.Create(config.JellyseerrUrl, config.JellyseerrApiKey);
        var tmdbId = await JellyseerrStatusService.GetTmdbId(client, imdbId, type, title);

        LogBuffer.AddLog($"[Jellyseerr] IMDB tt{imdbId} -> TMDB {tmdbId?.ToString(CultureInfo.InvariantCulture) ?? "null"}", LogLevel.Info);

        if (tmdbId is null)
        {
            return ReturnJellyseerrRequestStream(config, imdbId, type, title, season, episode);
        }

        var status = await JellyseerrStatusService.GetMediaStatus(client, tmdbId.Value, type);
        LogBuffer.AddLog($"[Jellyseerr] Media status for TMDB {tmdbId}: {status}", LogLevel.Info);

        return status switch
        {
            "available" => await HandleJellyseerrAvailable(config, imdbId, type, tmdbId.Value, season, episode),
            "processing" => ReturnStatusStream("🔄 Downloading — tap to refresh", "Content is being downloaded"),
            "pending" or "partially_available" => ReturnStatusStream("📥 Requested — waiting for download", "Request approved, download pending"),
            _ => ReturnJellyseerrRequestStream(config, imdbId, type, title, season, episode),
        };
    }

    private async Task<IActionResult> HandleJellyseerrAvailable(
        ConfigModel config, string imdbId, string type, int tmdbId, int? season, int? episode)
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;
        var user = _userManager.GetUserById(userId);
        if (user == null)
            return Unauthorized();

        if (type == "movie")
        {
            var query = new InternalItemsQuery(user)
            {
                HasAnyProviderId = new Dictionary<string, string> { ["Imdb"] = $"tt{imdbId}" },
                IncludeItemTypes = [BaseItemKind.Movie],
            };
            var items = _libraryManager.GetItemList(query);
            if (items.Count > 0)
                return GetStreamsResult(userId, items, config.AuthToken, config.PublicBaseUrl);
        }
        else
        {
            var seriesQuery = new InternalItemsQuery(user)
            {
                IncludeItemTypes = [BaseItemKind.Series],
                HasAnyProviderId = new Dictionary<string, string> { ["Imdb"] = $"tt{imdbId}" },
            };
            var seriesItems = _libraryManager.GetItemList(seriesQuery);
            if (seriesItems.Count > 0 && season.HasValue && episode.HasValue)
            {
                var seriesIds = seriesItems.Select(s => s.Id).ToArray();
                var episodeQuery = new InternalItemsQuery(user)
                {
                    IncludeItemTypes = [BaseItemKind.Episode],
                    AncestorIds = seriesIds,
                    ParentIndexNumber = season.Value,
                    IndexNumber = episode.Value,
                };
                var episodeItems = _libraryManager.GetItemList(episodeQuery);
                if (episodeItems.Count > 0)
                    return GetStreamsResult(userId, episodeItems, config.AuthToken, config.PublicBaseUrl);
            }
        }

        return ReturnStatusStream("✅ Available — processing in Jellyfin", "Content downloaded, waiting for library scan");
    }

    private IActionResult ReturnJellyseerrRequestStream(
        ConfigModel config, string imdbId, string type, string? title, int? season, int? episode)
    {
        if (string.IsNullOrWhiteSpace(title))
            return Ok(new { streams = Array.Empty<object>() });

        var baseUrl = GetBaseUrl(config.PublicBaseUrl);
        var configStr = Request.RouteValues["config"]?.ToString() ?? "";
        var url = $"{baseUrl}/jelliodirect/{configStr}/jellyseerr?type={type}&imdbId=tt{imdbId}&title={Uri.EscapeDataString(title)}";
        if (season.HasValue)
            url += $"&season={season.Value}";
        if (episode.HasValue)
            url += $"&episode={episode.Value}";

        var streams = new[] { new { url, name = "📥 Request via Jellyseerr", description = "Click to send request to Jellyseerr" } };
        return Ok(new { streams });
    }

    private IActionResult ReturnStatusStream(string name, string description)
    {
        var streams = new[] { new { url = "#", name, description } };
        return Ok(new { streams });
    }

    private string GetBaseUrl(string? overrideBaseUrl = null)
    {
        if (!string.IsNullOrWhiteSpace(overrideBaseUrl))
        {
            return overrideBaseUrl!.TrimEnd('/');
        }

        return $"{Request.Scheme}://{Request.Host}{Request.PathBase}";
    }

    private static string GetAudioStreamLabel(MediaStream? audioStream)
    {
        if (audioStream == null)
        {
            return "Default audio";
        }

        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(audioStream.Language))
        {
            parts.Add(audioStream.Language);
        }

        if (!string.IsNullOrWhiteSpace(audioStream.Title))
        {
            parts.Add(audioStream.Title);
        }

        if (!string.IsNullOrWhiteSpace(audioStream.Codec))
        {
            parts.Add(audioStream.Codec.ToUpperInvariant());
        }

        if (audioStream.Channels.HasValue)
        {
            parts.Add(audioStream.Channels.Value == 6 ? "5.1" : $"{audioStream.Channels.Value} ch");
        }

        if (audioStream.IsDefault)
        {
            parts.Add("Default");
        }

        return parts.Count == 0 ? $"Audio track {audioStream.Index}" : string.Join(" - ", parts);
    }

    private static string NormalizeVideoTranscodingMode(
        string? mode,
        bool forceTranscodeVideo,
        bool enableDirectStreaming)
    {
        if (IsSupportedTranscodingMode(mode))
        {
            return mode!;
        }

        return forceTranscodeVideo || !enableDirectStreaming
            ? TranscodingModeForce
            : TranscodingModeAdaptive;
    }

    private static string NormalizeAudioTranscodingMode(string? mode, bool forceTranscodeAudio)
    {
        if (IsSupportedTranscodingMode(mode))
        {
            return mode!;
        }

        return forceTranscodeAudio ? TranscodingModeForce : TranscodingModeAdaptive;
    }

    private static bool IsSupportedTranscodingMode(string? mode)
    {
        return mode is TranscodingModeAdaptive or TranscodingModeForce or TranscodingModeDisabled;
    }

    internal static string NormalizeStreamDeliveryMode(string? mode)
    {
        return mode is StreamDeliveryDirect or StreamDeliveryHls or StreamDeliveryBoth
            ? mode
            : StreamDeliveryBoth;
    }

    internal const int DefaultMaxVideoHeight = 2160;

    internal static int NormalizeMaxVideoHeight(int height)
    {
        return height is 2160 or 1440 or 1080 or 720 ? height : DefaultMaxVideoHeight;
    }

    // 16:9 width for the height; Jellyfin keeps the aspect ratio within both limits.
    internal static int MaxVideoWidthFor(int maxVideoHeight)
    {
        return maxVideoHeight * 16 / 9;
    }

    // HLS through master.m3u8 always runs Jellyfin's transcode pipeline. With both video and audio
    // transcoding disabled there is nothing for it to do, so serve the original file instead.
    internal static bool ShouldIncludeHlsStreams(
        string streamDeliveryMode,
        string videoTranscodingMode,
        string audioTranscodingMode)
    {
        var transcodingDisabled = videoTranscodingMode == TranscodingModeDisabled
            && audioTranscodingMode == TranscodingModeDisabled;
        return streamDeliveryMode != StreamDeliveryDirect && !transcodingDisabled;
    }

    internal static bool ShouldIncludeDirectStream(
        string streamDeliveryMode,
        string videoTranscodingMode,
        string audioTranscodingMode)
    {
        return streamDeliveryMode != StreamDeliveryHls
            || !ShouldIncludeHlsStreams(streamDeliveryMode, videoTranscodingMode, audioTranscodingMode);
    }

    // Original file over plain HTTP (range requests, no ffmpeg). Carries every audio and embedded
    // subtitle track, so one entry per media source is enough. Both api_key and ApiKey are sent
    // because newer Jellyfin builds can turn off the legacy api_key parameter.
    internal static string BuildDirectStreamUrl(string baseUrl, Guid itemId, string mediaSourceId, string authToken)
    {
        var query = QueryString.Create(new Dictionary<string, string?>
        {
            ["static"] = "true",
            ["mediaSourceId"] = mediaSourceId,
            ["ApiKey"] = authToken,
            ["api_key"] = authToken,
        });
        return $"{baseUrl}/Videos/{itemId}/stream{query}";
    }

    // The direct entry plays the original file, which already carries its embedded tracks. Listing
    // them again shows every track twice in the player and makes Jellyfin extract them for nothing.
    // Subtitle files next to the video are not in the file, so those are still listed.
    internal static List<SubtitleDto> SubtitlesForDirectStream(
        IReadOnlyList<MediaStream> subtitleStreams,
        IReadOnlyList<SubtitleDto> subtitles)
    {
        return subtitleStreams.Zip(subtitles)
            .Where(pair => pair.First.IsExternal)
            .Select(pair => pair.Second)
            .ToList();
    }

    internal static List<MediaStream> GetTextSubtitleStreams(MediaSourceInfo source)
    {
        return source.MediaStreams
            .Where(stream => stream.Type == MediaStreamType.Subtitle && stream.IsTextSubtitleStream)
            .OrderByDescending(stream => stream.IsDefault)
            .ThenByDescending(stream => stream.IsForced)
            .ThenBy(stream => stream.Index)
            .ToList();
    }

    internal static SubtitleDto ToSubtitleDto(
        MediaStream sub,
        Guid itemId,
        string mediaSourceId,
        string baseUrl,
        string authToken)
    {
        var format = sub.Codec switch
        {
            "subrip" => "srt",
            "ass" => "ass",
            "webvtt" => "vtt",
            _ => "srt",
        };
        // A bare language code lets clients show a proper language name; the
        // track title (e.g. "SDH") rides along in the optional label.
        return new SubtitleDto
        {
            Id = $"jelliopp-{itemId}-{sub.Index}",
            Url = BuildSubtitleUrl(baseUrl, itemId, mediaSourceId, sub.Index, format, authToken),
            Lang = string.IsNullOrEmpty(sub.Language) ? "und" : sub.Language,
            Label = string.IsNullOrEmpty(sub.Title) ? null : sub.Title,
        };
    }

    // Stremio's subtitles request carries the playing file's name and size (from the stream's
    // behaviorHints) in the extra segment, e.g. "filename=Dune.mkv&videoSize=123&videoHash=abc".
    internal static (string? Filename, long? VideoSize) ParseSubtitleExtra(string? extra)
    {
        if (string.IsNullOrEmpty(extra))
        {
            return (null, null);
        }

        string? filename = null;
        long? videoSize = null;
        foreach (var part in extra.Split('&'))
        {
            var separator = part.IndexOf('=', StringComparison.Ordinal);
            if (separator <= 0)
            {
                continue;
            }

            var name = part[..separator];
            var value = Uri.UnescapeDataString(part[(separator + 1)..]);
            if (name == "filename")
            {
                filename = value;
            }
            else if (name == "videoSize" && long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var size))
            {
                videoSize = size;
            }
        }

        return (filename, videoSize);
    }

    // Only answer for our own files. The same movie played from another addon is a different
    // release, and Jellyfin's subtitles would be out of sync with it.
    internal static bool SourceMatchesPlayingFile(MediaSourceInfo source, string? filename, long? videoSize)
    {
        if (videoSize.HasValue && source.Size == videoSize)
        {
            return true;
        }

        return !string.IsNullOrEmpty(filename)
            && !string.IsNullOrEmpty(source.Path)
            && string.Equals(Path.GetFileName(source.Path), filename, StringComparison.OrdinalIgnoreCase);
    }

    internal static string BuildSubtitleUrl(
        string baseUrl,
        Guid itemId,
        string mediaSourceId,
        int streamIndex,
        string format,
        string authToken)
    {
        var token = Uri.EscapeDataString(authToken);
        return $"{baseUrl}/Videos/{itemId}/{mediaSourceId}/Subtitles/{streamIndex}/Stream.{format}?api_key={token}&ApiKey={token}";
    }

    private static string DescribeDirectSource(MediaSourceInfo source)
    {
        var video = source.MediaStreams.FirstOrDefault(stream => stream.Type == MediaStreamType.Video);
        var audioCount = source.MediaStreams.Count(stream => stream.Type == MediaStreamType.Audio);
        var parts = new List<string>();
        // Width, not height: scope 4K (3840x1600) is still 4K.
        var resolution = video?.Width switch
        {
            >= 3200 => "4K",
            >= 1900 => "1080p",
            >= 1200 => "720p",
            > 0 => $"{video?.Height}p",
            _ => null,
        };
        if (resolution != null)
        {
            parts.Add(resolution);
        }

        if (!string.IsNullOrEmpty(video?.Codec))
        {
            parts.Add(video.Codec.ToUpperInvariant());
        }

        if (source.Size is long size and > 0)
        {
            parts.Add(string.Create(CultureInfo.InvariantCulture, $"{size / 1_000_000_000d:0.0} GB"));
        }

        parts.Add(audioCount == 1 ? "1 audio track" : $"{audioCount} audio tracks");
        return string.Join(" · ", parts);
    }

    private static string DescribeVideoTarget(string mode)
    {
        return mode switch
        {
            TranscodingModeForce => "H.264 (forced transcode)",
            TranscodingModeDisabled => "Direct stream only",
            _ => "Adaptive direct stream/transcode",
        };
    }

    private static string DescribeAudioTarget(string mode)
    {
        return mode switch
        {
            TranscodingModeForce => "AAC (forced transcode)",
            TranscodingModeDisabled => "direct stream only",
            _ => "adaptive direct stream/transcode",
        };
    }

    internal static string[] GetVideoCodecs(MediaSourceInfo source, string videoTranscodingMode)
    {
        if (videoTranscodingMode == TranscodingModeForce)
        {
            return ["h264"];
        }

        return videoTranscodingMode == TranscodingModeAdaptive
            && ShouldForceAdaptiveAv1Transcode(source)
            ? ["h264"]
            : ["h264", "hevc", "av1"];
    }

    internal static string[] GetAudioCodecs(string audioTranscodingMode)
    {
        if (audioTranscodingMode == TranscodingModeForce)
        {
            return ["aac"];
        }

        return ["aac", "mp3", "ac3", "eac3", "flac", "opus"];
    }

    internal static bool ShouldEnableDirectPlayback(string videoTranscodingMode, string audioTranscodingMode)
    {
        return videoTranscodingMode != TranscodingModeForce
            && audioTranscodingMode != TranscodingModeForce;
    }

    internal static bool ShouldForceAdaptiveAv1Transcode(MediaSourceInfo source)
    {
        var videoStream = source.MediaStreams
            .FirstOrDefault(stream => stream.Type == MediaStreamType.Video);

        if (!IsAv1Codec(videoStream?.Codec))
        {
            return false;
        }

        return (videoStream?.Height ?? 0) > 1080
            || (videoStream?.Width ?? 0) > 1920;
    }

    private static bool IsAv1Codec(string? codec)
    {
        return string.Equals(codec, "av1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(codec, "av01", StringComparison.OrdinalIgnoreCase);
    }

    internal static string DescribeJellyfinStreamMode(
        MediaSourceInfo source,
        MediaStream? audioStream,
        string videoTranscodingMode,
        string audioTranscodingMode,
        int maxVideoBitrate,
        int maxVideoHeight = DefaultMaxVideoHeight)
    {
        var transcodeReasons = GetExpectedTranscodeReasons(
            source,
            audioStream,
            videoTranscodingMode,
            audioTranscodingMode,
            maxVideoBitrate,
            maxVideoHeight);

        if (transcodeReasons.Count > 0)
        {
            return $"Transcoding expected ({string.Join("; ", transcodeReasons)})";
        }

        var noTranscodeNotes = GetNoTranscodeNotes(source, audioStream, videoTranscodingMode, audioTranscodingMode);
        if (noTranscodeNotes.Count > 0)
        {
            return $"No transcoding requested ({string.Join("; ", noTranscodeNotes)})";
        }

        return "Direct stream/remux expected (no Jellyfin transcoding)";
    }

    private static List<string> GetExpectedTranscodeReasons(
        MediaSourceInfo source,
        MediaStream? audioStream,
        string videoTranscodingMode,
        string audioTranscodingMode,
        int maxVideoBitrate,
        int maxVideoHeight)
    {
        var reasons = new List<string>();
        var videoStream = source.MediaStreams
            .FirstOrDefault(stream => stream.Type == MediaStreamType.Video);

        if (videoTranscodingMode == TranscodingModeForce)
        {
            reasons.Add("video forced to H.264");
        }
        else if (videoTranscodingMode == TranscodingModeAdaptive)
        {
            if (ShouldForceAdaptiveAv1Transcode(source))
            {
                reasons.Add("video 4K AV1 forced to H.264");
            }
            else if (!IsCodecAllowed(videoStream?.Codec, GetVideoCodecs(source, videoTranscodingMode)))
            {
                reasons.Add($"video codec {FormatCodec(videoStream?.Codec)} is not in the allowed copy list");
            }
            else if (source.Bitrate.HasValue && source.Bitrate.Value > maxVideoBitrate * 1000000)
            {
                reasons.Add($"source bitrate {FormatBitrate(source.Bitrate.Value)} exceeds max {maxVideoBitrate} Mbps");
            }
            else if (videoStream?.Height > maxVideoHeight)
            {
                reasons.Add($"video height {videoStream.Height}p exceeds max {maxVideoHeight}p");
            }
        }

        if (audioTranscodingMode == TranscodingModeForce)
        {
            reasons.Add("audio forced to AAC");
        }
        else if (audioTranscodingMode == TranscodingModeAdaptive
            && audioStream != null
            && !IsCodecAllowed(audioStream.Codec, GetAudioCodecs(audioTranscodingMode)))
        {
            reasons.Add($"audio codec {FormatCodec(audioStream.Codec)} is not in the allowed copy list");
        }

        return reasons;
    }

    private static List<string> GetNoTranscodeNotes(
        MediaSourceInfo source,
        MediaStream? audioStream,
        string videoTranscodingMode,
        string audioTranscodingMode)
    {
        var notes = new List<string>();
        var videoStream = source.MediaStreams
            .FirstOrDefault(stream => stream.Type == MediaStreamType.Video);

        if (videoTranscodingMode == TranscodingModeDisabled
            && !IsCodecAllowed(videoStream?.Codec, GetVideoCodecs(source, videoTranscodingMode)))
        {
            notes.Add($"video transcoding disabled; unsupported codec {FormatCodec(videoStream?.Codec)} may fail");
        }

        if (audioTranscodingMode == TranscodingModeDisabled
            && audioStream != null
            && !IsCodecAllowed(audioStream.Codec, GetAudioCodecs(audioTranscodingMode)))
        {
            notes.Add($"audio transcoding disabled; unsupported codec {FormatCodec(audioStream.Codec)} may fail");
        }

        return notes;
    }

    private static bool IsCodecAllowed(string? codec, IEnumerable<string> allowedCodecs)
    {
        if (string.IsNullOrWhiteSpace(codec))
        {
            return true;
        }

        var normalizedCodec = NormalizeCodec(codec);
        return allowedCodecs.Any(allowedCodec => NormalizeCodec(allowedCodec) == normalizedCodec);
    }

    private static string NormalizeCodec(string codec)
    {
        return codec.Trim().ToLowerInvariant() switch
        {
            "avc" or "avc1" => "h264",
            "h265" or "hev1" or "hvc1" => "hevc",
            "av01" => "av1",
            "mp4a" => "aac",
            _ => codec.Trim().ToLowerInvariant(),
        };
    }

    private static string FormatCodec(string? codec)
    {
        return string.IsNullOrWhiteSpace(codec) ? "unknown" : codec;
    }

    private static string FormatBitrate(int bitrate)
    {
        return (bitrate / 1000000D).ToString("0.##", CultureInfo.InvariantCulture) + " Mbps";
    }

    internal static MetaDto MapToMeta(
        BaseItemDto dto,
        StremioType stremioType,
        string baseUrl,
        bool includeDetails = false
    )
    {
        string? releaseInfo = null;
        if (dto.PremiereDate.HasValue)
        {
            var premiereYear = dto.PremiereDate.Value.Year.ToString(CultureInfo.InvariantCulture);
            releaseInfo = premiereYear;
            if (stremioType == StremioType.Series)
            {
                releaseInfo += "-";
                if (dto.Status != "Continuing" && dto.EndDate.HasValue)
                {
                    var endYear = dto.EndDate.Value.Year.ToString(CultureInfo.InvariantCulture);
                    if (premiereYear != endYear)
                    {
                        releaseInfo += endYear;
                    }
                }
            }
        }

        var meta = new MetaDto
        {
            Id = dto.ProviderIds.TryGetValue("Imdb", out var idVal) ? idVal : $"jelliopp:{dto.Id}",
            Type = stremioType.ToString().ToLower(CultureInfo.InvariantCulture),
            Name = dto.Name,
            Poster = $"{baseUrl}/Items/{dto.Id}/Images/Primary",
            PosterShape = "poster",
            Genres = dto.Genres,
            Description = PlainText.FromHtml(dto.Overview),
            ImdbRating = dto.CommunityRating?.ToString("F1", CultureInfo.InvariantCulture),
            ReleaseInfo = releaseInfo,
            // Catalog items carry them too, so home screens and heroes can show the title logo and
            // backdrop without fetching the full meta first.
            Logo = dto.ImageTags?.ContainsKey(ImageType.Logo) == true
                ? $"{baseUrl}/Items/{dto.Id}/Images/Logo"
                : null,
            Background = dto.BackdropImageTags?.Length > 0
                ? $"{baseUrl}/Items/{dto.Id}/Images/Backdrop/0"
                : null,
        };

        if (includeDetails)
        {
            meta.Runtime =
                dto.RunTimeTicks.HasValue && dto.RunTimeTicks.Value != 0
                    ? $"{dto.RunTimeTicks.Value / 600000000} min"
                    : null;
            meta.Released = dto.PremiereDate?.ToString("o");
        }

        return meta;
    }

    private OkObjectResult GetStreamsResult(Guid userId, IReadOnlyList<BaseItem> items, string authToken, string? publicBaseUrl = null)
    {
        var user = _userManager.GetUserById(userId);
        if (user == null)
        {
            LogBuffer.AddLog($"[Stream] User not found: {userId}", LogLevel.Warning);
            return Ok(new { streams = Array.Empty<object>() });
        }

        LogBuffer.AddLog($"[Stream] Processing {items.Count} item(s) for user {user.Username}", LogLevel.Info);
        var baseUrl = GetBaseUrl(publicBaseUrl);
        LogBuffer.AddLog($"[Stream] Base URL: {baseUrl}", LogLevel.Info);
        var dtoOptions = new DtoOptions(true);
        var dtos = _dtoService.GetBaseItemDtos(items, dtoOptions, user, null, false);
        LogBuffer.AddLog($"[Stream] Got {dtos.Count} DTO(s)", LogLevel.Info);

        var streams = dtos.SelectMany(dto =>
        {
            int mediaSourceCount = 0;
            if (dto.MediaSources != null)
            {
                mediaSourceCount = dto.MediaSources.Count();
            }

            LogBuffer.AddLog($"[Stream] Processing DTO: {dto.Name} (Id: {dto.Id}, MediaSources: {mediaSourceCount})", LogLevel.Info);
            if (dto.MediaSources == null)
            {
                return Enumerable.Empty<StreamDto>();
            }

            return dto.MediaSources.SelectMany(source =>
            {
                var audioStreams = source.MediaStreams
                    .Where(stream => stream.Type == MediaStreamType.Audio)
                    .OrderByDescending(stream => stream.IsDefault)
                    .ThenBy(stream => stream.Index)
                    .ToList();
                var streamChoices = audioStreams.Count == 0
                    ? new MediaStream?[] { null }
                    : audioStreams.Cast<MediaStream?>().ToArray();

                var subtitleStreams = GetTextSubtitleStreams(source);
                var subtitles = subtitleStreams
                    .Select(sub => ToSubtitleDto(sub, dto.Id, source.Id, baseUrl, authToken))
                    .ToList();

                /*
                 * Adaptive mode preserves original quality when possible.
                 * Jellyfin transcodes unsupported tracks only when the matching
                 * video/audio transcoding mode allows it.
                 * Video codecs: H.264, HEVC, AV1 up to 1080p
                 * Audio codecs keep AAC first so unsupported tracks such as
                 * TRUEHD transcode to a TV-safe fallback instead of Opus.
                 */

                var pluginConfig = Plugin.Instance?.Configuration;
                var enableDirectStreaming = pluginConfig?.EnableDirectStreaming ?? true;
                var forceTranscodeVideo = pluginConfig?.ForceTranscodeVideo ?? false;
                var forceTranscodeAudio = pluginConfig?.ForceTranscodeAudio ?? false;
                var maxVideoBitrate = pluginConfig?.MaxVideoBitrate ?? 120;
                var maxVideoHeight = NormalizeMaxVideoHeight(pluginConfig?.MaxVideoHeight ?? DefaultMaxVideoHeight);
                var videoTranscodingMode = NormalizeVideoTranscodingMode(
                    pluginConfig?.VideoTranscodingMode,
                    forceTranscodeVideo,
                    enableDirectStreaming);
                var audioTranscodingMode = NormalizeAudioTranscodingMode(
                    pluginConfig?.AudioTranscodingMode,
                    forceTranscodeAudio);
                var allowVideoStreamCopy = videoTranscodingMode != TranscodingModeForce;
                var allowAudioStreamCopy = audioTranscodingMode != TranscodingModeForce;
                var enableVideoPlaybackTranscoding = videoTranscodingMode != TranscodingModeDisabled;
                var enableAudioPlaybackTranscoding = audioTranscodingMode != TranscodingModeDisabled;
                var enableDirectPlayback = ShouldEnableDirectPlayback(videoTranscodingMode, audioTranscodingMode);

                var audioCodecs = GetAudioCodecs(audioTranscodingMode);
                var streamDeliveryMode = NormalizeStreamDeliveryMode(pluginConfig?.StreamDeliveryMode);

                // Shared by every entry for this source; hashing reads the file, so do it once.
                var behaviorHints = new BehaviorHintsDto
                {
                    Filename = string.IsNullOrEmpty(source.Path) ? null : Path.GetFileName(source.Path),
                    VideoSize = source.Size,
                    VideoHash = OpenSubtitlesHash.ComputeFromPath(source.Path),
                    NotWebReady = true,
                };
                var streamSubtitles = subtitles.Count > 0 ? subtitles : null;
                var sourceStreams = new List<StreamDto>();

                // Listed first so clients that auto-play the top entry get the untouched file.
                if (ShouldIncludeDirectStream(streamDeliveryMode, videoTranscodingMode, audioTranscodingMode))
                {
                    LogBuffer.AddLog($"[Stream] Direct stream for {dto.Name} ({dto.Id}), source {source.Id}", LogLevel.Info);
                    var directSubtitles = SubtitlesForDirectStream(subtitleStreams, subtitles);
                    sourceStreams.Add(new StreamDto
                    {
                        Url = BuildDirectStreamUrl(baseUrl, dto.Id, source.Id, authToken),
                        Name = "Jellio Direct",
                        Description = $"{source.Name}\n{DescribeDirectSource(source)}",
                        BehaviorHints = behaviorHints,
                        Subtitles = directSubtitles.Count > 0 ? directSubtitles : null,
                    });
                }

                if (!ShouldIncludeHlsStreams(streamDeliveryMode, videoTranscodingMode, audioTranscodingMode))
                {
                    return sourceStreams;
                }

                return sourceStreams.Concat(streamChoices.Select(audioStream =>
                {
                    var videoCodecs = GetVideoCodecs(source, videoTranscodingMode);
                    var queryParameters = new Dictionary<string, string?>
                    {
                        ["mediaSourceId"] = source.Id,
                        ["api_key"] = authToken,
                        ["ApiKey"] = authToken,
                        ["videoCodec"] = string.Join(',', videoCodecs),
                        ["audioCodec"] = string.Join(',', audioCodecs),
                        ["enableDirectPlay"] = enableDirectPlayback ? "true" : "false",
                        ["enableDirectStream"] = enableDirectPlayback ? "true" : "false",
                        ["enableVideoPlaybackTranscoding"] = enableVideoPlaybackTranscoding ? "true" : "false",
                        ["enableAudioPlaybackTranscoding"] = enableAudioPlaybackTranscoding ? "true" : "false",
                        ["allowVideoStreamCopy"] = allowVideoStreamCopy ? "true" : "false",
                        ["allowAudioStreamCopy"] = allowAudioStreamCopy ? "true" : "false",
                        ["videoBitRate"] = $"{maxVideoBitrate * 1000000}",
                        ["maxWidth"] = MaxVideoWidthFor(maxVideoHeight).ToString(CultureInfo.InvariantCulture),
                        ["maxHeight"] = maxVideoHeight.ToString(CultureInfo.InvariantCulture),
                    };

                    if (audioStream != null)
                    {
                        queryParameters["audioStreamIndex"] = audioStream.Index.ToString(CultureInfo.InvariantCulture);
                    }

                    var audioLabel = GetAudioStreamLabel(audioStream);
                    var streamUrl = $"{baseUrl}/Videos/{dto.Id}/master.m3u8{QueryString.Create(queryParameters)}";

                    // Enhanced logging with codec info
                    var sourceVideoCodec = source.MediaStreams
                        .FirstOrDefault(s => s.Type == MediaStreamType.Video)?.Codec ?? "unknown";
                    var sourceAudioCodec = audioStream?.Codec ?? "unknown";

                    LogBuffer.AddLog($"[Stream] Generated stream for {dto.Name} ({dto.Id}):", LogLevel.Info);
                    LogBuffer.AddLog($"[Stream]   Source video: {sourceVideoCodec}, Source audio: {sourceAudioCodec}", LogLevel.Info);

                    var targetVideo = DescribeVideoTarget(videoTranscodingMode);
                    LogBuffer.AddLog($"[Stream]   Target video: {targetVideo}", LogLevel.Info);

                    var targetAudio = DescribeAudioTarget(audioTranscodingMode);
                    LogBuffer.AddLog($"[Stream]   Target audio: {audioLabel} ({targetAudio})", LogLevel.Info);

                    var jellyfinStreamMode = DescribeJellyfinStreamMode(
                        source,
                        audioStream,
                        videoTranscodingMode,
                        audioTranscodingMode,
                        maxVideoBitrate,
                        maxVideoHeight);
                    LogBuffer.AddLog($"[Stream]   Jellyfin mode: {jellyfinStreamMode}", LogLevel.Info);

                    LogBuffer.AddLog($"[Stream]   URL: {streamUrl}", LogLevel.Info);

                    return new StreamDto
                    {
                        Url = streamUrl,
                        Name = $"Jellio HLS - {audioLabel}",
                        Description = source.Name,
                        BehaviorHints = behaviorHints,
                        Subtitles = streamSubtitles,
                    };
                }));
            });
        }).ToList();

        LogBuffer.AddLog($"[Stream] Returning {streams.Count} stream(s)", LogLevel.Info);
        return Ok(new { streams });
    }

    [HttpGet("manifest.json")]
    public IActionResult GetManifest([ConfigFromBase64Json] ConfigModel config)
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;

        var userLibraries = LibraryHelper.GetUserLibraries(userId, _userManager, _userViewManager, _dtoService);
        userLibraries = Array.FindAll(userLibraries, l => config.LibrariesGuids.Contains(l.Id));
        if (userLibraries.Length != config.LibrariesGuids.Count)
        {
            return NotFound();
        }

        var catalogs = userLibraries.Select(lib =>
        {
            return new
            {
                type = lib.CollectionType switch
                {
                    CollectionType.movies => "movie",
                    CollectionType.tvshows => "series",
                    _ => null,
                },
                id = lib.Id.ToString(),
                name = $"{lib.Name} | {config.ServerName}",
                extra = new[]
                {
                    new { name = "skip", isRequired = false },
                    new { name = "search", isRequired = false },
                },
            };
        });

        var catalogNames = userLibraries.Select(l => l.Name).ToList();
        var descriptionText = $"Play movies and series from {config.ServerName}: {string.Join(", ", catalogNames)}";
        var manifest = new
        {
            id = "com.stremio.jelliodirect",
            version = PluginVersion,
            name = "Jellio Direct",
            description = descriptionText,
            resources = new object[]
            {
                "catalog",
                "stream",
                new
                {
                    name = "meta",
                    types = new[] { "movie", "series" },
                    idPrefixes = new[] { "jelliopp" },
                },
                // Stremio ignores the subtitles listed on a stream, so it asks for them here.
                new
                {
                    name = "subtitles",
                    types = new[] { "movie", "series" },
                    idPrefixes = new[] { "tt", "jelliopp" },
                },
            },
            types = new[] { "movie", "series" },
            idPrefixes = new[] { "tt", "jelliopp" },
            contactEmail = "support@jellio.stream",
            behaviorHints = new { configurable = true },
            catalogs,
        };

        return Ok(manifest);
    }

    [HttpGet("catalog/{stremioType}/{catalogId:guid}/{extra}.json")]
    [HttpGet("catalog/{stremioType}/{catalogId:guid}.json")]
    public IActionResult GetCatalog(
        [ConfigFromBase64Json] ConfigModel config,
        StremioType stremioType,
        Guid catalogId,
        string? extra = null
    )
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;

        var userLibraries = LibraryHelper.GetUserLibraries(userId, _userManager, _userViewManager, _dtoService);
        var catalogLibrary = Array.Find(userLibraries, l => l.Id == catalogId);
        if (catalogLibrary == null)
        {
            return NotFound();
        }

        var item = _libraryManager.GetParentItem(catalogLibrary.Id, userId);
        if (item is not Folder folder)
        {
            folder = _libraryManager.GetUserRootFolder();
        }

        var extras =
            extra
                ?.Split('&')
                .Select(e => e.Split('='))
                .Where(parts => parts.Length == 2)
                .ToDictionary(parts => parts[0], parts => parts[1])
            ?? new Dictionary<string, string>();

        int startIndex =
            extras.TryGetValue("skip", out var skipValue)
            && int.TryParse(skipValue, out var parsedSkip)
                ? parsedSkip
                : 0;
        extras.TryGetValue("search", out var searchTerm);

        var dtoOptions = new DtoOptions
        {
            Fields = [ItemFields.ProviderIds, ItemFields.Overview, ItemFields.Genres],
        };

        var user = _userManager.GetUserById(userId);
        if (user == null)
        {
            return Unauthorized();
        }

        var query = new InternalItemsQuery(user)
        {
            Recursive = true, // need this for search to work
            IncludeItemTypes = [BaseItemKind.Movie, BaseItemKind.Series],
            Limit = 100,
            StartIndex = startIndex,
            SearchTerm = searchTerm,
            ParentId = catalogLibrary.Id,
            DtoOptions = dtoOptions,
        };
        var result = folder.GetItems(query);
        var dtos = _dtoService.GetBaseItemDtos(result.Items, dtoOptions, user, null, true);
        var baseUrl = GetBaseUrl(config.PublicBaseUrl);
        var metas = dtos.Select(dto => MapToMeta(dto, stremioType, baseUrl));

        return Ok(new { metas });
    }

    [HttpGet("meta/{stremioType}/jelliopp:{mediaId:guid}.json")]
    public IActionResult GetMeta(
        [ConfigFromBase64Json] ConfigModel config,
        StremioType stremioType,
        Guid mediaId
    )
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;

        var item = _libraryManager.GetItemById<BaseItem>(mediaId, userId);
        if (item == null)
        {
            return NotFound();
        }

        var user = _userManager.GetUserById(userId);
        if (user == null)
        {
            return Unauthorized();
        }

        var dtoOptions = new DtoOptions
        {
            Fields = [ItemFields.ProviderIds, ItemFields.Overview, ItemFields.Genres],
        };
        var dto = _dtoService.GetBaseItemDto(item, dtoOptions, user);
        var baseUrl = GetBaseUrl(config.PublicBaseUrl);
        var meta = MapToMeta(dto, stremioType, baseUrl, includeDetails: true);

        if (stremioType is StremioType.Series)
        {
            if (item is not Series series)
            {
                return BadRequest();
            }

            var episodes = series.GetEpisodes(user, dtoOptions, false).ToList();
            var seriesItemOptions = new DtoOptions { Fields = [ItemFields.Overview] };
            var dtos = _dtoService.GetBaseItemDtos(episodes, seriesItemOptions, user, null, true);
            var videos = dtos.Select(episode => new VideoDto
            {
                Id = $"jelliopp:{episode.Id}",
                Title = episode.Name,
                Thumbnail = $"{baseUrl}/Items/{episode.Id}/Images/Primary",
                Available = true,
                Episode = episode.IndexNumber ?? 0,
                Season = episode.ParentIndexNumber ?? 0,
                Overview = PlainText.FromHtml(episode.Overview),
                Released = episode.PremiereDate?.ToString("o"),
            });
            meta.Videos = videos;
        }

        return Ok(new { meta });
    }

    [HttpGet("stream/{stremioType}/jelliopp:{mediaId:guid}.json")]
    public IActionResult GetStream(
        [ConfigFromBase64Json] ConfigModel config,
        StremioType stremioType,
        Guid mediaId
    )
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;
        LogBuffer.AddLog($"[Stream] Stream request for {stremioType} with ID: {mediaId}", LogLevel.Info);

        var item = _libraryManager.GetItemById<BaseItem>(mediaId, userId);
        if (item == null)
        {
            LogBuffer.AddLog($"[Stream] Item not found: {mediaId}", LogLevel.Warning);
            // If the item isn't in the library, we can't resolve provider IDs here.
            // Let Stremio fall back to IMDB-based stream routes which include IDs for request flow.
            return Ok(new { streams = Array.Empty<object>() });
        }

        LogBuffer.AddLog($"[Stream] Found item: {item.Name} (Type: {item.GetType().Name}, Id: {item.Id})", LogLevel.Info);
        var result = GetStreamsResult(userId, [item], config.AuthToken, config.PublicBaseUrl);
        LogBuffer.AddLog($"[Stream] Returning stream result for {item.Name}", LogLevel.Info);
        return result;
    }

    [HttpGet("stream/movie/tt{imdbId}.json")]
    public async Task<IActionResult> GetStreamImdbMovie(
        [ConfigFromBase64Json] ConfigModel config,
        string imdbId
    )
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;

        var user = _userManager.GetUserById(userId);
        if (user == null)
        {
            return Unauthorized();
        }

        var query = new InternalItemsQuery(user)
        {
            HasAnyProviderId = new Dictionary<string, string> { ["Imdb"] = $"tt{imdbId}" },
            IncludeItemTypes = [BaseItemKind.Movie],
        };
        var items = _libraryManager.GetItemList(query);

        if (items.Count == 0)
        {
            return await GetJellyseerrFallbackStream(config, imdbId, "movie");
        }

        return GetStreamsResult(userId, items, config.AuthToken, config.PublicBaseUrl);
    }

    [HttpGet("stream/series/tt{imdbId}:{seasonNum:int}:{episodeNum:int}.json")]
    public async Task<IActionResult> GetStreamImdbTv(
        [ConfigFromBase64Json] ConfigModel config,
        string imdbId,
        int seasonNum,
        int episodeNum
    )
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;
        LogBuffer.AddLog($"[Stream] TV Episode request: IMDB={imdbId}, Season={seasonNum}, Episode={episodeNum}", LogLevel.Info);

        var user = _userManager.GetUserById(userId);
        if (user == null)
        {
            LogBuffer.AddLog($"[Stream] User not found: {userId}", LogLevel.Warning);
            return Unauthorized();
        }

        var seriesQuery = new InternalItemsQuery(user)
        {
            IncludeItemTypes = [BaseItemKind.Series],
            HasAnyProviderId = new Dictionary<string, string> { ["Imdb"] = $"tt{imdbId}" },
        };
        var seriesItems = _libraryManager.GetItemList(seriesQuery);
        LogBuffer.AddLog($"[Stream] Found {seriesItems.Count} series with IMDB tt{imdbId}", LogLevel.Info);

        if (seriesItems.Count == 0)
        {
            LogBuffer.AddLog($"[Stream] Series not found for IMDB tt{imdbId}", LogLevel.Warning);
            return await GetJellyseerrFallbackStream(config, imdbId, "tv", seasonNum, episodeNum);
        }

        var seriesIds = seriesItems.Select(s => s.Id).ToArray();
        LogBuffer.AddLog($"[Stream] Series IDs: {string.Join(", ", seriesIds)}", LogLevel.Info);

        var episodeQuery = new InternalItemsQuery(user)
        {
            IncludeItemTypes = [BaseItemKind.Episode],
            AncestorIds = seriesIds,
            ParentIndexNumber = seasonNum,
            IndexNumber = episodeNum,
        };
        var episodeItems = _libraryManager.GetItemList(episodeQuery);
        LogBuffer.AddLog($"[Stream] Found {episodeItems.Count} episode(s) for Season {seasonNum}, Episode {episodeNum}", LogLevel.Info);

        if (episodeItems.Count == 0)
        {
            LogBuffer.AddLog($"[Stream] Episode not found: Season {seasonNum}, Episode {episodeNum}", LogLevel.Warning);
            return await GetJellyseerrFallbackStream(config, imdbId, "tv", seasonNum, episodeNum);
        }

        LogBuffer.AddLog($"[Stream] Returning streams for {episodeItems.Count} episode(s)", LogLevel.Info);
        return GetStreamsResult(userId, episodeItems, config.AuthToken, config.PublicBaseUrl);
    }

    [HttpGet("subtitles/{stremioType}/jelliopp:{mediaId:guid}/{extra}.json")]
    [HttpGet("subtitles/{stremioType}/jelliopp:{mediaId:guid}.json")]
    public IActionResult GetSubtitles(
        [ConfigFromBase64Json] ConfigModel config,
        StremioType stremioType,
        Guid mediaId,
        string? extra = null
    )
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;
        var item = _libraryManager.GetItemById<BaseItem>(mediaId, userId);
        return GetSubtitlesResult(userId, item == null ? [] : [item], config, extra);
    }

    [HttpGet("subtitles/movie/tt{imdbId}/{extra}.json")]
    [HttpGet("subtitles/movie/tt{imdbId}.json")]
    public IActionResult GetSubtitlesImdbMovie(
        [ConfigFromBase64Json] ConfigModel config,
        string imdbId,
        string? extra = null
    )
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;
        var user = _userManager.GetUserById(userId);
        if (user == null)
        {
            return Unauthorized();
        }

        var items = _libraryManager.GetItemList(new InternalItemsQuery(user)
        {
            HasAnyProviderId = new Dictionary<string, string> { ["Imdb"] = $"tt{imdbId}" },
            IncludeItemTypes = [BaseItemKind.Movie],
        });
        return GetSubtitlesResult(userId, items, config, extra);
    }

    [HttpGet("subtitles/series/tt{imdbId}:{seasonNum:int}:{episodeNum:int}/{extra}.json")]
    [HttpGet("subtitles/series/tt{imdbId}:{seasonNum:int}:{episodeNum:int}.json")]
    public IActionResult GetSubtitlesImdbTv(
        [ConfigFromBase64Json] ConfigModel config,
        string imdbId,
        int seasonNum,
        int episodeNum,
        string? extra = null
    )
    {
        var userId = (Guid)HttpContext.Items["JellioUserId"]!;
        var user = _userManager.GetUserById(userId);
        if (user == null)
        {
            return Unauthorized();
        }

        var seriesIds = _libraryManager.GetItemList(new InternalItemsQuery(user)
        {
            IncludeItemTypes = [BaseItemKind.Series],
            HasAnyProviderId = new Dictionary<string, string> { ["Imdb"] = $"tt{imdbId}" },
        }).Select(s => s.Id).ToArray();
        if (seriesIds.Length == 0)
        {
            return Ok(new { subtitles = Array.Empty<SubtitleDto>() });
        }

        var episodes = _libraryManager.GetItemList(new InternalItemsQuery(user)
        {
            IncludeItemTypes = [BaseItemKind.Episode],
            AncestorIds = seriesIds,
            ParentIndexNumber = seasonNum,
            IndexNumber = episodeNum,
        });
        return GetSubtitlesResult(userId, episodes, config, extra);
    }

    // Text subtitles of the Jellyfin file that is playing. Without a filename or size there is no
    // way to tell which file that is, so nothing is returned.
    private OkObjectResult GetSubtitlesResult(Guid userId, IReadOnlyList<BaseItem> items, ConfigModel config, string? extra)
    {
        var (filename, videoSize) = ParseSubtitleExtra(extra);
        var user = _userManager.GetUserById(userId);
        if (user == null || items.Count == 0 || (filename == null && videoSize == null))
        {
            return Ok(new { subtitles = Array.Empty<SubtitleDto>() });
        }

        var baseUrl = GetBaseUrl(config.PublicBaseUrl);
        var dtos = _dtoService.GetBaseItemDtos(items, new DtoOptions(true), user, null, false);
        var subtitles = dtos
            .SelectMany(dto => (dto.MediaSources ?? [])
                .Where(source => SourceMatchesPlayingFile(source, filename, videoSize))
                .SelectMany(source => GetTextSubtitleStreams(source)
                    .Select(sub => ToSubtitleDto(sub, dto.Id, source.Id, baseUrl, config.AuthToken))))
            .ToList();

        LogBuffer.AddLog($"[Subtitles] {subtitles.Count} subtitle(s) for {filename ?? videoSize?.ToString(CultureInfo.InvariantCulture)}", LogLevel.Info);
        return Ok(new { subtitles });
    }
}
