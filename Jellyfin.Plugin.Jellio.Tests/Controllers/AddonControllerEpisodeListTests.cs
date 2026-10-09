using Jellyfin.Plugin.JellioDirect.Controllers;
using Jellyfin.Plugin.JellioDirect.Models;
using MediaBrowser.Model.Dto;

namespace Jellyfin.Plugin.JellioDirect.Tests.Controllers;

public class AddonControllerEpisodeListTests
{
    private static readonly Guid SeriesId = Guid.Parse("84361359-e8ec-3b25-750d-1e525cb9f155");

    private static BaseItemDto Series(string? imdbId) => new()
    {
        Id = SeriesId,
        Name = "There's No Freaking Way I'll Be Your Lover! Unless...",
        ProviderIds = imdbId == null
            ? new Dictionary<string, string>()
            : new Dictionary<string, string> { ["Imdb"] = imdbId },
    };

    [Theory]
    [InlineData(null, "cinemeta")]
    [InlineData("", "cinemeta")]
    [InlineData("cinemeta", "cinemeta")]
    [InlineData("jellyfin", "jellyfin")]
    [InlineData("tvdb", "cinemeta")]
    public void NormalizeEpisodeListSource_DefaultsToCinemeta(string? source, string expected)
    {
        Assert.Equal(expected, AddonController.NormalizeEpisodeListSource(source));
    }

    [Fact]
    public void MapToMeta_UsesImdbIdByDefault()
    {
        var meta = AddonController.MapToMeta(Series("tt36592708"), StremioType.Series, "https://example.ts.net");

        Assert.Equal("tt36592708", meta.Id);
    }

    [Fact]
    public void MapToMeta_UseJellyfinId_IgnoresImdbId()
    {
        var meta = AddonController.MapToMeta(
            Series("tt36592708"), StremioType.Series, "https://example.ts.net", useJellyfinId: true);

        Assert.Equal($"jelliopp:{SeriesId}", meta.Id);
    }

    [Fact]
    public void MapToMeta_WithoutImdbId_UsesJellyfinId()
    {
        var meta = AddonController.MapToMeta(Series(null), StremioType.Series, "https://example.ts.net");

        Assert.Equal($"jelliopp:{SeriesId}", meta.Id);
    }
}
