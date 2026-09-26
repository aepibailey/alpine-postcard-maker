# M0 build notes (skeleton PWA + deploy pipeline)

**Decisions (from the owner, this turn):** create a `main` branch; change the Browser Integration line to "the owner"; the repo is already public.

**Git steps**
1. Push a new branch `main` pointing at the existing plan commit `551a278` (docs/PLAN.md only).
2. Build M0 on `claude/alpine-postcard-planning-rqa8hy`, commit, push, and open PR → `main`.

**Files**
- `index.html`: app shell (title, `theme-color`, `<link rel="manifest" href="manifest.webmanifest">`), a clearly labeled placeholder poster frame ("Posters coming in M1"), version number, and a hidden "New version – tap to refresh" banner.
- `src/app.css`: vintage-poster base styles, phone-first layout.
- `src/app.js`: registers `./sw.js` (scope `./`) and shows the version. Update flow: a waiting worker makes the banner appear → tap → `postMessage('SKIP_WAITING')` → reload on `controllerchange`.
- `src/version.js`: `export const VERSION = '0.0.1'`.
- `sw.js`: `CACHE = 'apm-0.0.1'` plus a relative `PRECACHE` list. Install precaches everything; activate deletes old caches and calls `clients.claim()`. Fetch is cache-first for same-origin GET, and navigations fall back to cached `./index.html`. It skips waiting only when the app sends the message.
- `manifest.webmanifest`:
  - `id`, `start_url` and `scope` are all `"./"`, with `display: standalone` and theme/background colors.
  - Icons: 192 and 512 `any`, plus 512 `maskable`.
- `icons/icon.svg` is an original design: a stylized peak, sun and deco frame. `scripts/make-icons.mjs` renders it to PNG with Playwright, and the PNGs are committed as `icons/icon-192.png`, `icons/icon-512.png` and `icons/maskable-512.png`.
- `scripts/serve.mjs`: a tiny dependency-free static server that serves the repo under `/alpine-postcard-maker/`, the same way Pages does. Used by Playwright.
- `scripts/build-site.mjs`: copies only the app files into `_site/` for deploy, leaving out tests and node_modules.
- `package.json` (`type: module`; scripts `test` = `node --test tests/unit`, `e2e` = `playwright test`, `icons`, `build`; devDep `@playwright/test@1.56.1`, which matches the preinstalled Chromium), plus `package-lock.json`, `playwright.config.js` (412×915 viewport, webServer = serve.mjs) and `.gitignore`.
- `tests/unit/`:
  - `paths.test.js`: no leading-slash URLs in the HTML, manifest or sw, and manifest `start_url`/`scope` are `./`.
  - `no-sound.test.js`: no `Audio(`, `AudioContext`, `<audio`, `vibrate` or audio file extensions.
  - `precache.test.js`: every PRECACHE file exists, every app file is precached, and the sw cache name matches VERSION.
- `tests/e2e/shell.spec.js`:
  - The app loads at the subpath.
  - The manifest is valid.
  - The service worker takes control.
  - With the context set **offline**, a reload still renders the app.
  - Saves screenshots to `docs/screenshots/m0/`.
- `.github/workflows/deploy.yml`: triggers on `pull_request` and on `push` to `main`, plus manual runs. The **test** job runs npm ci, unit tests, then Playwright (installing Chromium on the runner). The **deploy** job (main only, needs test) runs build-site → `configure-pages` → `upload-pages-artifact(_site)` → `deploy-pages`, with `pages: write` and `id-token: write` permissions.
- `.claude/settings.json`: a SessionStart hook that runs `npm ci` so future Claude sessions can run the tests.
- `CLAUDE.md`: the approved draft, with the Browser Integration line changed to "Display a clear notification to the owner". `README.md` explains what the app is, how to install it on a phone and how updates work. `docs/PLAN.md` is synced with this plan.

**PR body:** screenshots embedded via `https://github.com/aepibailey/alpine-postcard-maker/raw/claude/alpine-postcard-planning-rqa8hy/docs/screenshots/m0/*.png`, plus a **"Before you merge"** list:
1. Settings → General → Default branch → switch to **main**. This is required because Pages only deploys from the default branch.
2. Settings → Pages → Source: **GitHub Actions**.

Then comes a "Test on your phone" checklist: install, airplane-mode reopen, and the version shown.

**Verify before pushing:** run `npm test` and `npm run e2e` locally in the container (both green), re-run the icon script, check the screenshots visually, and send them to the owner in chat too. After the PR is open, check its CI run passes.

---

# Alpine Postcard Maker — Plan (v1 + roadmap)

## Context
Shawn wants a phone-only-built app for designing original 1930s-style Alpine travel posters. There's no computer, so everything has to happen from an Android phone: Claude Code on the web writes the code, GitHub builds and hosts it, and Chrome runs it. The repo `aepibailey/alpine-postcard-maker` is empty (branch `claude/alpine-postcard-planning-rqa8hy`, no commits). This session only plans. No app code gets written until the plan is approved.

**Decisions confirmed with Shawn**
- Hosting: make the repo **public** and use **GitHub Pages** (free).
- Browser: **Chrome** on Android.
- Gallery: **editable posters** (settings saved, can reopen and tweak) plus a **backup/restore file**.
- Fonts: open-license (SIL OFL) display fonts are OK. All illustrations are drawn from scratch in code.

---

## 1. Approach comparison (phone-only)

| | **A. Installable offline web app (PWA) on GitHub Pages** ✅ | B. Native APK built by GitHub Actions | C. Web app wrapped as an APK (Capacitor/TWA) |
|---|---|---|---|
| **Install** | Open the URL in Chrome, tap ⋮ → *Install app* (or *Add to Home screen*). It gets its own icon and opens full-screen, like an app. | Open the repo's *Releases* page, download the `.apk`, and allow "install unknown apps" for Chrome. Android shows warnings. | Same as B. |
| **Update** | Automatic. Merge a change and Pages redeploys in about 1 min. Next time you open the app, a "New version – tap to refresh" banner appears. | Download and install each new APK by hand. Android may refuse updates if the signing key changes. | Same as B. |
| **Offline** | Yes. A service worker caches everything after the first open. | Yes. | Yes. |
| **Save to gallery** | Via the **share sheet** (→ Photos / Drive / Messages) or a download into *Downloads*, which Google Photos shows. It can't write silently into DCIM. | Can write straight into the gallery. | Can write straight into the gallery (plugin). |
| **Testing each step** | Claude runs it in a headless browser, sends screenshots, and you open the live URL. | Every test needs a 5–10 min CI build, then a download and reinstall. | Same as B, plus a build toolchain. |
| **Signing keys and secrets** | None. | A keystore has to be stored as a GitHub secret. Lose it and updates break. | Same as B. |
| **Repo visibility** | Public, for free Pages. | Can stay private. | Can stay private. |

**Recommendation: A (PWA on GitHub Pages).** It's the only option where installing and updating are just "tap a link" and "tap refresh". Every milestone can be tested in about a minute. You gain automatic updates and no signing keys or sideloading. You lose direct gallery writes (you use the share sheet or Downloads instead), and the code is public. Your posters are never uploaded. They stay on your phone. If you ever want a Play-Store-style APK, option C can be added later around the same code without a rewrite.

**What going public means:** anyone can read the code, the art code and the prompts. They can't see your posters, gallery or photos (Photo mode runs entirely on the phone). No secrets will ever be in the repo. You can switch back to private later, but Pages would then stop unless you move to paid GitHub Pro or Cloudflare Pages.

---

## 2. Technical design (kept simple for phone-only maintenance)

- **No build step for the app itself.** Plain HTML, CSS and JavaScript modules served as-is. There's nothing to compile, so there's less to break, and what's in the repo is exactly what runs.
- **Rendering:** each poster is composed as **SVG** layers (sky → far peaks → main peak → mid layers → foreground → lettering → border). Export rasterizes the SVG onto a `<canvas>` at the target size, then applies the print-style texture (grain and paper) in canvas.
- **Poster "recipe":** each poster is a small versioned JSON object, e.g. `{schemaVersion, mountain:{type, seed}, time, layers:[…], text:{…}, font, placement, style, series?:{…}, family?:{…}, photo?:{…}}`. The gallery stores recipes (for re-editing) plus a thumbnail. Later features only add new fields. A `migrate()` function upgrades old recipes.
- **Randomness:** a seeded random generator, so a "random ridgeline" is reproducible from its seed and saved posters re-render the same way.
- **Palettes:** one palette table per time of day (dawn / midday / alpenglow / night), 4–6 inks each. All layers pull colors from the active palette, which gives the limited-ink screen-print look.
- **Storage:** IndexedDB for recipes and thumbnails. On first save, call `navigator.storage.persist()` so Chrome keeps the data long-term (installed PWAs usually get this granted). Backup = a single `.json` file (recipes plus small thumbnails) saved via share or download. Restore = file picker, which merges into the gallery.
- **Export sizes:** phone wallpaper 1440×3200 (20:9), **"Match my screen"** (the device's real resolution: `screen.width/height × devicePixelRatio`, rounded, portrait), 10×15 cm print 1200×1800 @300 dpi, square 2160×2160. Uses `navigator.share({files})` with a download fallback.
- **Fonts survive export:** an SVG drawn into a canvas can't see the page's fonts. So `export.js` reads each chosen `.woff2` (from the service-worker cache), embeds it as a base64 `@font-face` inside the SVG's `<style>`, and waits for `document.fonts.load()` before rasterizing. If embedding fails, it falls back to drawing the lettering straight onto the canvas with `ctx.fillText` using the already-loaded font.
- **Relative paths:** the app is served from `/alpine-postcard-maker/`. So the manifest uses `"start_url": "./"` and `"scope": "./"`, the service worker registers as `./sw.js` with scope `./`, and every precache and asset URL is relative. There are no leading-slash paths anywhere, and a unit test searches for them.
- **Offline:** a service worker precaches the app shell, fonts and icons, with a versioned cache and an update banner.
- **No sound:** no audio elements or APIs, and no vibration. Enforced by a test that searches the code for audio APIs.
- **Original art only:** all peaks, villages, gondolas and so on are procedural SVG written for this project. Nothing is traced from or copies real posters, logos or brands. Fonts are OFL (e.g. *Limelight*, *Poiret One*, *Bebas Neue*, *Josefin Sans*), with license files kept in `/fonts/`.
- **Image generation:** v1 needs **none**, since everything is code-drawn SVG. Photo mode posterizes on the phone with color quantization in code, not AI. If generated art ever seems worth it, the CLAUDE.md process (ask first) applies.
- **Dev tooling (Claude's side only):** `package.json` with dev-only deps: Playwright (Chromium is preinstalled in the cloud container) for screenshot and smoke tests, and Node's built-in test runner for logic (palettes, seeded random, recipe migration). The GitHub Actions workflow runs the tests, then deploys to Pages.

**Planned files**
```
index.html  manifest.webmanifest  sw.js
/src  app.js  state.js  recipe.js  rng.js  palettes.js  render.js  export.js  gallery-db.js  backup.js  ui/*.js
/src/layers  sky.js  mountains.js  ridgeline.js  village.js  hut.js  gondola.js  forest.js  lake.js  skier.js  lettering.js  border.js
/src/styles  flat.js  screenprint.js  aged.js
/fonts  *.woff2 + OFL.txt     /icons  (SVG-built PNG icons)
/assets/prompts.md (only if image gen is ever approved)
/tests  unit/*.test.js  e2e/*.spec.js
.github/workflows/deploy.yml   CLAUDE.md   README.md
```

---

## 3. Milestones (each ends with something to test on your phone)

**How each milestone works:** you ask Claude in a Claude Code session → Claude builds it on a branch and runs the tests → Claude takes phone-sized screenshots, commits them to `docs/screenshots/<milestone>/` on the PR branch, and **shows them in the PR description** (so you can see them in the GitHub app) → you review and merge in the GitHub app → about 1 min later, open the installed app and tap "Refresh" on the update banner → test on the phone checklist.

| # | Milestone | Test on your phone |
|---|---|---|
| **M0** | Skeleton: `index.html`, manifest (relative `start_url`/`scope` `./`), icon, service worker, Pages deploy workflow, CLAUDE.md, README. ⚠️ **Before you merge M0, Claude reminds you to turn on Pages** (Settings → Pages → Source: **GitHub Actions**), or the first deploy fails. | Open the URL in Chrome → *Install app* → icon on home screen. Turn on **airplane mode**, reopen, and it still loads. |
| **M1a** | **Art spike:** 3 finished sample posters (e.g. jagged spire at alpenglow with village; massif at midday with lake; pyramid under starry night with skier), hard-coded with no controls. They set the art direction: line quality, palettes, level of detail. | Look at the 3 screenshots in the PR and **approve or give feedback. Controls aren't built until the look is approved.** |
| **M1b** | Poster preview + mountains: jagged spire, broad massif, lone pyramid, "random ridgeline" (🎲 button with seed), in the approved style | Swipe through peaks. Tap 🎲 several times and you get new ridgelines each time. |
| **M2** | Sky and time of day: dawn, midday, alpenglow, starry night. The whole palette shifts. | Switch each time of day and check that mountains and sky recolor together. |
| **M3** | Foreground layers: village + spire, hut, gondola, pine forest, lake reflection, lone skier (toggles) | Turn each layer on and off. The lake reflection mirrors the chosen peak. |
| **M4** | Lettering: destination name + tagline, 3–4 OFL fonts, placement presets (top/bottom, arched, banner) | Type long and short names and check they fit. Try each font offline. |
| **M5** | Print styles: flat vector, screen-print grain, aged paper | Toggle styles. The preview stays smooth on your phone. |
| **M6** | Export: wallpaper / **match my screen** / 10×15 / square → share sheet or Downloads. Fonts embedded before rasterizing. | Export each size, save to Photos, and set the "match my screen" one as your wallpaper, checking that it fills the screen and is sharp. **Check the lettering uses the font you picked**, including in airplane mode. |
| **M7** | Gallery: auto-save, reopen and edit, duplicate, delete; persistent storage; **Back up / Restore** file | Make 3 posters, force-close the app, and reopen: they're all there. Make a backup, delete a poster, restore it. |
| **M8** | v1.0 polish: onboarding hint, "randomize whole poster", performance, accessibility, update banner, version shown in About | Full run-through in airplane mode. Tag the `v1.0` release. |

**Later (designed for now, built after v1)**
- **V2 Photo mode:** pick a trip photo (file picker, on the phone only) → downscale → color quantization (k-means) to 4–5 colors mapped onto the current palette → optional edge simplification → lettering and borders on top. Recipe gets `photo:{…}`. The photo is stored in IndexedDB and never uploaded.
- **V3 Trip series:** a "Series" object (name, border style, total count). Posters link to it and get matching borders plus "No. 3 of 7". Uses the border layer from M4/M8.
- **V4 Family touches:** an original small figure of a parent carrying a baby (a simple silhouette layer, placeable) and a date-stamp option in the lettering module.

---

## 4. Phone setup (do these once, before M0)
1. **GitHub app** (Play Store): sign in. You'll use it to review and merge PRs.
2. **Make the repo public** (Chrome → github.com, signed in): repo → **Settings** → scroll to **Danger Zone** → **Change visibility** → **Public** → confirm. (Settings may be under the ⋯ menu on mobile.)
3. **Turn on Pages** (**before merging the M0 PR**; Claude will remind you in the PR and in chat): repo → **Settings** → **Pages** → *Build and deployment* → **Source: GitHub Actions**.
4. **App URL** will be `https://aepibailey.github.io/alpine-postcard-maker/`. Bookmark it in Chrome.
5. **Install**: open the URL in Chrome → ⋮ → **Install app** (or *Add to Home screen*).
6. **Keep data safe**: don't use "Clear browsing data → Cookies and site data" for this site, and make a backup file every so often from the app's Gallery.
7. **Claude Code sessions**: keep using claude.ai/code from your phone (like this session), connected to this repo.
8. *(Optional)* In Chrome → Settings → Site settings → All sites → `aepibailey.github.io` → check that storage is shown and not cleared.

---

## 5. Draft CLAUDE.md (committed in M0)

> Note: the committed `CLAUDE.md` is the source of truth. It refers to "the owner" throughout, including in the Browser Integration section (changed at the owner's request).

```markdown
# Alpine Postcard Maker — Project Guide for Claude

## What this is
An installable, fully offline web app (PWA) for designing original 1930s-style
Alpine travel posters. Hosted on GitHub Pages:
https://aepibailey.github.io/alpine-postcard-maker/

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
- Poster = versioned JSON "recipe" (`src/recipe.js`, with `migrate()`).
  New features add optional fields; never break old recipes.
- Rendering: SVG layers (`src/layers/*`) → canvas for export and textures
  (`src/styles/*`). Colors always come from the active palette (`src/palettes.js`).
- Randomness uses the seeded RNG (`src/rng.js`) so posters re-render identically.
- Storage: IndexedDB (`src/gallery-db.js`) + `navigator.storage.persist()`;
  backup/restore as a single JSON file (`src/backup.js`).
- Export via `navigator.share({ files })`, fallback to download.
- When changing cached files, bump the cache version in `sw.js`.
- The app is served from `/alpine-postcard-maker/`: use **relative paths only**
  (manifest `start_url` and `scope` are `"./"`; register `./sw.js`). Never use
  leading-slash URLs.
- Exports must use the chosen font: embed the `.woff2` as base64 `@font-face`
  in the SVG before rasterizing (fallback: draw lettering on canvas). The
  font-export e2e test must stay green.

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
- Display a clear notification to Shawn: "[Tool: claude-in-chrome] Required but unavailable. Please open Chrome."
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
```

---

## 6. Verification (per milestone and overall)
- **Automated (Claude, cloud container + GitHub Actions):** unit tests for palettes, the seeded RNG, recipe migration, backup round-trip, and a check that there are no leading-slash (absolute) paths in the manifest, service worker or HTML. Playwright at 412×915 checks that:
  - the app loads and controls change the SVG
  - export produces a PNG of the right pixel size, including "match my screen" with an emulated `devicePixelRatio`
  - the gallery persists across reloads
  - the app works with the network blocked (offline test)
  - the app works when served from a `/alpine-postcard-maker/` subpath, matching Pages
  - no audio APIs appear in the code
- **Font-export e2e test:** export the same poster with font A, font B, and a forced system fallback. The lettering region of the exported PNGs must differ from each other and from the fallback render, proving the chosen font was actually used. It is also run offline.
- **Screenshots:** sent to Shawn before each PR is merged.
- **Manual (Shawn, phone):** the milestone checklist above, always including one airplane-mode check.

## Model notes (per Shawn's preference)
- **Opus** is best for M0–M3 (architecture plus the procedural SVG art, where visual judgment matters) and V2 Photo mode.
- **Sonnet** is fine for M4–M8 and V3/V4, which are more routine UI and storage work.
- Research mode isn't needed. The web platform features used are standard and well documented.

---

# V2 Photo mode — detailed plan (in progress): turn your own mountain photos into posters

### Context
v1.0.0 is live. The owner asked to "include the option to turn your own mountain photos into post cards", which is the V2 Photo mode already on the roadmap.

**Owner decisions (this turn):**
- **Colours: offer both.** A switch between two modes:
  - **Poster inks** recolours the photo into the active time-of-day palette.
  - **Photo colours** keeps the photo's own colours, reduced to 4–6 flat inks.
- **Overlays:** lettering and border only. Photo posters use no print styles and no scenery or figures, so the style and scenery pickers are hidden in photo mode.
- **Samples:** public-domain (CC0 / PD) mountain photos for the spike, the tests and the screenshots. The owner's photos never go into the repo.
- **Framing:** drag with one finger, plus a zoom slider.

The model best suited is Opus, because the image processing needs visual judgement. Research mode isn't needed. No AI image generation is involved: everything is done in code on the phone, so the CLAUDE.md image-gen process doesn't apply.

The tag for 1.0.0 is still waiting on the owner ("Not yet").

### Progress (pushed to branch, no PR yet)
- Commit "Photo mode art spike, part 1" (v1.0.1) added:
  - `src/photo/posterize.js`: blur, k-means, majority smoothing, poster and photo inks;
  - `src/photo/photo-poster.js`: crop, lettering inks with contrast, border;
  - `tests/e2e/pages/photo.html` and `scripts/photo-shots.mjs`;
  - a code-made `standin.jpg`;
  - 6 unit tests.
- 60 unit and 37 e2e tests pass.
- The owner is changing Network access via claude.ai/code in Chrome (the mobile app may not show the setting). They will start a **new session** with "continue the photo mode art spike".

### Blocker (network)
- The environment's network policy blocks `commons.wikimedia.org` and `upload.wikimedia.org`.
- The owner chose to allow Wikimedia in the environment settings: title bar → cloud environment → Edit → Network access.
- **First step on resume:** `curl -sS -o /dev/null -w "%{http_code}" https://commons.wikimedia.org/`.
  - If it's reachable, query the Commons API for mountain photos whose `LicenseShortName` is CC0 or Public domain. Pick 3 varied ones:
    - a jagged peak;
    - a broad massif with a lake;
    - a snowy slope at dusk.
  - Download them at 1200px and record their sources in CREDITS.md.
  - If it's still blocked, remind the owner once. Meanwhile build `src/photo/posterize.js` and its unit tests, since they need no photos.

### Phase V2a: art spike. The owner approves the look before any controls are built.
Branch: `claude/alpine-postcard-planning-rqa8hy` already holds part 1 (on top of `main`); continue on it.

- **`src/photo/posterize.js`**: pure functions on `ImageData`-like `{width, height, data}`, testable in Node.
  - `kmeans(pixels, k, rng)`: seeded (`src/rng.js`), run on about 20k sampled pixels in Lab or luminance-weighted RGB, returning the colour centres.
  - `assign(image, centres)`: gives each pixel its nearest centre.
  - `smooth(labels, w, h, radius)`: a majority (mode) filter that removes speckle so the shapes read as flat screen-print areas.
  - `toInks(centres, palette)`: for "Poster inks". Sort the centres by luminance and map them onto the palette's inks, also sorted by luminance: sky light → dark, snow, peak, shadow and ink.
  - `posterize(image, { colors, inks, palette, seed, smoothing })`: returns new RGBA.
- **`scripts/fetch-samples`** is not needed. Instead, 3 CC0/PD mountain photos are added in `tests/fixtures/photos/`, downscaled to 1200px on the long edge, with `tests/fixtures/photos/CREDITS.md` giving the source URL and license for each. If downloads are blocked, fall back to procedurally generated "photos".
- **Spike page** `tests/e2e/pages/photo.html`: loads a fixture and renders the photo poster (posterized raster `<image>` + lettering + border, via a new `photoPoster` branch in `renderPoster`) with query params `photo`, `colors`, `inks`, `time`, `title`.
- **Screenshots** in `docs/screenshots/v2a/`:
  - each photo at 4, 5 and 6 colours;
  - "Poster inks" at alpenglow and night vs "Photo colours".
  - They are sent in chat and embedded in the PR.
- Iterate on smoothing, colour count and ink mapping until the results look like finished 1930s posters.
- The PR is labelled "art spike". **Nothing further is built until the owner approves.**

### Phase V2b: photo mode in the app (after approval)
- **Recipe** (`src/recipe.js`): an optional `photo: { id, x, y, zoom, colors (4–6), inks: 'poster'|'photo', smoothing }`.
  - `normalizeRecipe` validates and clamps it; recipes without `photo` are unchanged.
  - `surpriseRecipe` on a photo poster changes only the time, typeface, placement and colours. It never removes the photo.
- **Storage** (`src/gallery-db.js`):
  - DB version 2 adds a `photos` store `{ id, blob }`.
  - On pick, the photo is downscaled to ≤1600px on the long edge and saved as a JPEG of about 0.85 quality, then stored.
  - Deleting a poster deletes its photo unless another poster (a copy) still uses it.
- **Backup** (`src/backup.js`):
  - `version: 2` adds `photos: [{ id, dataUrl }]`.
  - Restoring a version 1 backup still works.
  - `planRestore` also brings over the missing photos.
  - A size note in the UI says photo backups are bigger.
- **Rendering**:
  - `renderPoster` draws a photo recipe's art layer as an `<image href=posterized PNG data URL>` cropped by x, y and zoom, with lettering and border on top.
  - The preview posterizes at about 600×900 in the editor, cached per settings, so typing doesn't redo the photo.
  - Export posterizes at the target size so it stays sharp, then continues through the existing font-embedding path in `src/export.js`.
  - Fill mode stretches the edges, as today.
- **UI** (`index.html`, `src/editor.js`, a new `src/photo-ui.js`):
  - A "📷 Your photo" button, using `<input type=file accept="image/*">` (Android offers Camera or Photos).
  - While a photo is set:
    - a colours stepper (4–6);
    - a Poster inks / Photo colours switch (the time-of-day picker applies to Poster inks);
    - a zoom slider;
    - drag on the preview to position the photo (swipe-to-change-mountain is off in photo mode);
    - a "Back to drawn mountain" button.
  - Mountain, scenery and print-style pickers are hidden.
  - Gallery thumbnails work unchanged.
- **Privacy:** the photo only ever lives in IndexedDB on the phone and inside the backup file the owner saves. There are no network calls; the unit test that looks for network use gets `photo` files added.
- Bump the version to 2.0.0 (VERSION, CACHE, package.json) and complete PRECACHE with the new `src/photo/*`.

### Tests
- **Unit:**
  - k-means is deterministic with a seed and returns k centres;
  - assign/smooth reduce the number of colours to ≤ k;
  - `toInks` keeps the luminance order;
  - `normalizeRecipe` handles a photo field and clamps bad values;
  - backup v1 and v2 both parse;
  - `planRestore` includes photos.
- **E2E (412×915):**
  - pick a fixture photo via `setInputFiles`, and the preview shows the photo poster;
  - the colour count changes the number of distinct colours in the image;
  - the inks switch works;
  - drag and zoom move the crop;
  - after a reload the photo poster is still there (IndexedDB);
  - export: the wallpaper PNG has the right size, and the font-export test stays green;
  - a backup → delete → restore round-trip brings back the photo;
  - offline: pick and render with the network blocked;
  - axe finds no serious issues.
- **Screenshots** in `docs/screenshots/v2b/`.

### Verification
- `npm test` and `npm run e2e` pass locally, then CI is green on the PR.
- Screenshots are reviewed by eye and sent in chat.
- **Owner's phone checklist:**
  - pick one of your own mountain photos;
  - try 4, 5 and 6 colours and both colour modes;
  - drag and zoom it;
  - add a title;
  - save a wallpaper;
  - reopen it from the Gallery;
  - try airplane mode;
  - make a backup.
