// E2E suite: modal picker, tashkeel-insensitive search, bundled font, the
// font-size stepper, keyboard shortcuts, the help dialog, and
// navigation/persistence regressions. 54 checks, no dependencies (Node >= 22).
//
// How to run (three terminals or background the first two):
//   1. Serve the extension dir (storage.js/data.js fall back to web APIs):
//        python3 -m http.server 8749 --bind 127.0.0.1
//   2. Headless Chrome with CDP — use a FRESH profile dir, the "initial ayah"
//      check expects no previously saved position:
//        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
//          --headless=new --remote-debugging-port=9224 \
//          --user-data-dir=/tmp/oq-test-profile about:blank
//   3. node test/e2e.mjs   → expect "ALL PASS"
const DEBUG_PORT = 9224;
const PAGE_URL = "http://127.0.0.1:8749/popup.html";

const tab = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${PAGE_URL}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((r) => pending.set(id, r));
}
async function evaluate(expr) {
  const res = await send("Runtime.evaluate", { expression: `(() => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  ${pass ? "" : `→ got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

await send("Page.enable");
await sleep(1500);

// ---- font: the bundled KFGQPC Uthman Taha Naskh must be loaded and applied
const fontLoaded = await evaluate(`
  return document.fonts.ready.then(() => document.fonts.check('24px "KFGQPC Uthman Taha Naskh"'));
`);
check("KFGQPC Uthman Taha Naskh font loaded", fontLoaded, true);

// ---- regression: initial state
check("initial ayah", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ١ من ٧");

// ---- surah modal: open, search WITHOUT tashkeel and with ه instead of ة
await evaluate(`document.querySelector("#surah-dropdown-container .dropdown-trigger").click()`);
await sleep(150);
check("surah overlay opens", await evaluate(`return [...document.querySelectorAll(".picker-overlay")].some(o => !o.hidden)`), true);
check("open overlay visually rendered", await evaluate(`return getComputedStyle(document.querySelector(".picker-overlay:not([hidden])")).display`), "flex");
check("other overlay visually hidden", await evaluate(`return [...document.querySelectorAll(".picker-overlay[hidden]")].every(o => getComputedStyle(o).display === "none")`), true);
check("search focused on open", await evaluate(`return document.activeElement.className`), "picker-search");
await evaluate(`
  const inp = document.querySelector(".picker-overlay:not([hidden]) .picker-search");
  inp.value = "الفاتحه";
  inp.dispatchEvent(new Event("input"));
`);
await sleep(250);
check("surah bare-search 'الفاتحه' finds الفاتحة", await evaluate(`return [...document.querySelectorAll(".picker-overlay:not([hidden]) .picker-item")].map(li => li.textContent)`), ["١. الفاتحة"]);

// Escape closes
await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`);
await sleep(100);
check("Escape closes modal", await evaluate(`return [...document.querySelectorAll(".picker-overlay")].every(o => o.hidden)`), true);
check("closed overlays visually gone", await evaluate(`return [...document.querySelectorAll(".picker-overlay")].every(o => getComputedStyle(o).display === "none")`), true);

// ---- jump to surah 2 via search "2"
await evaluate(`document.querySelector("#surah-dropdown-container .dropdown-trigger").click()`);
await sleep(100);
await evaluate(`
  const inp = document.querySelector(".picker-overlay:not([hidden]) .picker-search");
  inp.value = "٢";
  inp.dispatchEvent(new Event("input"));
`);
await sleep(250);
await evaluate(`[...document.querySelectorAll(".picker-overlay:not([hidden]) .picker-item")].find(li => li.textContent === "٢. البقرة").click()`);
await sleep(250);
check("Arabic-digit surah search + select → البقرة", await evaluate(`return document.getElementById("surah-name").textContent`), "البقرة");

// ---- verse modal on surah 2: bare-Arabic text search (2:30 وَإِذْ قَالَ رَبُّكَ)
await evaluate(`document.querySelector("#verse-dropdown-container .dropdown-trigger").click()`);
await sleep(150);
await evaluate(`
  const inp = document.querySelector(".picker-overlay:not([hidden]) .picker-search");
  inp.value = "واذ قال ربك للملايكه";
  inp.dispatchEvent(new Event("input"));
`);
await sleep(300);
const bareResults = await evaluate(`return [...document.querySelectorAll(".picker-overlay:not([hidden]) .picker-item")].map(li => li.textContent.slice(0, 12))`);
console.log("   bare verse search results:", bareResults);
check("bare-Arabic verse search finds 2:30", bareResults.length >= 1 && bareResults[0].startsWith("٣٠."), true);
check("verse items use two-line wrap", await evaluate(`return document.querySelector(".picker-overlay:not([hidden]) .picker-item").classList.contains("two-line")`), true);
await evaluate(`document.querySelector(".picker-overlay:not([hidden]) .picker-item").click()`);
await sleep(250);
check("selecting result navigates to 2:30", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ٣٠ من ٢٨٦");

// ---- backdrop click closes
await evaluate(`document.querySelector("#verse-dropdown-container .dropdown-trigger").click()`);
await sleep(100);
await evaluate(`document.querySelector(".picker-overlay:not([hidden])").click()`);
await sleep(100);
check("backdrop click closes", await evaluate(`return [...document.querySelectorAll(".picker-overlay")].every(o => o.hidden)`), true);

// ---- ✕ button closes
await evaluate(`document.querySelector("#verse-dropdown-container .dropdown-trigger").click()`);
await sleep(100);
await evaluate(`document.querySelector(".picker-overlay:not([hidden]) .picker-close").click()`);
await sleep(100);
check("close button closes", await evaluate(`return [...document.querySelectorAll(".picker-overlay")].every(o => o.hidden)`), true);

// ---- small surah 103: no search input, title instead; no overlay leak after many renders
await evaluate(`localStorage.setItem("position", JSON.stringify({surah:103, ayah:1}))`);
await send("Page.reload");
await sleep(1800);
for (let i = 0; i < 3; i++) { await evaluate(`document.getElementById("next-btn").click()`); await sleep(120); }
check("no overlay leak after renders (2 pickers)", await evaluate(`return document.querySelectorAll(".picker-overlay").length`), 2);
await evaluate(`document.querySelector("#verse-dropdown-container .dropdown-trigger").click()`);
await sleep(100);
check("surah 104 few verses → no search input", await evaluate(`return !!document.querySelector(".picker-overlay:not([hidden]) .picker-search")`), false);
check("title shown instead", await evaluate(`return document.querySelector(".picker-overlay:not([hidden]) .picker-title")?.textContent`), "اختر الآية");
await evaluate(`document.querySelector(".picker-overlay:not([hidden]) .picker-close").click()`);

// ---- font size: buttons resize the ayah, clamp at both ends, and persist
const ayahPx = `return parseFloat(getComputedStyle(document.getElementById("ayah-text")).fontSize)`;
check("default ayah font size", await evaluate(ayahPx), 24);
// the buttons must name what they resize, at two visibly different sizes
check("buttons carry the أ size glyph", await evaluate(`return [...document.querySelectorAll(".fs-glyph")].map(g => g.textContent)`), ["أ", "أ"]);
check("glyphs differ in size", await evaluate(`
  const [small, large] = [".fs-glyph-small", ".fs-glyph-large"].map(s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize));
  return large > small + 4;
`), true);
check("title reports the current size", await evaluate(`return document.getElementById("font-larger-btn").title`), "تكبير — حجم الخط ٢٤");
await evaluate(`document.getElementById("font-larger-btn").click()`);
await sleep(80);
check("+ grows the ayah by one step", await evaluate(ayahPx), 26);
await evaluate(`document.getElementById("font-smaller-btn").click(); document.getElementById("font-smaller-btn").click()`);
await sleep(80);
check("− shrinks the ayah", await evaluate(ayahPx), 22);
check("marker scales with the ayah", await evaluate(`return parseFloat(getComputedStyle(document.querySelector(".ayah-marker")).fontSize)`), 22 * 0.67);
// clamp: 20 more clicks in each direction must stop at MAX/MIN, not run away
await evaluate(`for (let i = 0; i < 20; i++) document.getElementById("font-larger-btn").click()`);
await sleep(200);
check("clamps at max", await evaluate(ayahPx), 44);
check("+ disabled at max", await evaluate(`return document.getElementById("font-larger-btn").disabled`), true);
await evaluate(`for (let i = 0; i < 20; i++) document.getElementById("font-smaller-btn").click()`);
await sleep(200);
check("clamps at min", await evaluate(ayahPx), 16);
check("− disabled at min", await evaluate(`return document.getElementById("font-smaller-btn").disabled`), true);
await evaluate(`document.getElementById("font-larger-btn").click()`);
await sleep(80);
await send("Page.reload");
await sleep(1800);
check("font size persists across reload", await evaluate(ayahPx), 18);
// a corrupt stored value must not render the ayah unreadable
await evaluate(`localStorage.setItem("fontSize", "999")`);
await send("Page.reload");
await sleep(1800);
check("out-of-range stored size is clamped", await evaluate(ayahPx), 44);
await evaluate(`localStorage.removeItem("fontSize")`);

// ---- keyboard: RTL arrows follow direction of travel, Space advances
const press = (key, target = "document") =>
  evaluate(`${target}.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, bubbles: true }))`);
await evaluate(`localStorage.setItem("position", JSON.stringify({surah:2, ayah:10}))`);
await send("Page.reload");
await sleep(1800);
await press("ArrowLeft");
await sleep(200);
check("ArrowLeft (leftward = forward in RTL) → next ayah", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ١١ من ٢٨٦");
await press("ArrowRight");
await sleep(200);
check("ArrowRight (rightward = back in RTL) → previous ayah", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ١٠ من ٢٨٦");
await press(" ");
await sleep(200);
check("Space on a short ayah → next ayah", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ١١ من ٢٨٦");
// Space on a focused button must press the button, not also advance
await press(" ", `document.getElementById("font-larger-btn")`);
await sleep(200);
check("Space on a button does not advance", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ١١ من ٢٨٦");
// and no shortcut may act behind an open picker
await evaluate(`document.querySelector("#surah-dropdown-container .dropdown-trigger").click()`);
await sleep(150);
await press("ArrowLeft");
await press(" ");
await sleep(200);
check("shortcuts inert while a picker is open", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ١١ من ٢٨٦");
await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`);
await sleep(150);

// ---- Up/Down scroll a long ayah instead of navigating (2:282, largest ayah)
await evaluate(`localStorage.setItem("position", JSON.stringify({surah:2, ayah:282})); localStorage.setItem("fontSize", "24")`);
await send("Page.reload");
await sleep(1800);
check("long ayah overflows its card", await evaluate(`const c = document.querySelector(".ayah-card"); return c.scrollHeight > c.clientHeight`), true);
await press("ArrowDown");
await sleep(500);
check("ArrowDown scrolls the ayah card", await evaluate(`return document.querySelector(".ayah-card").scrollTop > 0`), true);
check("ArrowDown did not change ayah", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ٢٨٢ من ٢٨٦");
await press("ArrowUp");
await sleep(500);
check("ArrowUp scrolls back to the top", await evaluate(`return document.querySelector(".ayah-card").scrollTop`), 0);

// ---- Space on a long ayah: pages down first, navigates only at the end
await press(" ");
await sleep(600);
check("Space pages down a long ayah", await evaluate(`return document.querySelector(".ayah-card").scrollTop > 0`), true);
check("Space did not navigate while scrolling", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ٢٨٢ من ٢٨٦");
// keep pressing until it stops scrolling and moves on; count the presses so a
// regression that navigates immediately (pressCount === 1) is caught too
let pressCount = 1; // the press above
let ayahAfter = "";
for (let i = 0; i < 40; i++) {
  await press(" ");
  pressCount++;
  await sleep(200);
  ayahAfter = await evaluate(`return document.getElementById("ayah-count").textContent`);
  if (ayahAfter !== "الآية ٢٨٢ من ٢٨٦") break;
}
console.log(`   presses to page through 2:282 and advance: ${pressCount}`);
check("Space at the end navigates to the next ayah", ayahAfter, "الآية ٢٨٣ من ٢٨٦");
check("it paged rather than jumping straight on", pressCount > 2, true);
check("the new ayah starts at its first line", await evaluate(`return document.querySelector(".ayah-card").scrollTop`), 0);

// ---- help dialog: ? opens it, it lists the shortcuts, Escape closes
check("help hidden by default", await evaluate(`return document.getElementById("help-overlay").hidden`), true);
await evaluate(`document.getElementById("help-btn").click()`);
await sleep(150);
check("? button opens help", await evaluate(`return !document.getElementById("help-overlay").hidden`), true);
check("help lists every shortcut", await evaluate(`return document.querySelectorAll("#help-overlay .help-list dt").length`), 7);
const ayahBeforeHelp = await evaluate(`return document.getElementById("ayah-count").textContent`);
check("shortcuts inert while help is open", await evaluate(`
  document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
  return document.getElementById("ayah-count").textContent;
`), ayahBeforeHelp);
await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
await sleep(150);
check("Escape closes help", await evaluate(`return document.getElementById("help-overlay").hidden`), true);
await press("؟");
await sleep(150);
check("؟ key opens help", await evaluate(`return !document.getElementById("help-overlay").hidden`), true);
await evaluate(`document.getElementById("help-close-btn").click()`);
await sleep(150);
check("close button closes help", await evaluate(`return document.getElementById("help-overlay").hidden`), true);

// ---- regression: boundary + persistence
await evaluate(`localStorage.setItem("position", JSON.stringify({surah:114, ayah:6}))`);
await send("Page.reload");
await sleep(1800);
check("next disabled at 114:6", await evaluate(`return document.getElementById("next-btn").disabled`), true);
check("position restored", await evaluate(`return document.getElementById("ayah-count").textContent`), "الآية ٦ من ٦");

console.log(results.every(Boolean) ? "\nALL PASS" : "\nSOME FAILED");
ws.close();
