# youtube-extension

**English** | [繁體中文](./README.zh-TW.md)

A YouTube browser extension that adds a native-looking toolbar under the video player, with download tools and viewing tools. Built with [WXT](https://wxt.dev) + TypeScript for Chrome and Firefox (Firefox-based browsers such as Zen are treated as Firefox).

> **Status:** all planned features are implemented and are waiting for hands-on testing on macOS, Windows, Chrome and Firefox/Zen (see the [test checklist](./specs/e2e-checklist.md)).

## Features

A toolbar appears between the player and the video title on watch pages. It follows YouTube's light or dark look, can be hidden with ✕ (turn it back on from the extension's popup), and every panel can be pinned.

**Download tools**

- **Video:** a quality list from high to low (8K / 4K / 2K / 1080 / HD labels) with file sizes, as MP4 by default and WEBM under “Show more formats”. 2K and above, which YouTube has no H.264 version of, use AV1 (or VP9) inside MP4 and are marked “May not play in some players”.
- **MP3:** 64–320 kbps (remembers your choice).
- **Time range** for video and MP3: download only a part, with a range slider, start/end fields, “Sync with player” and “Set to current time”.
- Cover, title, channel, upload date, link and chapters are embedded into videos and MP3 (can be turned off).
- Progress on the toolbar button, speed and time left in the panel, cancel, retry, clear error messages, a notification when finished (click it to show the file), and downloads keep running if you close the tab or the browser.
- **Thumbnails** (only sizes that really exist), **subtitles** (uploaded and auto-generated, as SRT / VTT / TXT) and **screenshots** of the current frame work without the helper and are saved to the browser's download folder. When a direct subtitle download fails, yt-dlp is used instead.
- Videos, MP3 and subtitles that go through yt-dlp are saved to a folder you choose in the settings page, with a file name format of your choice.

Video and MP3 downloads use [yt-dlp](https://github.com/yt-dlp/yt-dlp), [ffmpeg](https://ffmpeg.org) and [deno](https://deno.com) on your computer through a small helper program; see [Install the helper](#install-the-helper).

**Viewing tools**

- Dark mode (switches YouTube's own appearance setting), cinema mode (dims everything except the player and the toolbar), picture-in-picture
- Floating player while scrolling (drag it to any corner), A–B loop or repeat N times
- Pause on tab switch, autoplay toggle, audio-only mode, mouse-wheel volume, hide comments
- Lock the playback quality (for example always 1080p, unless you change it by hand)
- Copy a `youtu.be` link with or without the current time, or as Markdown

**Page tidy** (in the settings page, works on all YouTube pages even when the toolbar is hidden)

- Always play the original audio instead of an AI dub; hide end cards and the end screen
- Dismiss “Continue watching?”; turn off thumbnail previews
- Open Shorts in the normal player; hide Shorts; show full video titles

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

Install it once with the scripts described in [Install the helper](#install-the-helper). Thumbnails, screenshots, subtitles and all viewing tools work without the helper.

## Install the helper

Video and MP3 downloads (and subtitles, when the direct download fails) need four programs on your computer: the **helper** from this project, [yt-dlp](https://github.com/yt-dlp/yt-dlp), [ffmpeg](https://ffmpeg.org) and [deno](https://deno.com) (the JavaScript runtime yt-dlp needs to get all YouTube formats). Thumbnails, screenshots, subtitles and all viewing tools work without them. Everything is installed for the current user only; no administrator rights or `sudo` are needed.

### 1. Build the helper

There are no prebuilt downloads yet. With [Go](https://go.dev/dl/) 1.24 or later and Node.js installed, run in this repository:

```bash
npm run build:host
```

This creates two ready-to-use folders: `host/dist/youtube-extension-host-macos/` and `host/dist/youtube-extension-host-windows/` (the helper, the install and uninstall scripts, and the native messaging manifest templates).

### 2a. macOS (Apple Silicon and Intel)

1. Install yt-dlp, ffmpeg and deno with [Homebrew](https://brew.sh):
   ```bash
   brew install yt-dlp ffmpeg deno
   ```
2. Run the installer (do not use `sudo`):
   ```bash
   sh host/dist/youtube-extension-host-macos/install.sh
   ```
   It copies the helper to `~/Library/Application Support/youtube-extension-host/`, removes the quarantine attribute so Gatekeeper does not block it, registers it for Chrome (`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`) and Firefox (`~/Library/Application Support/Mozilla/NativeMessagingHosts/`), and checks for yt-dlp, ffmpeg and deno.
3. Restart Chrome or Firefox, open a YouTube video and click **Check again** in the Video or MP3 panel.

### 2b. Windows 10/11 (x64)

1. Install yt-dlp, ffmpeg and deno with [winget](https://learn.microsoft.com/windows/package-manager/winget/):
   ```powershell
   winget install yt-dlp.yt-dlp Gyan.FFmpeg DenoLand.Deno
   ```
2. Run the installer in PowerShell (`-ExecutionPolicy Bypass` allows this one script to run without changing your settings):
   ```powershell
   powershell -ExecutionPolicy Bypass -File host\dist\youtube-extension-host-windows\install.ps1
   ```
   It copies the helper to `%LOCALAPPDATA%\youtube-extension-host\`, writes the native messaging manifests there, creates the registry keys `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chidi0716.youtube_extension` and `HKCU\Software\Mozilla\NativeMessagingHosts\com.chidi0716.youtube_extension`, and checks for yt-dlp, ffmpeg and deno.
3. Restart Chrome or Firefox, open a YouTube video and click **Check again** in the Video or MP3 panel.

If you open a terminal in a different folder, pass the full path of the script. You can also run `install/macos/install.sh` or `install/windows/install.ps1` straight from the repository after `npm run build:host`.

### Updating

- **yt-dlp:** YouTube changes often, so keep yt-dlp up to date. Use **Update yt-dlp** in the extension's settings page. If yt-dlp was installed with Homebrew or winget, the button shows the command to run instead (`brew upgrade yt-dlp` or `winget upgrade --id yt-dlp.yt-dlp`).
- **The helper:** build it again and run the installer again; it replaces the old version. Close the browser first if a download is running.

### Uninstall

```bash
sh host/dist/youtube-extension-host-macos/uninstall.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File host\dist\youtube-extension-host-windows\uninstall.ps1
```

This removes the helper, its manifests and registry keys, its state and its logs. Your downloaded files, yt-dlp and ffmpeg are not touched.

### Troubleshooting

- **"Check again" still says the helper is missing:** restart the browser after installing. Firefox-based browsers such as Zen use the Firefox registration.
- **"yt-dlp is out of date" or some qualities are missing:** update yt-dlp (see above) and make sure deno is installed (the settings page shows whether it was found).
- **macOS says the helper cannot be opened:** run the installer again; it removes the quarantine attribute. You can also build the helper from source yourself.
- **Logs:** `~/Library/Logs/youtube-extension-host/host.log` (macOS) or `%LOCALAPPDATA%\youtube-extension-host\logs\host.log` (Windows). They contain command names and error messages only, never cookies or account data.
- Downloads keep running if you close the YouTube tab or the browser. Unfinished files are kept in a hidden `.yte-tmp-…` folder inside the download folder and are removed when the download finishes, fails or is cancelled.

**What the helper can do:** only the fixed commands the extension needs (check status, read video info, download, cancel, list downloads, show a file, choose a folder, update yt-dlp). Only this extension may start it (`allowed_origins` / `allowed_extensions` in the manifests). It accepts a YouTube video ID, never a URL or command-line options, opens no network ports, and only yt-dlp talks to YouTube (and to GitHub when you update yt-dlp).

## FAQ

**Downloads suddenly fail with “YouTube has changed. Please update yt-dlp.”**
YouTube changes often and yt-dlp follows quickly. Click **Update yt-dlp** in the panel or in the settings page. If yt-dlp was installed with Homebrew or winget, run the command it shows (`brew upgrade yt-dlp` or `winget upgrade --id yt-dlp.yt-dlp`).

**The panel says only deno is missing. Can I still download?**
Yes. Without deno, yt-dlp may not see some YouTube formats (often the highest qualities). Install it with `brew install deno` or `winget install DenoLand.Deno`, then click **Check again**.

**macOS says the helper “cannot be opened” or is from an unidentified developer (Gatekeeper).**
Run the installer again (`sh host/dist/youtube-extension-host-macos/install.sh`); it removes the quarantine attribute that Gatekeeper checks. Do not use `sudo`. If it still happens, build the helper yourself with `npm run build:host` and install again.

**Zen (or another Firefox-based browser) cannot find the helper.**
The installer registers the helper for Firefox, which Zen normally reads. Restart Zen completely after installing and click **Check again**. If it still says the helper isn't connected, please open an issue with your Zen version, your macOS or Windows version, and whether `~/Library/Application Support/Mozilla/NativeMessagingHosts/com.chidi0716.youtube_extension.json` (macOS) exists. Messages starting with `[youtube-extension]` in the extension's console (open `about:debugging`, find the extension, click **Inspect**) also help.

**Downloads fail with “Couldn't write to the download folder.”**
The folder chosen in the settings page was moved or deleted, the disk is full, or the folder isn't writable. Choose another folder or click **Use default** in the settings page. On macOS, folders such as Desktop or Documents may need permission: if a prompt asks to allow access, allow it.

**The extension disappeared from Firefox after a restart.**
Add-ons loaded from `about:debugging` are temporary and are removed when Firefox restarts. Install the signed `.xpi` instead (see [Load the extension manually](#load-the-extension-manually)).

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
- **Firefox (permanent, Firefox 140 or later, including Zen):** release builds of Firefox only install add-ons signed by Mozilla, so the extension is signed through the *unlisted* channel of addons.mozilla.org (it is not published on the AMO website). Open the signed `.xpi` file in Firefox (or drag it onto a Firefox window) and confirm the install prompt.

### Signing the Firefox build (maintainers)

1. Create an API key at <https://addons.mozilla.org/developers/addon/api/key/>.
2. Export it as environment variables (never commit it or put it in a config file):
   ```bash
   export WEB_EXT_API_KEY=user:12345:67
   export WEB_EXT_API_SECRET=...
   ```
3. Commit your changes, then run `npm run sign:firefox`. It builds `.output/firefox-mv3`, packs the source code of the current commit into `.output/firefox-sources.zip` with `git archive` (without `node_modules`, `.output`, `host/dist` and `spikes`), and runs `web-ext sign --channel unlisted --upload-source-code`. The signed `.xpi` is saved to `.output/firefox-signed/`. Add `-- --dry-run` to create the source archive and print the command without submitting.

### Building from source (for add-on reviewers)

The Firefox build is bundled and minified by [WXT](https://wxt.dev)/Vite. To reproduce it from the uploaded source archive:

- Environment: Linux, macOS or Windows with Node.js 22 (npm 10). No other tools are needed for the extension itself.
- Commands:
  ```bash
  npm ci
  npm run build:firefox
  ```
- Output: `.output/firefox-mv3/`, the same files as the submitted package.

## Project documents

This project follows spec-driven development and a clean-room process:

| Document | Content |
|---|---|
| [`specs/constitution.md`](./specs/constitution.md) | Project principles |
| [`specs/CLEANROOM.md`](./specs/CLEANROOM.md) | Clean-room process and records |
| [`specs/001-toolbar`](./specs/001-toolbar/spec.md) | Toolbar shell |
| [`specs/002-downloads`](./specs/002-downloads/spec.md) | Download tools |
| [`specs/003-viewing-tools`](./specs/003-viewing-tools/spec.md) | Viewing tools |
| [`specs/004-convenience`](./specs/004-convenience/spec.md) | Quality lock, embedding, clip downloads, timestamp links |
| [`specs/005-page-tidy`](./specs/005-page-tidy/spec.md) | Page tidy options in the settings page |
| [`specs/006-toolbar-customization`](./specs/006-toolbar-customization/spec.md) | Customize which tools the toolbar shows and their order |
| [`specs/plan.md`](./specs/plan.md) / [`specs/tasks.md`](./specs/tasks.md) | Technical plan and tasks |
| [`specs/ROADMAP.md`](./specs/ROADMAP.md) | Future directions |
| [`specs/BACKLOG.md`](./specs/BACKLOG.md) | Feature ideas not yet specified |
| [`specs/e2e-checklist.md`](./specs/e2e-checklist.md) | Manual test checklist |

Specs are written in Traditional Chinese.

## Disclaimer

Downloading YouTube content may violate YouTube's Terms of Service. Use this extension only for content you have the right to download, for personal use. Because Chrome Web Store does not allow YouTube downloaders, the extension is meant to be loaded manually.
