# Viewport Resizer Extension

A Chrome/Edge (MV3) extension for responsive testing. It resizes the **current browser window** to target viewport sizes with a calibration pass.

## Features

- Device presets + custom width/height inputs
- Automatic fallback from maximized/fullscreen to normal before resize
- Calibrated viewport mode (with one correction pass)
- Fallback mode for restricted pages (e.g. pages where content script cannot run)
- Geek/GitHub-style popup UI (light + dark)

## Development

```bash
pnpm install
pnpm run build
```

Load `/dist` as an unpacked extension in Chrome/Edge.

## Fonts

Popup fonts are loaded from:

- `public/fonts/ibm-plex-sans-var.woff2`
- `public/fonts/jetbrains-mono-var.woff2`

You can replace these files with your preferred font binaries at any time.
