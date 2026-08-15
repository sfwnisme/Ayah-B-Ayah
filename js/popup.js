import {
  loadIndex,
  loadSurah,
  getAyahKeys,
  getAyahText,
  getJuz,
} from "./data.js";
import {
  getPosition,
  savePosition,
  getFontSize,
  saveFontSize,
  clampFontSize,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  FONT_SIZE_STEP,
} from "./storage.js";
import { createDropdown } from "./dropdown.js";
import { normalizeArabic } from "./arabic.js";

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
function toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => ARABIC_DIGITS[d]);
}

const surahNameEl = document.getElementById("surah-name");
const ayahCountEl = document.getElementById("ayah-count");
const juzNumberEl = document.getElementById("juz-number");
const ayahTextEl = document.getElementById("ayah-text");
const ayahCardEl = document.querySelector(".ayah-card");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const fontSmallerBtn = document.getElementById("font-smaller-btn");
const fontLargerBtn = document.getElementById("font-larger-btn");
const fontSizeValueEl = document.getElementById("font-size-value");
const helpBtn = document.getElementById("help-btn");
const helpOverlay = document.getElementById("help-overlay");
const helpCloseBtn = document.getElementById("help-close-btn");

let surahIndex = []; // array of surah metadata, 0-indexed by (number - 1)
let currentSurah = 1;
let currentAyah = 1;
let currentSurahData = null; // cached parsed surah_N.json
let fontSize = null; // px; hydrated from storage in init()

const surahDropdown = createDropdown({
  container: document.getElementById("surah-dropdown-container"),
  showSearch: true,
  searchPlaceholder: "بحث بالاسم أو الرقم…",
  onSelect: (surahNumber) => goTo(surahNumber, 1),
});

let verseDropdown = null;

function surahMeta(n) {
  return surahIndex[n - 1];
}

function renderSurahDropdownItems() {
  const items = surahIndex.map((meta) => {
    const n = Number(meta.index);
    return {
      value: n,
      label: `${toArabicDigits(n)}. ${meta.titleAr}`,
      searchText: `${normalizeArabic(meta.titleAr)}${n}`.toLowerCase(),
    };
  });
  surahDropdown.setItems(items);
}

function renderVerseDropdown(surah, meta) {
  const container = document.getElementById("verse-dropdown-container");
  verseDropdown?.destroy(); // remove the previous picker's overlay from <body>
  container.innerHTML = "";
  const count = Number(meta.count);
  verseDropdown = createDropdown({
    container,
    showSearch: count > 20,
    searchPlaceholder: "بحث بالرقم أو النص…",
    title: "اختر الآية",
    wrapItems: true,
    onSelect: (ayahNumber) => goTo(currentSurah, ayahNumber),
  });
  const keys = getAyahKeys(surah);
  const items = keys.map((key) => {
    const n = Number(key.slice(6));
    const text = getAyahText(surah, n);
    return {
      value: n,
      label: `${toArabicDigits(n)}. ${text}`,
      searchText: `${normalizeArabic(text)}${n}`.toLowerCase(),
    };
  });
  verseDropdown.setItems(items);
}

async function render() {
  const meta = surahMeta(currentSurah);
  currentSurahData = await loadSurah(currentSurah);

  surahNameEl.textContent = meta.titleAr;
  ayahCountEl.textContent = `الآية ${toArabicDigits(currentAyah)} من ${toArabicDigits(meta.count)}`;
  const juz = getJuz(meta, currentAyah);
  juzNumberEl.textContent = juz ? `الجزء ${toArabicDigits(juz)}` : "";

  ayahTextEl.textContent = `${getAyahText(currentSurahData, currentAyah)} `;
  const inlineMarker = document.createElement("span");
  inlineMarker.className = "ayah-marker";
  inlineMarker.textContent = `﴿${toArabicDigits(currentAyah)}﴾`;
  ayahTextEl.appendChild(inlineMarker);
  // a new ayah always starts from its first line — "instant" cancels any
  // smooth scroll still animating from the press that brought us here
  ayahCardEl.scrollTo({ top: 0, behavior: "instant" });

  surahDropdown.setLabel(`${toArabicDigits(currentSurah)}. ${meta.titleAr}`);
  renderVerseDropdown(currentSurahData, meta);
  verseDropdown.setLabel(`${toArabicDigits(currentAyah)}`);

  prevBtn.disabled = currentSurah === 1 && currentAyah === 1;
  nextBtn.disabled = currentSurah === 114 && currentAyah === Number(meta.count);

  await savePosition({ surah: currentSurah, ayah: currentAyah });
}

// Applies `fontSize` to the CSS custom property the ayah reads, and reflects
// the clamp on the buttons. Kept separate from render() so resizing never
// re-fetches the surah or rebuilds the verse picker.
function applyFontSize() {
  document.body.style.setProperty("--ayah-font-size", `${fontSize}px`);
  fontSmallerBtn.disabled = fontSize <= MIN_FONT_SIZE;
  fontLargerBtn.disabled = fontSize >= MAX_FONT_SIZE;
  fontSizeValueEl.textContent = toArabicDigits(fontSize);
  // hovering either button reports the size it is moving away from
  const current = `حجم الخط ${toArabicDigits(fontSize)}`;
  fontSmallerBtn.title = `تصغير — ${current}`;
  fontLargerBtn.title = `تكبير — ${current}`;
}

async function changeFontSize(delta) {
  const next = clampFontSize(fontSize + delta);
  if (next === fontSize) return;
  fontSize = next;
  applyFontSize();
  await saveFontSize(fontSize);
}

async function goTo(surah, ayah) {
  currentSurah = surah;
  currentAyah = ayah;
  await render();
}

async function goNext() {
  const meta = surahMeta(currentSurah);
  if (currentAyah < Number(meta.count)) {
    await goTo(currentSurah, currentAyah + 1);
  } else if (currentSurah < 114) {
    await goTo(currentSurah + 1, 1);
  }
}

async function goPrev() {
  if (currentAyah > 1) {
    await goTo(currentSurah, currentAyah - 1);
  } else if (currentSurah > 1) {
    const prevMeta = surahMeta(currentSurah - 1);
    await goTo(currentSurah - 1, Number(prevMeta.count));
  }
}

prevBtn.addEventListener("click", goPrev);
nextBtn.addEventListener("click", goNext);
fontSmallerBtn.addEventListener("click", () => changeFontSize(-FONT_SIZE_STEP));
fontLargerBtn.addEventListener("click", () => changeFontSize(FONT_SIZE_STEP));

// True when the bottom of the ayah is in view — including the common case of a
// short ayah that never overflows. The 2px tolerance absorbs the fractional
// scrollHeight Chrome reports at some zoom levels and font sizes.
function ayahCardIsAtEnd() {
  return (
    ayahCardEl.scrollTop + ayahCardEl.clientHeight >= ayahCardEl.scrollHeight - 2
  );
}

function openHelp() {
  helpOverlay.hidden = false;
  helpCloseBtn.focus();
}

function closeHelp() {
  if (helpOverlay.hidden) return;
  helpOverlay.hidden = true;
  helpBtn.focus();
}

// An open modal owns the keyboard (the pickers run their own capturing
// handler), so the reader shortcuts must stand down rather than navigate the
// ayah behind it.
function modalIsOpen() {
  return (
    !helpOverlay.hidden ||
    [...document.querySelectorAll(".picker-overlay")].some((o) => !o.hidden)
  );
}

helpBtn.addEventListener("click", openHelp);
helpCloseBtn.addEventListener("click", closeHelp);
helpOverlay.addEventListener("click", (e) => {
  if (e.target === helpOverlay) closeHelp(); // backdrop click, like the pickers
});

document.addEventListener("keydown", (e) => {
  // Escape closes the help dialog first, before the guard below stands down
  if (e.key === "Escape" && !helpOverlay.hidden) {
    closeHelp();
    return;
  }
  if (e.target.tagName === "INPUT" || modalIsOpen()) return;
  if (e.key === "?" || e.key === "؟") {
    e.preventDefault();
    openHelp();
    return;
  }
  // Arrows are bound strictly to direction of travel, not to next/previous:
  // the interface is RTL, so the LEFT arrow moves left on screen — which is
  // FORWARD (التالية) — and the RIGHT arrow moves right, i.e. back (السابقة).
  // This is exactly where the two nav buttons sit, so the keys mirror them.
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    goNext();
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    goPrev();
  }
  // Up/Down scroll within a long ayah rather than moving between ayahs. The
  // card only overflows at larger sizes, so on a short ayah these are inert.
  // One step is one line (line-height is 2 in the stylesheet).
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const line = fontSize * 2;
    ayahCardEl.scrollBy({
      top: e.key === "ArrowDown" ? line : -line,
      behavior: "smooth",
    });
  }
  // Space is the single "read on" key: it pages down through a long ayah and,
  // once the end is in view, moves to the next ayah. On an ayah that fits, the
  // card is already at its end, so the first press navigates. Skipped while a
  // button has focus, where the browser already uses Space to press it —
  // otherwise one press would both click the button and advance.
  if (e.key === " " && e.target.tagName !== "BUTTON") {
    e.preventDefault(); // also stops Space from scrolling the page itself
    if (ayahCardIsAtEnd()) {
      goNext();
    } else {
      // a page at a time, keeping one line of overlap so no line is skipped
      ayahCardEl.scrollBy({
        top: ayahCardEl.clientHeight - fontSize * 2,
        behavior: "smooth",
      });
    }
  }
  // "=" is the unshifted "+" key; Chrome's own zoom uses Ctrl/Cmd, so plain
  // presses are free for us to take.
  if (e.key === "+" || e.key === "=") changeFontSize(FONT_SIZE_STEP);
  if (e.key === "-" || e.key === "_") changeFontSize(-FONT_SIZE_STEP);
});

async function init() {
  surahIndex = await loadIndex();
  renderSurahDropdownItems();

  fontSize = await getFontSize();
  applyFontSize();

  const position = await getPosition();
  currentSurah = position.surah;
  currentAyah = position.ayah;

  await render();
}

init();
