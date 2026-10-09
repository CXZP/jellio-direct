# Jellio Direct (unofficial, temporary)
[![Release](https://img.shields.io/github/v/release/CXZP/jellio-direct)](https://github.com/CXZP/jellio-direct/releases)

> **This is a temporary build.** It exists only until direct play lands in
> [Jellio++](https://github.com/wujekbogdan/jellio-plus-plus) itself
> ([#14](https://github.com/wujekbogdan/jellio-plus-plus/pull/14)). Once that is
> released, switch back to Jellio++; this build won't be maintained after that.
>
> It is based on the older [Jellio+++](https://github.com/hexSB/jellio-plus-plus-plus) code by hexSB, not on the current Jellio++.

**What it adds**

- A **Direct** entry at the top of the stream list, which plays the original file
  (`/Videos/{id}/stream?static=true`): lossless audio (TrueHD, DTS-HD MA), image
  subtitles (PGS) and embedded tracks are kept, and Jellyfin doesn't transcode.
  The HLS entries stay below it as a fallback.
- Logo and background images in catalog items, and descriptions as plain text.
- A **Max resolution** setting for the HLS entries (4K, 1440p, 1080p or 720p),
  so a slow upload can get a clean 1080p stream instead of a blocky 4K one.

**Installing**

Add this plugin repository in Jellyfin and install **Jellio Direct** from the catalog
(full steps under [Installation](#installation)):

```
https://raw.githubusercontent.com/CXZP/jellio-direct/metadata/jellyfin-repo-manifest.json
```

It uses its own plugin ID, addon ID and URLs (`/jelliodirect/...`), so it can be
installed next to the official Jellio++ without the two overwriting each other.
Requires Jellyfin 12.

**Good to know**

- If you installed from the zip without adding the repository, the plugin page in
  Jellyfin's dashboard shows *"An error occurred while getting the plugin details
  from the repository."* That's expected and harmless.
- If you keep both addons installed in Stremio (this one and Jellio++), every
  catalog and every stream shows up twice. Install only one of them in Stremio,
  or remove the other one there.
- In the stream list, **Jellio Direct** is the original file; the
  **Jellio HLS** entries are the fallback, one per audio track.

---

# About

Stream your Jellyfin library directly in Stremio with seamless integration.

**Jellio Direct** is a fork of a fork of a fork:

- [**Jellio**](https://github.com/vanchaxy/jellio) by [Vanchaxy](https://github.com/vanchaxy) - the original Jellyfin↔Stremio bridge.
- [**Jellio+**](https://github.com/InfiniteAvenger/jellio-plus) by [InfiniteAvenger](https://github.com/InfiniteAvenger) - fork adding Jellyfin 10.11.x support.
- [**Jellio++**](https://github.com/wujekbogdan/jellio-plus-plus) by [wujekbogdan](https://github.com/wujekbogdan) - adds HLS streaming, OpenSubtitles hashes, and public base URL support.
- [**Jellio+++**](https://github.com/hexSB/jellio-plus-plus-plus) by [hexSB](https://github.com/hexSB) - rewritten plugin UI, transcoding controls, subtitle support, and Jellyfin 12 compatibility.
- **Jellio Direct** - this build, on top of Jellio+++. Adds direct play of the original file, catalog logos and backgrounds, and plain-text descriptions.

Every fork gets another `+`. This one ran out of them.

## Features

- **Direct Play** - A "Jellio Direct" entry plays the original file, keeping lossless audio, image subtitles (PGS) and every embedded track
- **Full Library Integration** - Access your entire Jellyfin movie and TV show collection in Stremio
- **Cross-Platform** - Works on all Stremio-supported devices (Windows, macOS, Linux, Android, iOS)
- **HLS Streaming** - Adaptive bitrate streaming with proper seeking via `master.m3u8`, as a fallback below the Direct entry
- **Transcoding Controls** - Choose adaptive, forced, or disabled transcoding separately for video and audio (HLS entries)
- **Subtitle Support** - Text subtitles (SRT, ASS, VTT) served from Jellyfin; embedded subtitles are read by the player on the Direct entry; OpenSubtitles hash for automatic subtitle matching
- **Audio Track Selection** - Pick specific audio tracks (language, codec, channels) directly in Stremio
- **AV1 Compatibility** - Adaptive video mode direct streams 1080p AV1 and transcodes 4K AV1 to H.264 for smoother Stremio playback
- **Public Base URL** - Override the server URL for HTTPS connectivity behind reverse proxies or tunnels
- **Jellyseerr Integration** - Request missing content directly from Stremio
- **Logs Viewer** - In-app streaming logs with auto-refresh for debugging
- **Modern UI** - React-based configuration interface with dark mode support

## How it Works

### Browsing Your Library in Stremio

Jellio Direct allows you to instantly stream media from your Jellyfin server through Stremio. Simply search for the media in Stremio, and if it is on your Jellyfin server, it will appear!

![Jellio Streaming in Stremio](assets/jellio-stream.PNG)

### Jellyseerr Integration

Enable the optional Jellyseerr functionality to be able to directly request media to be sent to Jellyseerr with a simple in-app solution.

![Jellyseerr Integration](assets/jellyseer-integration.PNG)

### Installation

NOTICE: If Stremio runs on the same computer as Jellyfin, the default `http://127.0.0.1:8096` addon link works as is. For Stremio on other devices, Jellyfin needs to be reachable over HTTPS, because Stremio requires HTTPS for remote addon URLs: use a tunnel or reverse proxy such as Tailscale Serve/Funnel, Cloudflare Tunnel, ngrok, etc., and set it as the Public URL. Behind Tailscale Serve or another HTTPS proxy, the Public URL is required: without it, poster and video links point to plain `http://` on the proxy host and don't load.

1. Open Jellyfin Dashboard > Plugins > Manage Repositories
2. Click "New Repository", enter "Jellio Direct" as the name and this as the repository URL:
   ```
   https://raw.githubusercontent.com/CXZP/jellio-direct/metadata/jellyfin-repo-manifest.json
   ```
3. Go back to Plugins, find **Jellio Direct** under "All" and install it
4. Restart Jellyfin
5. Jellyfin Dashboard > Plugins > Installed > Jellio Direct and then click "Settings"
6. Select which libraries you want to be included in Stremio
7. (Optional) Input your local Jellyseerr url (e.g. http://192.168.0.105:5055) and your Jellyseerr API key. Also include your Public URL for Jellyfin (e.g. https://jellyfin.yourserver.com)
8. Click "Save Configuration for Jellyfin"
9. Lastly, click "Install." Copy that link and paste it in your Stremio addons. You're all done!

Without the repository: download `jellio-direct_<version>.zip` from [Releases](https://github.com/CXZP/jellio-direct/releases), extract it into a new folder in Jellyfin's `plugins` directory (for example `C:\ProgramData\Jellyfin\Server\plugins\JellioDirect` on Windows, `/var/lib/jellyfin/plugins/JellioDirect` on Linux), and continue from step 4.

## Configuration

### Stream Delivery

- **Direct + HLS** (default) - The original file is listed first, followed by HLS streams that use the transcoding settings below
- **Direct only** - Only the original file, with every audio track; best for players such as mpv. No transcoding
- **HLS only** - Jellyfin HLS, one entry per audio track, transcoding as configured below

### Transcoding Settings

These apply to the HLS entries; the Direct entry is never transcoded.

- **Video Transcoding Mode** (default: Adaptive) - Adaptive copies AV1 up to 1080p, HEVC, and H.264 when supported and transcodes unsupported video; Force Transcode always re-encodes to H.264; No Transcode never requests video transcoding
- **Audio Transcoding Mode** (default: Adaptive) - Adaptive copies Opus/EAC3/AAC when supported and transcodes unsupported audio; Force Transcode always re-encodes to AAC; No Transcode never requests audio transcoding
- **Max Video Bitrate** - Maximum video bitrate in Mbps (2-200, default: 120)
- **Max Resolution** (default: 4K) - Video taller than this is scaled down (4K, 1440p, 1080p or 720p); smaller video keeps its size

### Watching away from home

Everything you watch away from home goes through your home connection's upload, which is often far below what a 4K remux needs (~80 Mbps). Set **Video Transcoding Mode** to Force Transcode, **Max Resolution** to 1080p and **Max Video Bitrate** to about half your upload speed. Then pick a **Jellio HLS** entry when you're away and **Jellio Direct** at home.

### Public Base URL

If your Jellyfin server is behind a reverse proxy, Cloudflare Tunnel, or Tailscale Serve/Funnel, set the public HTTPS URL here so Stremio can reach it.

## Development

### Backend stack

Build the plugin and start Jellyfin + Stremio:

```bash
docker compose run --rm dotnet-builder
docker compose up -d
```

Jellyfin: http://localhost:8096. Stremio: http://localhost:11470. Test media goes in `./media/`.

### Plugin UI

```bash
cd jellio-web
npm install
npm run dev
```

Served at http://localhost:5173/jelliodirect/. All API calls are mocked with MSW; the UI does not connect to any backend.

## Requirements

- Jellyfin 12.0.0+
- Stremio (any platform)
- HTTPS access to Jellyfin, for Stremio on devices other than the Jellyfin server
