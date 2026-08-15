// Builds the Chrome Web Store submission zip in dist/, shipping ONLY runtime
// files, then verifies the archive contains no junk. Usage: node scripts/package.mjs
import { readFileSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const INCLUDE = ["manifest.json", "popup.html", "css", "js", "data", "fonts", "icons"];
const JUNK = /(^|\/)(\.|__MACOSX|scripts\/|plans\/|store\/|dist\/)|\.md$|\.ttf$|(^|\/)_/;

const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const outDir = path.join(ROOT, "dist");
const zipPath = path.join(outDir, `one-quran-v${manifest.version}.zip`);

for (const entry of INCLUDE) {
  if (!existsSync(path.join(ROOT, entry))) throw new Error(`missing runtime path: ${entry}`);
}
mkdirSync(outDir, { recursive: true });
rmSync(zipPath, { force: true });

// -X: no extra file attributes; -x: belt-and-braces exclusion of OS junk
execFileSync(
  "zip",
  ["-r", "-X", zipPath, ...INCLUDE, "-x", "*.DS_Store", "-x", "__MACOSX/*", "-x", "fonts/*.ttf"],
  { cwd: ROOT, stdio: "pipe" },
);

const listing = execFileSync("zipinfo", ["-1", zipPath], { encoding: "utf8" })
  .trim()
  .split("\n");
const bad = listing.filter((entry) => JUNK.test(entry));
if (bad.length) {
  rmSync(zipPath);
  throw new Error(`junk files in archive:\n${bad.join("\n")}`);
}

const sizeMb = (statSync(zipPath).size / 1024 / 1024).toFixed(2);
console.log(`${listing.length} entries, no junk detected`);
console.log(`built ${path.relative(ROOT, zipPath)} (${sizeMb} MB)`);
