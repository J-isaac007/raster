# Installing Raster

Raster is a web app. There's nothing to download: open it in a browser and
start drawing, or install it so it gets its own window, an app icon, and works
offline.

**Open Raster: <https://j-isaac007.github.io/raster/>**

The same address always has the latest release. Inside the app,
**Help › Install Raster…** shows the steps for the device you're on.

## What installing gives you

- Its own window and an icon in your Start menu, Dock, launcher or home screen
- Works with no internet connection after the first visit
- Opens `.raster` files when you double-click them (Chrome and Edge on desktop)
- Updates itself; there's no app store and no installer to rerun

Installed or not, Raster runs entirely on your device. Your art never leaves
it unless you save or export a file.

## Install on your device

### Windows, macOS, Linux and ChromeOS: Chrome or Edge

1. Open <https://j-isaac007.github.io/raster/>.
2. Click the **install icon** at the right end of the address bar.
   - Chrome: or open the **⋮** menu and choose **Install Raster** (in recent
     versions it's under **Cast, save and share**).
   - Edge: or open the **⋯** menu and choose **Apps › Install Raster**.
3. Click **Install**. Raster opens in its own window.

Brave, Vivaldi, Opera and other Chromium browsers work the same way.

### macOS: Safari

Requires macOS Sonoma (14) or later.

1. Open <https://j-isaac007.github.io/raster/> in Safari.
2. In the menu bar, choose **File › Add to Dock**.
3. Click **Add**. Raster appears in the Dock and Launchpad.

### Android

Installing from Chrome creates a real Android app (Chrome builds it for you,
signed by Google), so there's **no APK file to download or sideload** and no
need to allow unknown sources.

- **Chrome:** open the link, tap **⋮ › Add to home screen › Install**.
- **Samsung Internet:** tap **≡ › Add page to › Home screen › Add**.
- **Firefox:** tap **⋮ › Add app to Home screen** (or **Install**).

Raster then shows up in your app drawer and recent apps like any other app.

### iPhone and iPad

1. Open <https://j-isaac007.github.io/raster/> in Safari. (On iOS and iPadOS
   16.4 or later, Chrome, Edge and Firefox can do this too.)
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.

Raster is designed for a mouse or trackpad and a keyboard. It runs on phones
and tablets, but works best on a larger screen.

### Firefox on desktop

Firefox can't install web apps on most systems. Use Raster in a Firefox tab
(everything works the same, offline included), or open it in Chrome or Edge to
install it.

## Updating

Installed copies update themselves. When a new release is published, the next
time you open Raster with an internet connection it loads the new version. To
check which version you have, open **Help › About Raster**.

## Uninstalling

Uninstalling removes the app and its offline copy. **Save any work as a
`.raster` file first**: unsaved autosaved work is stored in the browser and is
removed with it.

- **Chrome or Edge on desktop:** open Raster, then the **⋮** (or **⋯**) menu in
  its title bar and choose **Uninstall Raster**. You can also remove it like
  any other app in Windows Settings or the macOS Applications folder.
- **Safari on macOS:** drag Raster out of `~/Applications`, or right-click its
  Dock icon and choose **Options › Remove from Dock**, then delete it from
  Launchpad.
- **Android:** long-press the icon and tap **Uninstall**.
- **iPhone and iPad:** long-press the icon and tap **Remove App › Delete App**.

## Your files and data

- **Autosave** keeps your current sprite in the browser so a refresh or crash
  loses nothing. It's per browser and per device, so it doesn't sync.
- **Save** (`Ctrl+S`) writes a `.raster` file you control. Use it to keep work
  safe, back it up, or move it between devices.
- Clearing your browser's site data for Raster deletes the autosave too.

## Host your own copy

Every [GitHub Release](https://github.com/J-isaac007/raster/releases) has a
`raster-web-<version>.zip` with the built app. Unzip it onto any static web
server (it works from a subfolder too) and open it in a browser. Installing
and offline support need the site to be served over **HTTPS** (or from
`localhost`).

To build it yourself instead:

```bash
npm install
npm run build
```

The app is written to `dist/`.

## Troubleshooting

- **No install option:** make sure you're on the HTTPS address above, not a
  local file. Reload the page once, since browsers sometimes offer install only
  after a second visit. Private or incognito windows can't install apps.
- **Already installed:** the browser hides the install option. Look for Raster
  in your apps.
- **Stuck on an old version:** close every Raster window and open it again
  while online.
- **Something else:** [open an issue](https://github.com/J-isaac007/raster/issues)
  with your device, browser and what you tried.
