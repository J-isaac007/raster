# Installing Raster

Raster is a desktop app for **Windows 10 and 11 (64-bit)**.

## Download

Get the latest version from the
**[Releases page](https://github.com/J-isaac007/raster/releases/latest)**.
Each release has two files:

| File                            | Use it if you want to                                           |
| ------------------------------- | --------------------------------------------------------------- |
| `Raster-Setup-<version>.exe`    | Install Raster normally, with Start menu and desktop shortcuts. |
| `Raster-<version>-portable.exe` | Run Raster without installing, e.g. from a USB drive.           |

Most people want the **Setup** file.

## Install

1. Download `Raster-Setup-<version>.exe`.
2. Open it.
3. **If Windows shows "Windows protected your PC"**, click **More info**, then
   **Run anyway**. See [why this happens](#why-windows-warns-you) below.
4. Choose whether to install for just you (no admin rights needed) and where,
   then click **Install**.
5. Open Raster from the Start menu or the desktop shortcut.

The installer also makes `.raster` files open in Raster when you double-click
them.

### Portable version

Download `Raster-<version>-portable.exe`, put it anywhere, and double-click it.
Nothing is installed and no shortcuts or file associations are created. It
starts a little slower than the installed version because it unpacks itself
each time.

## Why Windows warns you

Raster's installer isn't signed with a paid code-signing certificate yet, so
Windows SmartScreen doesn't recognize it and shows a warning the first time.
That's expected for new open source apps. Click **More info › Run anyway**.

To check that a download is genuine, only get it from this repository's
[Releases page](https://github.com/J-isaac007/raster/releases). Every release
is built from the public source code by GitHub Actions
([`.github/workflows/release.yml`](../.github/workflows/release.yml)).

## Updating

Download and run the newer `Raster-Setup-<version>.exe`. It replaces the old
version and keeps your settings and autosaved work. Check your current version
in **Help › About Raster**.

To hear about new versions, click **Watch › Custom › Releases** on the
[repository page](https://github.com/J-isaac007/raster).

## Uninstalling

Open **Settings › Apps › Installed apps**, find **Raster**, click **⋯ ›
Uninstall**. For the portable version, delete the `.exe`.

Your `.raster` files aren't touched. To also remove settings and autosaved
work, delete the folder `%APPDATA%\Raster`.

## Where Raster keeps things

| What                  | Where                                               |
| --------------------- | --------------------------------------------------- |
| Your saved work       | Wherever you save your `.raster` files              |
| Autosave and settings | `%APPDATA%\Raster`                                  |
| The app (installed)   | `%LOCALAPPDATA%\Programs\Raster` (per-user install) |

Raster works entirely offline and never sends your art or any data anywhere.

## Build it yourself

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone https://github.com/J-isaac007/raster.git
cd raster
npm install
npm run dist
```

The installer and portable `.exe` are written to `release/`.

## Troubleshooting

- **"Windows protected your PC" with no Run anyway button:** your organization
  may block unsigned apps. Ask your IT admin, or try the portable version.
- **Antivirus removes the download:** some antivirus tools flag new unsigned
  apps. Restore it from quarantine if you trust the source, and please
  [let us know](https://github.com/J-isaac007/raster/issues).
- **Double-clicking a `.raster` file doesn't open Raster:** right-click it,
  choose **Open with › Choose another app**, pick Raster and tick **Always**.
- **Something else:** [open an issue](https://github.com/J-isaac007/raster/issues)
  with your Windows version and what happened.
