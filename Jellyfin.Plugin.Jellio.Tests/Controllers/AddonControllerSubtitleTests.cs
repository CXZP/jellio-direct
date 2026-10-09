using Jellyfin.Plugin.JellioDirect.Controllers;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.JellioDirect.Tests.Controllers;

public class AddonControllerSubtitleTests
{
    [Fact]
    public void ParseSubtitleExtra_ReadsFilenameAndSize()
    {
        var (filename, videoSize) = AddonController.ParseSubtitleExtra(
            "filename=Dune.2021.2160p.mkv&videoHash=0123456789abcdef&videoSize=92500000000");

        Assert.Equal("Dune.2021.2160p.mkv", filename);
        Assert.Equal(92500000000L, videoSize);
    }

    [Fact]
    public void ParseSubtitleExtra_DecodesEscapedFilename()
    {
        var (filename, _) = AddonController.ParseSubtitleExtra("filename=Kaguya%20-%2001.mkv");

        Assert.Equal("Kaguya - 01.mkv", filename);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("videoHash=0123456789abcdef")]
    [InlineData("videoSize=abc")]
    public void ParseSubtitleExtra_WithoutFileInfo_ReturnsNothing(string? extra)
    {
        var (filename, videoSize) = AddonController.ParseSubtitleExtra(extra);

        Assert.Null(filename);
        Assert.Null(videoSize);
    }

    [Theory]
    [InlineData(null, 1000L, true)]
    [InlineData("dune.2021.2160p.MKV", null, true)]
    [InlineData("Other.Release.mkv", 2000L, false)]
    [InlineData(null, null, false)]
    public void SourceMatchesPlayingFile_MatchesBySizeOrFilename(string? filename, long? videoSize, bool expected)
    {
        var source = new MediaSourceInfo
        {
            Path = @"H:\Movies\Dune (2021)\Dune.2021.2160p.mkv",
            Size = 1000,
        };

        Assert.Equal(expected, AddonController.SourceMatchesPlayingFile(source, filename, videoSize));
    }

    [Fact]
    public void ToSubtitleDto_UsesBareLanguageAndTitleAsLabel()
    {
        var itemId = Guid.Parse("f4b7f6c8-6421-88fe-bd0f-6a9c1918da90");
        var sub = new MediaStream { Type = MediaStreamType.Subtitle, Codec = "subrip", Index = 19, Language = "eng", Title = "SDH" };

        var dto = AddonController.ToSubtitleDto(sub, itemId, "source1", "https://example.ts.net", "token");

        Assert.Equal($"jelliopp-{itemId}-19", dto.Id);
        Assert.Equal("eng", dto.Lang);
        Assert.Equal("SDH", dto.Label);
        Assert.Equal(
            $"https://example.ts.net/Videos/{itemId}/source1/Subtitles/19/Stream.srt?api_key=token&ApiKey=token",
            dto.Url);
    }
}
