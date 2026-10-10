# Rod Loom

A browser workbench for designing fishing-rod thread wraps with solid bands and paired spiral fades.

**[Open Rod Loom](https://main.dnpxbg1xuqcc.amplifyapp.com)**

## Design a wrap

1. Choose a pattern from **Design library**, or start a blank design.
2. Collect Fuji and ProWrap Size D threads from **Thread catalog** into your **Quick palette**. Use stars to keep favorites across designs.
3. Click a quick-palette color to add a band. Adjust turns in **Thread bands**; drag to reorder, clone, copy/paste blocks, reverse, mirror, or undo.
4. Select bands to show the **⇄ Replace** buttons before quick-palette color chips. For paired spirals, replacement changes the incoming thread.
5. Add **Spiral into next color** between neighboring solid bands to create a paired fade transition.

**Design colors** buttons and band color chips collect and highlight threads in Quick palette without adding bands. Clicking the preview reveals the corresponding band.

## Preview and export

- Shaded rod and flat layouts, with Bottom, Side, and Top views.
- Calibrated actual size, Fit to window, and 1×–8× zoom.
- Adjustable thread coverage and blank diameter under **Display scale & calibration**.
- PNG export and a printable wrapping recipe with dimensions and estimated thread usage.
- JSON import/export for backups and sharing.

To calibrate actual size, measure the 50 mm reference line, enter its measured length, and apply calibration. Recalibrate after changing browser zoom or monitors.

## Browser saves

The current draft autosaves locally. **Save design** creates a named snapshot in Design library; editing the draft does not update that snapshot. Quick palettes belong to their designs, while favorites remain available across designs.

Panel expansion states are restored from the last session; Thread catalog starts collapsed on a fresh visit. Light, dark, and automatic themes are available. Catalog **Auto gray** keeps swatches muted until hover or keyboard focus; touch devices always show color.

Design data stays in your browser. Clearing site data removes local saves, so export JSON for durable backups.

## Accuracy

Catalog photos, product details, and stock flags are bundled snapshots from Mud Hole. Preview colors are estimates sampled from photos; use physical thread charts for color decisions. Metallic and neon rendering is illustrative.

The initial 0.25 mm thread coverage is an editable estimate. Measure a test wrap for your thread. Dimensions and thread usage are planning estimates; usage excludes setup turns, tag ends, and waste. Paired spiral counts represent finished paired revolutions. Fit, PNG exports, and printed recipes are not calibrated life-size.

## Run locally

Requires Python 3 and no installed packages:

```sh
python server.py
```

Open http://localhost:8000. Catalog data and swatches are bundled in `assets/`.

## Test and build

Requires Node.js:

```sh
node --test
node scripts/build.mjs
```

The build produces the static site in `dist/`. See [DEPLOY.md](DEPLOY.md) for publishing instructions.

To refresh catalog assets, run `python scripts/localize_catalog.py`, review and commit the changes, then rebuild. Review retailer terms before redistributing catalog content.
