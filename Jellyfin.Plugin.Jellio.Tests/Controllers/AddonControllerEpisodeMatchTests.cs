using Jellyfin.Plugin.JellioDirect.Controllers;

namespace Jellyfin.Plugin.JellioDirect.Tests.Controllers;

public class AddonControllerEpisodeMatchTests
{
    // Jellyfin (TVDB) has the 2025-12-31 specials as S1E13-17; Cinemeta (IMDb) lists them as S0E1-5.
    private static readonly (string Name, DateTime? Premiere)[] Episodes =
    [
        ("No Freaking Way Summer Break Is Over!", new DateTime(2025, 9, 23)),
        ("Getting Along With Kaho-chan? No Freaking Way!", new DateTime(2025, 12, 31)),
        ("First Time Cosplaying and It's a Freaking Disaster?!", new DateTime(2025, 12, 31)),
        ("Is There No Way for Us to Remain Like This?", new DateTime(2025, 12, 31)),
        ("No Freaking Way I’m Surviving This Mess!", new DateTime(2025, 8, 19)),
    ];

    private static List<(string Name, DateTime? Premiere)> Match(string? name, DateTime? released) =>
        AddonController.MatchEpisodes(Episodes, e => e.Name, e => e.Premiere, name, released);

    [Fact]
    public void MatchEpisodes_IgnoresCaseAndPunctuation()
    {
        var matches = Match(
            "Getting Along with Kaho-chan? No Freaking Way!",
            new DateTime(2025, 12, 31, 16, 0, 0, DateTimeKind.Utc));

        Assert.Equal("Getting Along With Kaho-chan? No Freaking Way!", Assert.Single(matches).Name);
    }

    [Fact]
    public void MatchEpisodes_TreatsCurlyAndStraightApostrophesAlike()
    {
        var matches = Match("No Freaking Way I'm Surviving This Mess!", null);

        Assert.Equal("No Freaking Way I’m Surviving This Mess!", Assert.Single(matches).Name);
    }

    [Fact]
    public void MatchEpisodes_FallsBackToAUniqueAirDate()
    {
        var matches = Match("Summer Break Is Over", new DateTime(2025, 9, 22, 16, 0, 0, DateTimeKind.Utc));

        Assert.Equal("No Freaking Way Summer Break Is Over!", Assert.Single(matches).Name);
    }

    [Fact]
    public void MatchEpisodes_SharedAirDateWithoutNameMatch_ReturnsNothing()
    {
        Assert.Empty(Match("Next Shine", new DateTime(2025, 12, 31)));
    }

    [Fact]
    public void MatchEpisodes_NothingToMatchOn_ReturnsNothing()
    {
        Assert.Empty(Match(null, null));
    }
}
