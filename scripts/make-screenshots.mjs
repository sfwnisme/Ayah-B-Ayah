// Regenerates the Chrome Web Store screenshots (1280x800) into
// store/screenshots/. Build-time only, never shipped.
//
//   node scripts/make-screenshots.mjs
//
// Starts its own static server and headless Chrome, drives store/stage.html
// once per scene — the real popup runs inside the stage's iframe, so a shot
// can never drift from the shipped UI — then shuts both down.
// Needs: Chrome, Node >= 22, python3. No npm dependencies.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "store", "screenshots");
const PORT = 8751;
const DEBUG_PORT = 9226;
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = path.join(ROOT, ".screenshot-profile");

// Each scene: the stage copy is keyed by `scene` in store/stage.html; `state`
// seeds the popup's storage before load; `setup` runs inside the stage page
// after load, to open whatever the shot needs to show.
const SCENES = [
  {
    file: "screenshot-1-reading.png",
    scene: "reading",
    state: { position: { surah: 53, ayah: 29 }, fontSize: 26 },
  },
  {
    file: "screenshot-2-picker.png",
    scene: "picker",
    state: { position: { surah: 2, ayah: 255 }, fontSize: 22 },
    setup: `
      const d = frame.contentDocument;
      d.querySelector("#verse-dropdown-container .dropdown-trigger").click();
      await wait(350);
      const inp = d.querySelector(".picker-overlay:not([hidden]) .picker-search");
      inp.value = "على كل شيء قدير";
      inp.dispatchEvent(new Event("input"));
      await wait(500);
    `,
  },
  {
    file: "screenshot-3-font-size.png",
    scene: "fontsize",
    state: { position: { surah: 112, ayah: 1 }, fontSize: 40 },
  },
  {
    file: "screenshot-4-shortcuts.png",
    scene: "shortcuts",
    state: { position: { surah: 36, ayah: 1 }, fontSize: 24 },
    setup: `
      frame.contentDocument.getElementById("help-btn").click();
      await wait(350);
    `,
  },
  {
    file: "screenshot-5-offline.png",
    scene: "privacy",
    state: { position: { surah: 18, ayah: 10 }, fontSize: 28 },
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
  cwd: ROOT,
  stdio: "ignore",
});
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const shutdown = () => {
  server.kill();
  chrome.kill();
};
process.on("exit", shutdown);
process.on("SIGINT", () => process.exit(1));

// wait for both to answer
let version = null;
for (let i = 0; i < 40 && !version; i++) {
  await sleep(500);
  try {
    version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
  } catch {
    /* not up yet */
  }
}
if (!version) throw new Error("headless Chrome did not start");

mkdirSync(OUT_DIR, { recursive: true });

for (const { file, scene, state, setup } of SCENES) {
  const url = `http://127.0.0.1:${PORT}/store/stage.html?scene=${scene}`;
  const tab = await (
    await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${url}`, { method: "PUT" })
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
  const evaluate = (expr) =>
    send("Runtime.evaluate", {
      expression: `(async () => { const wait = (ms) => new Promise(r => setTimeout(r, ms)); const frame = document.querySelector("iframe"); ${expr} })()`,
      awaitPromise: true,
      returnByValue: true,
    });

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(1200);

  // seed the popup's storage (same origin as the stage), then reload so the
  // popup boots with it rather than being mutated after first paint
  await evaluate(`
    const w = frame.contentWindow;
    w.localStorage.setItem("position", ${JSON.stringify(JSON.stringify(state.position))});
    w.localStorage.setItem("fontSize", ${JSON.stringify(String(state.fontSize))});
  `);
  await send("Page.reload");
  await sleep(2600); // fonts + surah JSON

  if (setup) {
    await evaluate(setup);
    await sleep(400);
  }

  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(OUT_DIR, file), Buffer.from(shot.result.data, "base64"));
  console.log(`${file}  (scene: ${scene})`);
  ws.close();
}

console.log(`\n${SCENES.length} screenshots written to store/screenshots/`);
process.exit(0);
