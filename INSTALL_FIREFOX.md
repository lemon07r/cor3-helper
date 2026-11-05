# Installing COR3 Helper Unified on Firefox

This extension is built targeting desktop Firefox (stable 158+ on Linux / macOS / Windows) using Manifest V3 (`background.scripts` architecture).

## Prerequisites

- Desktop Firefox installed.
- Repository built:
  ```bash
  cd work
  npm ci
  npm run build:firefox
  ```
  The unpacked extension bundle will be created at `work/dist-firefox/`.

## Temporary Installation (Developer Mode / Unsigned)

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. In the "Temporary Extensions" section, click the **"Load Temporary Add-on..."** button.
3. In the file picker dialog, navigate to the project directory and select:
   ```text
   <path-to-repo>/work/dist-firefox/manifest.json
   ```
4. The extension **"COR3 Helper Unified (Firefox Prototype)"** will appear under Temporary Extensions.
5. Verify that:
   - Extension ID shows: `cor3-helper-unified@lr7.local`
   - Background scripts are active (`console-logger.js`, `errors.js`, `background.js`).
   - Click the extension icon in the Firefox toolbar to open the popup.

### Limitations of Temporary Installation

> [!WARNING]
> Temporary extensions are automatically unloaded whenever Firefox is restarted. You will need to reload `work/dist-firefox/manifest.json` via `about:debugging` after every browser restart.

- **Persistent Installation**: Permanent installation on standard Firefox release requires Mozilla add-on signing (AMO). On Firefox Developer Edition or Nightly, `xpinstall.signatures.required` can be set to `false` in `about:config` for unsigned installation.
- **Settings Persistence**: Firefox assigns temporary extensions a temporary origin/UUID; extension storage (`chrome.storage.local` / `chrome.storage.sync`) may reset across reloads if the extension ID changes or temporary state is wiped.

## Verifying In-Game Functionality

1. Open [cor3.gg](https://cor3.gg) or [os.cor3.gg](https://os.cor3.gg).
2. Open the COR3 Helper popup.
3. Verify that markets, timer countdowns, and daily ops display correctly.
4. Keep the **Dry Run Mode** toggle enabled (checked by default) when reviewing job eligibility to preview actions without committing funds or signing contracts.
