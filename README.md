# youtube-extension

**English** | [繁體中文](./README.zh-TW.md)

A YouTube browser extension that adds a native-looking toolbar under the video player, with download tools and viewing tools. Built with [WXT](https://wxt.dev) + TypeScript for Chrome and Firefox (Firefox-based browsers such as Zen are treated as Firefox).

> **Status:** under active development. The feature set below is the plan described in [`specs/`](./specs); not everything is implemented yet.

## Features (planned)

**Download tools** (powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org) on your computer)

- Video: pick a quality (8K / 4K / 2K / 1080p / HD …) with file sizes shown
- MP3: choose bitrate and trim a time range
- Thumbnails and subtitles (SRT / VTT / TXT)
- Screenshot of the current frame

**Viewing tools**

- Dark mode, cinema mode (dim everything but the player), picture-in-picture
- Floating player while scrolling, A–B loop / repeat N times
- Pause on tab switch, autoplay toggle, audio-only mode, mouse-wheel volume, hide comments

## Privacy and security

- No analytics or tracking. The extension only talks to YouTube and to the local helper program.
- No remote code: everything is bundled; no CDN scripts, no `eval`.
- Minimal permissions; content scripts run on `youtube.com` only.
- Video processing happens locally. Nothing is uploaded to third-party services.

See [`specs/constitution.md`](./specs/constitution.md) for the full set of principles.

## How downloads work

Browser extensions cannot run yt-dlp directly, so a small helper program (written in Go) is installed on your computer and connected through the browser's Native Messaging API:

```
Toolbar on YouTube  →  extension background  →  local helper  →  yt-dlp  →  ffmpeg
```

Installation scripts for macOS and Windows will be provided. Thumbnails, screenshots and all viewing tools work without the helper.

## Development

```bash
npm install
npm run dev           # Chrome, with auto-reload
npm run dev:firefox   # Firefox
```

## Build

```bash
npm run compile         # type check
npm test                # unit tests (Vitest)
npm run build           # Chrome  → .output/chrome-mv3
npm run build:firefox   # Firefox → .output/firefox-mv3
npm run build:host      # local helper → host/dist/ (macOS arm64/amd64, Windows amd64; requires Go)
npm run zip
npm run zip:firefox
npm run sign:firefox    # Firefox → signed .xpi in .output/firefox-signed (see below)
```

## Load the extension manually

- **Chrome:** open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose `.output/chrome-mv3`.
- **Firefox (development):** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and choose `.output/firefox-mv3/manifest.json`. Temporary add-ons are removed when Firefox restarts.
- **Firefox (permanent, Firefox 128 or later, including Zen):** release builds of Firefox only install add-ons signed by Mozilla, so the extension is signed through the *unlisted* channel of addons.mozilla.org (it is not published on the AMO website). Open the signed `.xpi` file in Firefox (or drag it onto a Firefox window) and confirm the install prompt.

### Signing the Firefox build (maintainers)

1. Create an API key at <https://addons.mozilla.org/developers/addon/api/key/>.
2. Export it as environment variables (never commit it or put it in a config file):
   ```bash
   export WEB_EXT_API_KEY=user:12345:67
   export WEB_EXT_API_SECRET=...
   ```
3. Run `npm run sign:firefox`. It builds `.output/firefox-mv3` and runs `web-ext sign --channel unlisted`; the signed `.xpi` is saved to `.output/firefox-signed/`. Add `-- --dry-run` to only print the command.

## Project documents

This project follows spec-driven development and a clean-room process:

| Document | Content |
|---|---|
| [`specs/constitution.md`](./specs/constitution.md) | Project principles |
| [`specs/CLEANROOM.md`](./specs/CLEANROOM.md) | Clean-room process and records |
| [`specs/001-toolbar`](./specs/001-toolbar/spec.md) | Toolbar shell |
| [`specs/002-downloads`](./specs/002-downloads/spec.md) | Download tools |
| [`specs/003-viewing-tools`](./specs/003-viewing-tools/spec.md) | Viewing tools |
| [`specs/plan.md`](./specs/plan.md) / [`specs/tasks.md`](./specs/tasks.md) | Technical plan and tasks |
| [`specs/ROADMAP.md`](./specs/ROADMAP.md) | Future directions |

Specs are written in Traditional Chinese.

## Disclaimer

Downloading YouTube content may violate YouTube's Terms of Service. Use this extension only for content you have the right to download, for personal use. Because Chrome Web Store does not allow YouTube downloaders, the extension is meant to be loaded manually.
