// Client-safe: the slide style version this browser last saw changed in Settings.
// The version in a slide preview address (`sv`) only exists to bust caches; the server draws with the saved style whatever it says. But the Design page
// can come back from Settings without being rendered again (browser Back, or the page kept alive in the background with cacheComponents), and then it
// still holds the old version, so its previews keep the old addresses and show the old picture. Settings leaves the newer version here, and pages
// that draw slides use the larger of the two. Every access is wrapped: storage can be blocked or empty.
const KEY = "pollen-picks:style-version";
const EVENT = "pollen-picks:style-version";

/** Settings saved or reset the slide style, the organization or the palette: any slide address made before now is out of date. */
export function bumpStyleVersion() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** The newer of the server's version and the one Settings left in this browser. Pure, for tests. */
export function newerVersion(fromServer: string | undefined, fromBrowser: string | null | undefined): string | undefined {
  const a = Number(fromServer);
  const b = Number(fromBrowser);
  if (!(b > 0)) return fromServer;
  if (!(a > 0)) return String(b);
  return String(Math.max(a, b));
}

export function subscribeStyleVersion(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
export const styleVersionSnapshot = read;
