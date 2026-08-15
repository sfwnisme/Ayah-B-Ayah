// Persist the reader's last position and font-size preference via
// chrome.storage.local.
const POSITION_KEY = "position";
const FONT_SIZE_KEY = "fontSize";
const DEFAULT_POSITION = { surah: 1, ayah: 1 };

// Ayah font size in px. MIN/MAX/STEP are exported so the popup can clamp and
// disable the buttons against the same numbers the storage layer accepts.
export const DEFAULT_FONT_SIZE = 24;
export const MIN_FONT_SIZE = 16;
export const MAX_FONT_SIZE = 44;
export const FONT_SIZE_STEP = 2;

// chrome.storage is undefined when popup.html is opened as a plain page (dev
// preview); fall back to localStorage there. The installed extension always
// uses chrome.storage.local.
const extensionStorage = globalThis.chrome?.storage?.local;

function read(key, fallback) {
  if (!extensionStorage) {
    try {
      return Promise.resolve(JSON.parse(localStorage.getItem(key)) ?? fallback);
    } catch {
      return Promise.resolve(fallback);
    }
  }
  return new Promise((resolve) => {
    extensionStorage.get(key, (result) => {
      resolve(result[key] ?? fallback);
    });
  });
}

function write(key, value) {
  if (!extensionStorage) {
    localStorage.setItem(key, JSON.stringify(value));
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    extensionStorage.set({ [key]: value }, resolve);
  });
}

export function getPosition() {
  return read(POSITION_KEY, DEFAULT_POSITION);
}

export function savePosition(position) {
  return write(POSITION_KEY, position);
}

// Anything stored by an older/newer build (or hand-edited) is coerced back into
// range so a bad value can never render the ayah unreadable.
export function clampFontSize(size) {
  if (!Number.isFinite(size)) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));
}

export async function getFontSize() {
  return clampFontSize(await read(FONT_SIZE_KEY, DEFAULT_FONT_SIZE));
}

export function saveFontSize(size) {
  return write(FONT_SIZE_KEY, clampFontSize(size));
}
