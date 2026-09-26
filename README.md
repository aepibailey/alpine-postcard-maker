# Alpine Postcard Maker

Design vintage 1930s-style Alpine travel posters on your phone. Works fully offline.
All art is original and drawn in code.

**Open the app:** https://aepibailey.github.io/alpine-postcard-maker/

## Install on Android (Chrome)
1. Open the link above in Chrome.
2. Tap **⋮** → **Install app** (or **Add to Home screen**).
3. Open it once while online. After that it works with no signal.

## Updates
New versions deploy automatically when a pull request is merged into `main`.
Next time you open the app, a **"New version available — Tap to refresh"** banner
appears. Tap it to update.

## Status
- **M0** — installable offline app shell ✅
- **M1a** — art spike: 3 sample posters, approved ✅
- **M1b** — mountain picker (spire, massif, pyramid) + 🎲 random ridgeline generator ✅
- **M2** — time of day: dawn, midday, alpenglow, starry night ✅
- **M3** — scenery switches: village, hut, gondola, forest, lake, skier ✅
- **M4** — lettering: your destination and tagline, 4 typefaces, 4 title placements ✅
- **M5** — print styles: flat, screen print, aged paper ✅
- **M6** — export: phone wallpaper, match my screen, 10×15 print, square post → share sheet or Downloads ✅
- **M7** — gallery: every poster kept on the phone; open, copy, delete; back up / restore to a file ✅
- **M8** — v1.0 polish: welcome hint, ✨ Surprise me, mini poster while scrolling, About panel with font credits, accessibility checks

See [`docs/PLAN.md`](docs/PLAN.md) for later versions.

## Fonts
Bundled under the SIL Open Font License 1.1 (licenses in `fonts/`):
Limelight (Sorkin Type Co), Josefin Sans (The Josefin Sans Project Authors),
Poiret One (The Poiret One Project Authors) and Bebas Neue (Dharma Type).

## For contributors (Claude Code)
See [`CLAUDE.md`](CLAUDE.md). Run `npm test` and `npm run e2e` before opening a PR.
