# Alpine Postcard Maker — Project Guide for Claude

## What this is
An installable, fully offline web app (PWA) for designing original 1930s-style
Alpine travel posters. Hosted on GitHub Pages:
https://aepibailey.github.io/alpine-postcard-maker/

The full roadmap and milestone list live in `docs/PLAN.md`.

## Hard constraints
- **Phone-only owner.** The owner builds, tests, installs, and updates everything from
  an Android phone (Chrome). Never suggest Android Studio, a local terminal, USB
  debugging, or a desktop browser. All instructions must be doable on a phone.
- **Fully offline** after first load. Every asset (fonts, icons, code) is
  precached by `sw.js`. No CDNs, no network calls at runtime.
- **No sound anywhere.** No audio elements, Web Audio, or vibration.
- **Original art only.** All illustration is procedural SVG written for this
  project. Never copy, trace, or imitate specific real posters, logos, or brands.
  Fonts must be SIL OFL (or similar) with license files in `/fonts/`.
- **Privacy.** Posters, gallery, and photos never leave the device.

## Architecture
- No build step: plain HTML/CSS/ES modules served as-is.
  `scripts/app-files.mjs` lists what ships; everything else is dev-only.
- Poster = versioned JSON "recipe" (`src/recipe.js`, with `migrate()`).
  New features add optional fields; never break old recipes.
- Rendering: SVG layers (`src/layers/*`) → canvas for export and textures
  (`src/styles/*`). Colors always come from the active palette (`src/palettes.js`).
- Randomness uses the seeded RNG (`src/rng.js`) so posters re-render identically.
- Storage: IndexedDB (`src/gallery-db.js`) + `navigator.storage.persist()`;
  backup/restore as a single JSON file (`src/backup.js`).
- Export via `navigator.share({ files })`, fallback to download.
- When changing any shipped file, bump `VERSION` in `src/version.js`, `CACHE` in
  `sw.js`, and `version` in `package.json` together, and keep `PRECACHE` complete
  (the unit tests enforce this).
- The app is served from `/alpine-postcard-maker/`: use **relative paths only**
  (manifest `start_url` and `scope` are `"./"`; register `./sw.js`). Never use
  leading-slash URLs.
- Exports must use the chosen font: embed the `.woff2` as base64 `@font-face`
  in the SVG before rasterizing (fallback: draw lettering on canvas). The
  font-export e2e test must stay green.

## Commands
- `npm test` — unit tests (Node test runner)
- `npm run e2e` — Playwright, phone viewport 412×915, served under the Pages subpath
- `npm run serve` — local server at http://localhost:4173/alpine-postcard-maker/
- `npm run icons` — re-render PNG icons from `icons/icon.svg` and `design/maskable.svg`
- `npm run build` — copy shipped files to `_site/` (CI uses this to deploy)

## Workflow
- Work in small milestones; each ends in something the owner can test on the phone.
- New visual directions start with an art spike (finished sample posters as
  screenshots) that the owner approves before building controls.
- Before opening a PR: run `npm test` (unit) and `npm run e2e` (Playwright,
  phone-sized viewport 412×915).
- Commit phone-sized screenshots to `docs/screenshots/<milestone>/` and embed
  them in the PR description so the owner can see them in the GitHub app.
- Each PR description includes a short "Test on your phone" checklist in plain
  language.
- If GitHub Pages is not yet enabled (Settings → Pages → Source: GitHub Actions),
  remind the owner to enable it before merging.
- `main` deploys automatically to GitHub Pages via `.github/workflows/deploy.yml`.
- Never commit secrets or API keys.

## Browser Integration

If you attempt to use the claude-in-chrome tool and it fails (unavailable, not installed, etc.):
- Do NOT silently continue without it unless told otherwise. If the user states they will be going to sleep or away for a while, ask if you may proceed silently in the event of a Chrome failure.
- Display a clear notification to the owner: "[Tool: claude-in-chrome] Required but unavailable. Please open Chrome."
- Wait for user confirmation before proceeding with any workaround

## Image Generation

I am not an expert in when AI image generation is useful. Use your judgment to decide, following these rules.

### When to use image generation
Use an external image model when the project needs raster art that code cannot produce well:
- Painted or realistic art: backgrounds, character portraits, splash/title screens, promotional images
- Textures (e.g., wall, floor, terrain) for games
- Any asset where a human artist would normally be hired

### When NOT to use it (build these in code instead)
- Icons, UI elements, buttons, logos, charts, diagrams: use SVG or CSS
- Simple shapes, geometric or procedural art, particle effects
- Pixel art at small sizes, if code-drawn results look acceptable
- Anything where a placeholder is fine during early prototyping

### Process
1. Before the FIRST use in this project, stop and tell me:
   - which assets you think need generated images, and why
   - which image tool you plan to use, and whether it costs money
   Wait for my approval.
2. If no image generation tool or script is set up, do NOT set one up silently. Explain the options (local Stable Diffusion/ComfyUI, Gemini API, or manual: you write prompts and I generate them in the free Gemini app), recommend one, and wait for my decision.
3. Until approved art exists, use clearly labeled placeholders so development isn't blocked.
4. Save every prompt you use in /assets/prompts.md next to the filename it produced, so images can be regenerated or restyled consistently.
5. Keep a consistent art style across assets. Define the style once in prompts.md and reuse it.
6. Never put API keys in code or commit them. Read them from environment variables.
