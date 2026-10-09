using System;
using System.Collections.Generic;

namespace Jellyfin.Plugin.JellioDirect.Models;

public class SaveConfigRequest
{
    public bool JellyseerrEnabled { get; set; }
    public string? JellyseerrUrl { get; set; }
    public string? JellyseerrApiKey { get; set; }
    public string? PublicBaseUrl { get; set; }
    public List<string>? SelectedLibraries { get; set; }

    // Transcoding settings
    public string? VideoTranscodingMode { get; set; }
    public string? AudioTranscodingMode { get; set; }
    public bool EnableDirectStreaming { get; set; } = true;
    public bool ForceTranscodeVideo { get; set; } = false;
    public bool ForceTranscodeAudio { get; set; } = false;
    public int MaxVideoBitrate { get; set; } = 120;

    // Null keeps the saved value, so an older config page doesn't reset it.
    public int? MaxVideoHeight { get; set; }

    // Null keeps the saved value.
    public string? EpisodeListSource { get; set; }

    // Null keeps the saved value, so an older config page doesn't reset it.
    public string? StreamDeliveryMode { get; set; }
}
