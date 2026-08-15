# قرآن — آية بآية | Quran — Ayah by Ayah

A super-light Chrome extension (Manifest V3) that shows **one Quran verse at a time** in the toolbar popup, so you can read in the small pockets of free time during the day. Fully offline, fully RTL Arabic, and it always remembers exactly where you stopped.

![reading view](store/screenshots/screenshot-1-reading.png)

## The idea

Open the popup → read an ayah in the KFGQPC Uthman Taha Naskh typeface → tap **التالية/السابقة** to move verse by verse (crossing surah boundaries automatically) → close the browser whenever; your position is saved locally on every navigation. A modal picker lets you jump to any surah (search by name or number) and any ayah (search by number or by **bare Arabic text without tashkeel** — typing `الرحمن` finds `ٱلرَّحْمَٰنِ`). The **أ+ / أ−** buttons in the header set the ayah text size (16–44 px, 2 px steps) with the current value shown between them; the choice is saved alongside the position. The **؟** button opens a dialog listing every keyboard shortcut.

Principles: no framework, no build step, no background worker, no network at runtime, and only one permission (`storage`). The full Quran text (6,236 ayahs) and the font are bundled; only the ~30 KB index plus the current surah are loaded per popup open.

## Features, screen by screen

The screenshot above is the reading view: one ayah centred in the card, the surah
name, the ayah-of-total, and the juz across the header, and **التالية / السابقة**
in the footer. Navigation crosses surah boundaries on its own, and every move is
saved, so closing the browser mid-surah costs you nothing.

### Jump to any surah or ayah — and search without tashkeel

![the verse picker open, showing results for a search typed in plain Arabic](store/screenshots/screenshot-2-picker.png)

The two footer buttons open pickers: one for the surah, one for the ayah. Both
accept a name or a number, and the ayah picker also searches **verse text typed
the ordinary way** — no tashkeel, no hamza seats, `ة` or `ه`, either is fine. The
shot shows `على كل شيء قدير` matching six ayahs of al-Baqarah whose text is fully
vocalised (`عَلَىٰ كُلِّ شَىْءٍ قَدِيرٌ`). Results wrap to two lines so you can tell
similar verses apart, and the search box only appears for surahs longer than 20
ayahs, where it earns its place.

### Set the text size you actually read at

![the popup with the ayah rendered at a large font size](store/screenshots/screenshot-3-font-size.png)

The **أ+ / أ−** buttons in the header step the ayah between 16 and 44 px, and the
current value sits between them so you always know where you are. The two alef
glyphs are drawn at different sizes, so the buttons say what they change. Your
choice is stored next to your reading position and restored on the next open; the
ayah-number marker scales with the text, and long ayahs scroll inside the card.

### Read without touching the mouse

![the keyboard shortcuts dialog listing every binding](store/screenshots/screenshot-4-shortcuts.png)

The **؟** button opens this dialog, which is the one place the shortcut list is
written for the reader. Arrows follow direction of travel rather than
next/previous — in an RTL layout forward is leftward, which is where التالية
sits. **Space** is the "read on" key: it pages down a long ayah first and moves
to the next ayah only once you have reached the end, so one key carries you
through the whole text. See the [full table](#keyboard-shortcuts) below.

### Offline, and it stays that way

![the popup showing an ayah from surah al-Kahf alongside the privacy points](store/screenshots/screenshot-5-offline.png)

All 6,236 ayahs and both font files ship inside the extension, so there is no
network request at runtime — not on first open, not ever. The single permission
is `storage`, used only for your reading position and font size, both local to
the device. No accounts, no analytics, no ads.

## Folder structure

| Path | What it is |
|---|---|
| `manifest.json` | MV3 manifest: action popup, `storage` permission, icons. Nothing else — by design. |
| `popup.html` | The popup shell (`dir="rtl" lang="ar"`): header (surah / ayah-of-total / juz / font-size stepper / help button), verse card, footer nav with the two picker triggers, and the static shortcuts dialog. |
| `css/popup.css` | All styling: bundled `@font-face` for KFGQPC Uthman Taha Naskh, 420×420 rounded popup, green/white palette, modal picker styles, the header font-size stepper, and the shortcuts dialog. Ayah size flows from the `--ayah-font-size` custom property on `body`. |
| `js/popup.js` | Entry point. Holds current position and font size, renders header/verse/pickers, navigation logic, the font-size stepper, the shortcuts dialog, every keyboard binding, and calls save on each move. |
| `js/data.js` | Lazy data layer: loads the surah index once and surah files on demand (memoized); juz lookup; skips the decorative `verse_0` bismillah. |
| `js/storage.js` | Reading position **and font-size preference** via `chrome.storage.local`, with a `localStorage` fallback so the popup also runs as a plain web page (dev/testing). Owns the font-size bounds (`MIN`/`MAX`/`STEP`) and `clampFontSize`. |
| `js/dropdown.js` | The reusable picker: trigger button + in-popup modal with optional debounced search and scrollable list. |
| `js/arabic.js` | Tashkeel-insensitive search normalization (see the ⚠️ bidi warning inside before editing its regexes). |
| `data/` | Bundled Quran text: `surah-index.json` (114 surah metadata + juz ranges) and `surah/surah_1..114.json` (verse text). Source: [semarketir/quranjson](https://github.com/semarketir/quranjson). |
| `fonts/` | **Primary** KFGQPC Uthman Taha Naskh v2.0 — source `UthmanTN_v2-0.ttf` (build input only) plus the shipped `uthman-taha-naskh.woff2` (57 KB). Source: [King Fahd Glorious Quran Printing Complex](https://fonts.qurancomplex.gov.sa/nashkh-font/). **Fallback** Amiri Quran v19 woff2 (arabic + latin subsets, 58 KB) — see the font note below. |
| `icons/` | Extension icons 16/32/48/128, generated (anti-aliased crescent). |
| `scripts/` | Build-time only, never shipped: `fetch-data.mjs` (download Quran JSON), `convert-font.py` (Uthman Taha TTF → woff2), `fetch-font.mjs` (re-download the Amiri Quran fallback subsets), `make-icons.py` (regenerate icons), `make-screenshots.mjs` (regenerate the store screenshots), `package.mjs` (build + verify the store zip). |
| `test/e2e.mjs` | 54-check end-to-end suite driving the popup in headless Chrome via the DevTools Protocol (no dependencies). Run instructions in the file header and in `updates/`. |
| `store/` | Chrome Web Store kit: `LISTING.md` (ready-to-paste dashboard texts), `PRIVACY.md`, `screenshots/` (five 1280×800 PNGs), `stage.html` (the multi-scene screenshot backdrop). |
| `dist/` | Built submission zip (`node scripts/package.mjs`). |
| `plans/` | Approved implementation plans, kept in-repo as project history. |
| `updates/` | Dated deep-dive documents (changes + architecture) for onboarding developers/agents — start with the newest file. |

## Fonts

The ayah typeface is **KFGQPC Uthman Taha Naskh v2.0**, published by the
[King Fahd Glorious Quran Printing Complex](https://fonts.qurancomplex.gov.sa/nashkh-font/)
(Madinah) — the same Naskh hand used in the Mushaf al-Madinah. We bundle the
distributed `UthmanTN_v2-0.ttf` and convert it to woff2 at build time:

```bash
python3 scripts/convert-font.py   # needs: pip install fonttools brotli
```

Only the woff2 is shipped (`scripts/package.mjs` excludes `fonts/*.ttf`), so the
extension still makes zero network requests at runtime.

**Why Amiri Quran is still bundled.** This face has no glyphs for alef wasla
(U+0671) or the Quranic waqf / small-high marks (U+06D6–U+06ED), which occur in
**92.5% of the 6,236 Uthmani ayahs** in `data/`. Uthman Taha is therefore listed
*first* in the stack with Amiri Quran immediately after it; browsers fall back
per character, so Amiri supplies only those missing marks. Without it they
render as tofu. Measured with `CSS.getPlatformFontsForNode` on the worst-case ayahs
(2:196, 2:177, 4:12), Uthman Taha paints ~90% of the glyphs and Amiri only the
missing marks. If you ever swap in **KFGQPC Uthmanic Script HAFS** (the Quranic
sibling, full mark coverage) the Amiri fallback can be dropped entirely.

## Keyboard shortcuts

Bound in `js/popup.js` and mirrored in the **؟** dialog, which is the single
place the list is written for the user.

| Key | Action |
|---|---|
| `←` | Next ayah — the arrows follow **direction of travel**, and in an RTL layout forward is leftward, which is where التالية sits |
| `→` | Previous ayah |
| `Space` | **Read on**: pages down through a long ayah, then moves to the next ayah once its end is in view. On an ayah that fits the card, the first press navigates. Inert while a button has focus, where the browser already uses Space to press it |
| `↑` / `↓` | Scroll within a long ayah, one line per press; inert when the card does not overflow |
| `+` / `-` | Grow / shrink the ayah text |
| `Esc` | Close the open dialog |
| `؟` / `?` | Open the shortcuts dialog |

Moving to a new ayah always resets the card to its first line. Every shortcut
stands down while a picker or the help dialog is open, so nothing navigates
behind an open modal.

## Development

```bash
# Load in Chrome: chrome://extensions → Developer mode → Load unpacked → this folder

# Run it as a plain page (storage/data fall back to web APIs):
python3 -m http.server 8749   # then open http://127.0.0.1:8749/popup.html

# E2E tests (needs Chrome + Node ≥22): see test/e2e.mjs header

# Regenerate the store screenshots (starts its own server + headless Chrome):
node scripts/make-screenshots.mjs   # → store/screenshots/*.png

# Package for the store:
node scripts/package.mjs            # → dist/one-quran-v<version>.zip
```

The screenshots render the **live popup** inside `store/stage.html`'s iframe, one
scene per shot, so they cannot drift from the shipped UI. Re-run the script
after any visual change; scene copy and popup state live side by side in
`store/stage.html` (`SCENES`) and `scripts/make-screenshots.mjs` (`SCENES`).

## Future work / known issues

- **Verse picker rebuild**: `renderVerseDropdown` runs on every navigation; it only needs to run when the surah changes. Cheap today, but the easiest perf win.
- **Search recall vs precision**: deleting all alef forms (needed for Uthmani↔modern matching) admits some false positives, and the standalone hamza is *not* stripped — so `الذين امنوا` finds **nothing**, because the text spells it `ءَامَنُوا۟`. A mapping table that folds `ءا` → `ا` would fix that class of miss.
- **Highlight the current ayah** in the verse picker and scroll it into view when opened.
- **`chrome.storage.sync`** for the position, so reading continues across the user's devices (mind sync quota/rate limits).
- **Juz-based navigation** — the data already carries juz ranges; a third picker or a juz badge jump would be natural.
- **Bookmarks / multiple positions** (e.g., a personal wird plus casual reading).
- **Options page**: theme (a dark variant of the green palette). Font size already ships as the header stepper.
- **i18n via `_locales`** if a non-Arabic listing is ever wanted (UI itself stays Arabic by design).
- **CI**: run `test/e2e.mjs` headlessly on push; the harness needs no dependencies.
- **Rounded corners** are CSS-side only; the outer popup window frame belongs to Chrome/the OS (already rounded on macOS).
- Audio, tafsir, and translations are **intentionally out of scope** — the source repo has audio, but this extension is text-only by requirement.

## Privacy

No data collection, no analytics, no network requests. The only stored values are the last-read surah/ayah and the chosen font size, both kept locally on the device. See `store/PRIVACY.md`.
