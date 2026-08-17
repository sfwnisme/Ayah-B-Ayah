// Records the animated demos in store/demo/ — one GIF per script below.
// Build-time only, never shipped.
//
//   node scripts/make-gifs.mjs                    # all demos
//   node scripts/make-gifs.mjs browser-reading    # just one, by key
//   DEMO_TRACE=1 node scripts/make-gifs.mjs reading   # log every step's
//     resulting position and where each click actually landed — the way to tell
//     a dropped input apart from a demo that scripted the wrong step
//
// Like make-screenshots.mjs, it starts its own static server and headless
// Chrome and drives the REAL popup over the DevTools protocol, so a demo can
// never drift from the shipped UI. Every step is a genuine mouse click or key
// press dispatched into the page; the pointer and the key badge are the only
// things drawn on top, because a headless capture has no visible cursor.
//
// Two scenes (see SCENES): `popup` records popup.html on its own, `browser`
// records store/browser.html — a browser window where the popup is opened from
// the toolbar button, closed, and reopened, which is the only way to show that
// reopening returns to the same ayah.
//
// Frames are captured on a wall-clock loop and handed to ffmpeg through a
// concat list with per-frame durations, so the GIF plays back at the same
// speed the script ran at, however slow an individual capture was.
// Needs: Chrome, Node >= 22, python3, ffmpeg. No npm dependencies.
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "store", "demo");
// scratch space lives outside the repo, so a run leaves the working tree with
// nothing in it but the gifs themselves
const WORK_DIR = path.join(tmpdir(), "ayah-gif-frames");
const PORT = 8752;
const DEBUG_PORT = 9227;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = path.join(tmpdir(), "ayah-gif-profile");

const POPUP_W = 420; // must match the body size in css/popup.css
const POPUP_H = 420;
const CAPTURE_MS = 90; // ~11 fps of source frames
const FPS = 12; // gif frame rate

// ---------------------------------------------------------------------------
// the scenes
//
// `page` is what loads; `width`/`height` is the recorded viewport; `gifWidth`
// is the output width (1:1 with the viewport for the browser scene, so the
// popup inside it stays at its true 420px and the Arabic stays sharp);
// `inFrame` says the popup lives in an iframe, which is what makes the driver
// resolve selectors and coordinates through it.
// ---------------------------------------------------------------------------
const SCENES = {
  popup: {
    page: "/popup.html",
    width: POPUP_W,
    height: POPUP_H,
    gifWidth: 480,
    inFrame: false,
    bg: { r: 243, g: 250, b: 246, a: 1 }, // the popup's own paper colour
    // key badge sits just above the footer of the popup
    badgeCss: "left: 50%; bottom: 58px; transform: translateX(-50%);",
  },
  browser: {
    page: "/store/browser.html",
    width: 600, // must match the body size in store/browser.html
    height: 560,
    gifWidth: 600,
    inFrame: true,
    bg: { r: 207, g: 216, b: 214, a: 1 },
    // ...and centred over the popup panel, which is anchored top-right in the
    // window: the panel spans 420px from 10px off the right edge, and its
    // bottom sits 56px up from the viewport's
    badgeCss: "right: 190px; bottom: 122px;",
  },
};

// ---------------------------------------------------------------------------
// the demos
//
// `state` seeds storage before the popup boots. `run` is an async function
// given the driver below; every helper in it is awaited, and the recorder is
// already capturing while it runs.
// ---------------------------------------------------------------------------
const DEMOS = [
  {
    key: "reading",
    file: "reading.gif",
    scene: "popup",
    // Ar-Rahman: five consecutive short ayahs, so stepping reads clearly
    // rather than turning into a wall of text.
    state: { position: { surah: 55, ayah: 1 }, fontSize: 32 },
    async run(d) {
      await d.hold(1400);
      // first two steps by the footer button, so the pointer shows where it is
      await d.click("#next-btn", { label: "التالية ›" });
      await d.hold(1300);
      await d.click("#next-btn");
      await d.hold(1300);
      // the last three by keyboard — the same move without leaving the keys
      await d.parkCursor();
      await d.key("ArrowLeft", { badge: "←" });
      await d.hold(1300);
      await d.key("ArrowLeft", { badge: "←" });
      await d.hold(1300);
      await d.key("ArrowLeft", { badge: "←" });
      await d.hold(2000);
      await d.expect(55, 6); // five steps on from 55:1
    },
  },
  {
    key: "tour",
    file: "tour.gif",
    scene: "popup",
    state: { position: { surah: 1, ayah: 1 }, fontSize: 26 },
    async run(d) {
      await d.hold(1300);

      // 1. pick a surah by name
      await d.click("#surah-dropdown-container .dropdown-trigger");
      await d.hold(600);
      await d.type("البقرة", ".picker-overlay:not([hidden]) .picker-search");
      await d.hold(900);
      await d.click(".picker-overlay:not([hidden]) .picker-item");
      await d.hold(1200);

      // 2. jump to an ayah by its text, typed without tashkeel
      await d.click("#verse-dropdown-container .dropdown-trigger");
      await d.hold(600);
      // typed in plain modern spelling: no tashkeel, no dagger alef — the
      // only ayah in البقرة that matches is 255, آية الكرسي
      await d.type(
        "الحي القيوم",
        ".picker-overlay:not([hidden]) .picker-search",
      );
      await d.hold(1100);
      await d.click(".picker-overlay:not([hidden]) .picker-item");
      await d.hold(1400);

      // 3. size the ayah to taste
      await d.click("#font-larger-btn");
      await d.hold(320);
      await d.click("#font-larger-btn");
      await d.hold(320);
      await d.click("#font-larger-btn");
      await d.hold(900);
      await d.click("#font-smaller-btn");
      await d.hold(1100);

      // 4. read on through a long ayah with the space bar
      await d.parkCursor();
      await d.key(" ", { badge: "مسافة" });
      await d.hold(1300);
      await d.key(" ", { badge: "مسافة" });
      await d.hold(1500);

      // 5. the shortcut sheet, opened and closed by key
      await d.key("؟", { badge: "؟" });
      await d.hold(2600);
      await d.key("Escape", { badge: "Esc" });
      await d.hold(900);

      // 6. and back to plain reading
      await d.key("ArrowLeft", { badge: "←" });
      await d.hold(1000);
      await d.key("ArrowRight", { badge: "→" });
      await d.hold(1800);
      // the ayah depends on how far Space scrolled before it advanced, so only
      // the surah is pinned here
      await d.expect(2);
    },
  },
  {
    key: "browser-reading",
    file: "browser-reading.gif",
    scene: "browser",
    // A few free minutes on some page: open the extension, read down سورة
    // الكهف on the space bar alone. Ayahs 1-10 there are a real mix, and the
    // demo needs both kinds on screen — a long ayah the key pages through, and
    // a short one it steps straight past.
    //
    // Which is which depends entirely on the font size, and the Uthmani text is
    // far denser per character than it looks: roughly half of it is combining
    // marks with no width of their own, so 150 characters still set in three
    // lines. At 28px and even at 34px every ayah here fits the card, and twelve
    // presses are just twelve ayahs with nothing ever scrolling. 40px is where
    // 18:1, 18:2 and 18:5 overflow while 18:3 and 18:4 do not.
    state: { position: { surah: 18, ayah: 1 }, fontSize: 40 },
    async run(d) {
      await d.hold(1500); // the page you were already on
      await d.openPopup();
      await d.hold(1600);

      // twelve presses: paging through the long ayahs, stepping over the short
      for (let i = 0; i < 12; i++) {
        await d.key(" ", { badge: "مسافة" });
        await d.hold(1000);
      }
      await d.hold(700);

      // Chrome tears the popup down when you click away — nothing is kept open
      const readTo = await d.position();
      await d.clickChrome("#page-aside");
      await d.hold(1800);

      // ...and opening it again lands on the same ayah, from storage
      await d.openPopup();
      await d.hold(2600);
      await d.expect(18, readTo.ayah);
      // the point of the demo is a mix: some presses scrolled a long ayah
      // rather than advancing, so twelve presses must cover fewer than twelve
      // ayahs — and still enough of them to read as reading
      const read = readTo.ayah - 1;
      if (read < 5 || read > 10) {
        throw new Error(
          `browser-reading: twelve presses covered ${read} ayahs (ended 18:${readTo.ayah}); expected 5-10, with the rest of the presses spent scrolling`,
        );
      }
    },
  },
  {
    key: "browser-tour",
    file: "browser-tour.gif",
    scene: "browser",
    // starts at 34 so the two "+" presses land on 38, where the longer ayahs of
    // الكهف overflow the card and Space has something to page through
    state: { position: { surah: 1, ayah: 1 }, fontSize: 34 },
    async run(d) {
      await d.hold(1300);
      await d.openPopup();
      await d.hold(1400);

      // 1. pick a surah by name
      await d.click("#surah-dropdown-container .dropdown-trigger");
      await d.hold(600);
      await d.type("الكهف", ".picker-overlay:not([hidden]) .picker-search");
      await d.hold(900);
      await d.click(".picker-overlay:not([hidden]) .picker-item");
      await d.hold(1200);

      // 2. jump to an ayah by its text, typed without tashkeel
      await d.click("#verse-dropdown-container .dropdown-trigger");
      await d.hold(600);
      await d.type("الرقيم", ".picker-overlay:not([hidden]) .picker-search");
      await d.hold(1000);
      await d.click(".picker-overlay:not([hidden]) .picker-item");
      await d.hold(1300);

      // 3. size the ayah for comfortable reading
      await d.click("#font-larger-btn");
      await d.hold(300);
      await d.click("#font-larger-btn");
      await d.hold(900);

      // 4. read on with the space bar: it pages the long ayah, then moves on
      await d.parkCursor();
      for (let i = 0; i < 4; i++) {
        await d.key(" ", { badge: "مسافة" });
        await d.hold(1050);
      }

      // 5. every shortcut, on one sheet
      await d.key("؟", { badge: "؟" });
      await d.hold(2400);
      await d.key("Escape", { badge: "Esc" });
      await d.hold(800);

      // 6. close it, come back, and the reading picks up where it stopped
      const readTo = await d.position();
      await d.clickChrome("#page-aside");
      await d.hold(1500);
      await d.openPopup();
      await d.hold(2400);
      await d.expect(18, readTo.ayah);
    },
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Chrome wants a code/keyCode alongside `key`, or the page sees a press with
// no identity for the non-printable keys.
const KEY_CODES = {
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  Escape: "Escape",
  " ": "Space",
  "؟": "Slash",
  "?": "Slash",
};
const KEY_VK = {
  ArrowLeft: 37,
  ArrowRight: 39,
  ArrowUp: 38,
  ArrowDown: 40,
  Escape: 27,
  " ": 32,
  "؟": 191,
  "?": 191,
};

// Pointer + key badge, drawn in the recorded page. Nothing here touches the
// extension's own markup: in the browser scene these live in the stage
// document, above the popup's panel rather than inside it.
const overlayHtml = (scene) => `
<style id="__demo-style">
#__demo-cursor {
  position: fixed; left: 0; top: 0; z-index: 99999; pointer-events: none;
  width: 22px; height: 22px; margin: -2px 0 0 -2px;
  transform: translate(${scene.width / 2}px, ${scene.height + 40}px);
  transition: transform 380ms cubic-bezier(.33,.1,.25,1);
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.45));
}
#__demo-ring {
  position: fixed; left: 0; top: 0; z-index: 99998; pointer-events: none;
  width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%;
  border: 2px solid #0f766e; opacity: 0; transform: scale(.4);
}
#__demo-ring.__fire { animation: __demo-ping 460ms ease-out; }
@keyframes __demo-ping {
  0%   { opacity: .9; transform: scale(.35); }
  100% { opacity: 0;  transform: scale(1.5); }
}
#__demo-key {
  position: fixed; z-index: 99999; pointer-events: none;
  ${scene.badgeCss}
  padding: 7px 15px; border-radius: 10px;
  background: rgba(20, 52, 44, .92); color: #f3faf6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px; font-weight: 600; letter-spacing: .5px;
  box-shadow: 0 6px 18px rgba(11, 87, 81, .35);
  opacity: 0; transition: opacity 140ms ease;
}
#__demo-key.__show { opacity: 1; }
</style>
<div id="__demo-ring"></div>
<svg id="__demo-cursor" viewBox="0 0 24 24" fill="none">
  <path d="M4 2.2 L4 19.4 L8.6 15.2 L11.6 21.8 L14.6 20.4 L11.6 13.9 L17.9 13.6 Z"
        fill="#fff" stroke="#14342c" stroke-width="1.4" stroke-linejoin="round"/>
</svg>
<div id="__demo-key"></div>
`;

// ---------------------------------------------------------------------------
// plumbing: static server + headless Chrome, shared by every demo
// ---------------------------------------------------------------------------
const only = process.argv.slice(2);
const demos = only.length ? DEMOS.filter((d) => only.includes(d.key)) : DEMOS;
if (!demos.length) {
  console.error(`no demo matched: ${only.join(", ")}`);
  console.error(`known keys: ${DEMOS.map((d) => d.key).join(", ")}`);
  process.exit(1);
}
if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
  console.error("ffmpeg not found on PATH — brew install ffmpeg");
  process.exit(1);
}

rmSync(PROFILE, { recursive: true, force: true }); // last run's leftovers
const server = spawn(
  "python3",
  ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"],
  { cwd: ROOT, stdio: "ignore" },
);
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "about:blank",
  ],
  { stdio: "ignore" },
);
// The raw frames are ours to drop on the way out. The throwaway Chrome profile
// is not: Chrome is still flushing it as we exit, so deleting it here races
// (ENOTEMPTY) — it is cleared at startup instead, where Chrome is not running.
const shutdown = () => {
  server.kill();
  chrome.kill();
  rmSync(WORK_DIR, { recursive: true, force: true });
};
process.on("exit", shutdown);
process.on("SIGINT", () => process.exit(1));

let version = null;
for (let i = 0; i < 40 && !version; i++) {
  await sleep(500);
  try {
    version = await (
      await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
    ).json();
  } catch {
    /* not up yet */
  }
}
if (!version) throw new Error("headless Chrome did not start");

mkdirSync(OUT_DIR, { recursive: true });

for (const demo of demos) {
  await record(demo);
}

console.log(`\n${demos.length} gif(s) written to store/demo/`);
process.exit(0);

// ---------------------------------------------------------------------------
async function record({ key, file, scene: sceneKey = "popup", state, run }) {
  const scene = SCENES[sceneKey];
  if (!scene) throw new Error(`${key}: unknown scene ${sceneKey}`);
  const gifWidth = scene.gifWidth;

  const frameDir = path.join(WORK_DIR, key);
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });

  const url = `http://127.0.0.1:${PORT}${scene.page}`;
  const tab = await (
    await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${url}`, {
      method: "PUT",
    })
  ).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) => {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r) => pending.set(id, r));
  };
  // Every expression runs as an async IIFE, so a step can await its own waits.
  // `pdoc` is the popup's document either way — the page itself in the popup
  // scene, the panel's iframe in the browser scene — so a step reads the same
  // in both. Storage is deliberately NOT indirected: the stage and the popup
  // are the same origin, so the top-level localStorage IS the popup's.
  const evaluate = async (expr) => {
    const res = await send("Runtime.evaluate", {
      expression: `(async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const frame = document.querySelector("iframe");
        const pdoc = frame ? frame.contentDocument : document;
        const pwin = frame ? frame.contentWindow : window;
        ${expr}
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const thrown = res.result?.exceptionDetails ?? res.exceptionDetails;
    if (thrown) throw new Error(`${key}: ${thrown.text} — ${expr.trim()}`);
    return res.result?.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  // The viewport stays at 1x on purpose: with a deviceScaleFactor override,
  // Chrome scales the coordinates of dispatched mouse events, so a click meant
  // for the footer button lands in the middle of the ayah card. The 2x
  // oversampling is taken in the capture's clip instead, which leaves input
  // coordinates in plain CSS pixels.
  await send("Emulation.setDeviceMetricsOverride", {
    width: scene.width,
    height: scene.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // the popup body is rounded, and html behind it is transparent by design;
  // paint the corners rather than letting the gif guess at them
  await send("Emulation.setDefaultBackgroundColorOverride", { color: scene.bg });
  const clip = {
    x: 0,
    y: 0,
    width: scene.width,
    height: scene.height,
    // oversampled 2x so the Arabic keeps its shape after the downscale
    scale: 2,
  };
  await sleep(900);

  // seed storage, then reload so the popup boots with it instead of being
  // mutated after first paint
  await evaluate(`
    localStorage.setItem("position", ${JSON.stringify(JSON.stringify(state.position))});
    localStorage.setItem("fontSize", ${JSON.stringify(JSON.stringify(state.fontSize))});
  `);
  await send("Page.reload");
  await sleep(scene.inFrame ? 1000 : 2600); // fonts + surah JSON
  await send("Page.bringToFront"); // key events need the page focused

  // ---- the driver handed to each demo's run() ----------------------------
  // Coordinates are always viewport coordinates, which for the browser scene
  // means offsetting an element's box by the iframe's own position.
  const box = (sel, { inPopup = true } = {}) =>
    evaluate(`
      const doc = ${inPopup ? "pdoc" : "document"};
      const el = doc.querySelector(${JSON.stringify(sel)});
      if (!el) throw new Error("no element for ${sel.replace(/"/g, "'")}");
      const r = el.getBoundingClientRect();
      let x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (${inPopup ? "true" : "false"} && frame) {
        const fr = frame.getBoundingClientRect();
        const scale = frame.offsetWidth ? fr.width / frame.offsetWidth : 1;
        x = fr.left + x * scale;
        y = fr.top + y * scale;
      }
      return { x, y };
    `);
  // DEMO_TRACE only: record where a real click actually landed, per document.
  const installClickRecorder = (docExpr) =>
    evaluate(`
      const doc = ${docExpr};
      doc.defaultView.__demoClick = null;
      doc.addEventListener("mousedown", (e) => {
        doc.defaultView.__demoClick = {
          x: e.clientX, y: e.clientY, on: e.target.id || e.target.className,
        };
      }, true);
    `);
  const moveCursor = (x, y) =>
    evaluate(
      `document.getElementById("__demo-cursor").style.transform = "translate(${x}px, ${y}px)";`,
    );
  // Waits for the popup to be readable: its ayah rendered and its fonts in.
  const waitReady = async (timeout = 8000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const ready = await evaluate(`
        const t = pdoc.getElementById("ayah-text");
        if (!t || !t.textContent.trim()) return false;
        await pdoc.fonts.ready;
        return true;
      `);
      if (ready) {
        // the popup document is new on every open, so its recorder is too
        if (process.env.DEMO_TRACE) await installClickRecorder("pdoc");
        return;
      }
      await sleep(150);
    }
    throw new Error(`${key}: popup did not become ready`);
  };

  const clickAt = async (x, y) => {
    await moveCursor(x, y);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await sleep(430); // let the pointer finish its travel before it presses
    await evaluate(`
      const ring = document.getElementById("__demo-ring");
      ring.style.transform = "translate(${x}px, ${y}px)";
      ring.classList.remove("__fire");
      void ring.offsetWidth;
      ring.classList.add("__fire");
    `);
    // `buttons` is the bitmask of what is held down; Chrome ignores a press
    // that claims no button is down
    const btn = { button: "left", clickCount: 1, x, y };
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      buttons: 1,
      ...btn,
    });
    await sleep(90);
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      buttons: 0,
      ...btn,
    });
  };

  const d = {
    hold: async (ms) => {
      await sleep(ms);
      if (process.env.DEMO_TRACE) {
        const card = await evaluate(`
          const c = pdoc.querySelector(".ayah-card");
          if (!c) return null;
          const t = pdoc.getElementById("ayah-text");
          return {
            font: pdoc.body.style.getPropertyValue("--ayah-font-size"),
            real: getComputedStyle(t).fontSize,
            chars: t.textContent.trim().length,
            textH: t.getBoundingClientRect().height,
            scroll: c.scrollTop,
            over: c.scrollHeight - c.clientHeight,
            box: c.clientHeight,
          };
        `);
        console.log(
          "  at",
          JSON.stringify(await d.position()),
          "card",
          JSON.stringify(card),
        );
      }
    },

    // A real click inside the popup: the drawn pointer travels there, a real
    // mousemove lands the hover state, then mousePressed/mouseReleased fire the
    // app's own handler.
    async click(sel) {
      const { x, y } = await box(sel);
      await clickAt(x, y);
      if (process.env.DEMO_TRACE) await traceClick(sel, x, y, true);
    },

    // The same, on the browser window around the popup (the toolbar button,
    // the page behind) rather than inside it.
    async clickChrome(sel) {
      const { x, y } = await box(sel, { inPopup: false });
      await clickAt(x, y);
      if (process.env.DEMO_TRACE) await traceClick(sel, x, y, false);
    },

    // Opens the extension from its toolbar button, the way a reader does, and
    // waits for the popup to be readable. Focus is handed to the popup document
    // afterwards: the click left it on the toolbar button, where Space would
    // press the button again instead of reaching the reader.
    async openPopup() {
      await d.clickChrome("#ext-icon");
      await waitReady();
      await evaluate(`frame.contentWindow.focus(); pdoc.activeElement?.blur?.();`);
      await sleep(120);
    },

    // Types into the picker's search box character by character. The value is
    // set and an `input` event dispatched, which is exactly what the picker
    // listens for — and it debounces, so the pauses double as the filter's
    // settling time.
    async type(text, sel) {
      for (const ch of [...text]) {
        await evaluate(`
          const el = pdoc.querySelector(${JSON.stringify(sel)});
          el.value += ${JSON.stringify(ch)};
          el.dispatchEvent(new Event("input"));
        `);
        await sleep(115);
      }
    },

    // A real key press, with a badge naming the key so the viewer can see what
    // was pressed.
    async key(k, { badge } = {}) {
      if (badge) {
        await evaluate(`
          const el = document.getElementById("__demo-key");
          el.textContent = ${JSON.stringify(badge)};
          el.classList.add("__show");
        `);
        await sleep(150);
      }
      const printable = k.length === 1 ? k : "";
      const id = {
        key: k,
        code: KEY_CODES[k],
        windowsVirtualKeyCode: KEY_VK[k] ?? 0,
        nativeVirtualKeyCode: KEY_VK[k] ?? 0,
      };
      await send("Input.dispatchKeyEvent", {
        type: printable ? "keyDown" : "rawKeyDown",
        ...id,
        ...(printable ? { text: printable } : {}),
      });
      // a real press is held briefly; releasing in the same tick is what let
      // an occasional press get lost between two renders
      await sleep(70);
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...id });
      if (badge) {
        await sleep(620);
        await evaluate(
          `document.getElementById("__demo-key").classList.remove("__show");`,
        );
      }
    },

    // Reads the position the popup persisted, so a demo can assert it ended
    // where its script says it should — a silently dropped click or key press
    // would otherwise ship as a demo that skips a step.
    position: () =>
      evaluate(`return JSON.parse(localStorage.getItem("position"));`),

    async expect(surah, ayah) {
      const p = await d.position();
      const ok = p.surah === surah && (ayah === undefined || p.ayah === ayah);
      if (!ok) {
        throw new Error(
          `${key}: expected ${surah}:${ayah ?? "*"}, ended at ${p.surah}:${p.ayah}`,
        );
      }
    },

    // Sends the pointer off the bottom edge before a keyboard stretch, so a
    // stale cursor isn't left hovering over a button nobody is pressing. The
    // blur matters as well: the popup ignores Space while a button holds focus,
    // where the browser already uses it to press.
    async parkCursor() {
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: scene.width / 2,
        y: scene.height - 1,
      });
      await moveCursor(scene.width / 2, scene.height + 40);
      await evaluate(`pdoc.activeElement?.blur?.();`);
      await sleep(420);
    },
  };

  // A click inside the popup never reaches the stage document, so each document
  // records its own — read back the one that should have seen this click.
  const traceClick = async (sel, x, y, inPopup) => {
    const got = await evaluate(
      `const w = ${inPopup ? "pwin" : "window"};
       return w.__demoClick ? JSON.stringify(w.__demoClick) : "none";`,
    );
    console.log(`  click ${sel} sent (${Math.round(x)},${Math.round(y)}) -> got ${got}`);
  };

  // Warm the popup once before recording: the surah JSON and the woff2 faces
  // are then in the http cache, so the first open in the demo is as quick as
  // the second one a reader would see, rather than a blank panel.
  if (scene.inFrame) {
    await evaluate(`await window.__stage.openPopup();`);
    await waitReady();
    await evaluate(`window.__stage.closePopup();`);
    await sleep(300);
  }

  await evaluate(
    `document.body.insertAdjacentHTML("beforeend", ${JSON.stringify(overlayHtml(scene))});`,
  );
  if (process.env.DEMO_TRACE) await installClickRecorder("document");

  // ---- capture loop ------------------------------------------------------
  const frames = [];
  let capturing = true;
  const loop = (async () => {
    let n = 0;
    while (capturing) {
      const started = Date.now();
      const shot = await send("Page.captureScreenshot", { format: "png", clip });
      if (!shot.result?.data) continue;
      const name = `f${String(++n).padStart(5, "0")}.png`;
      writeFileSync(
        path.join(frameDir, name),
        Buffer.from(shot.result.data, "base64"),
      );
      frames.push({ name, t: Date.now() });
      const left = CAPTURE_MS - (Date.now() - started);
      if (left > 0) await sleep(left);
    }
  })();

  await run(d);
  capturing = false;
  await loop;
  ws.close();

  if (frames.length < 2) throw new Error(`${key}: captured no frames`);

  // Real elapsed time per frame, so a slow capture stretches nothing.
  const list = frames
    .map(({ name, t }, i) => {
      const dur = i === frames.length - 1 ? 0.4 : (frames[i + 1].t - t) / 1000;
      return `file '${name}'\nduration ${dur.toFixed(3)}`;
    })
    .join("\n");
  const listPath = path.join(frameDir, "frames.txt");
  // concat's last entry needs repeating for its duration to be honoured
  writeFileSync(listPath, `${list}\nfile '${frames.at(-1).name}'\n`);

  const out = path.join(OUT_DIR, file);
  const ff = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f", "concat",
      "-i", listPath,
      "-filter_complex",
      `fps=${FPS},scale=${gifWidth}:-1:flags=lanczos,split[a][b];` +
        `[a]palettegen=max_colors=160:stats_mode=diff[p];` +
        `[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      "-loop", "0",
      out,
    ],
    { cwd: frameDir, stdio: ["ignore", "ignore", "pipe"] },
  );
  if (ff.status !== 0) {
    throw new Error(`${key}: ffmpeg failed\n${ff.stderr?.toString().slice(-2000)}`);
  }
  rmSync(frameDir, { recursive: true, force: true });

  const secs = (frames.at(-1).t - frames[0].t) / 1000;
  console.log(
    `${file}  ${frames.length} frames, ${secs.toFixed(1)}s, ${gifWidth}px wide`,
  );
}
