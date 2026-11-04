// Server-only: fake mode, for building and testing without publishing anything or needing dozens of real channels.
// Never honoured in production, so a stray env var on the live site can't turn real sends into fake ones.
//   BUFFER_FAKE=1                      no call to Buffer for posts: realistic results instead
//   BUFFER_FAKE_CHANNELS=60            add this many fake channels (up to 200) to the real ones, across the networks
//   BUFFER_FAKE_FAIL=instagram         networks whose create call fails with a Buffer-style error
//   BUFFER_FAKE_UNKNOWN=linkedin       networks whose create call dies mid-request (outcome unknown)
//   BUFFER_FAKE_PUBLISH_FAIL=linkedin  networks that Buffer accepts but then fails to publish

export const fakeMode = () => process.env.BUFFER_FAKE === "1" && process.env.NODE_ENV !== "production";

export const fakeList = (name: string) =>
  (process.env[name] ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// LinkedIn and Instagram are heavy on purpose (people have many pages), and two networks that can't take a carousel are in
// the mix so the "Not supported yet" note shows up. Mastodon is left out of the cycle and added once (the 10th channel), so
// there is always a network with a single channel to check the picker with.
const SERVICES = ["linkedin", "linkedin", "instagram", "facebook", "linkedin", "threads", "bluesky", "instagram", "twitter", "facebook", "tiktok", "pinterest"];
const NAMES = ["Harbour Cafe", "Canal Yoga", "Oud-West Parents", "Little Sprouts", "Noord Makers", "Jordaan Kids", "Vondelpark Walks", "Nine Streets Market", "Pijp Playgroup", "Zuid Story Time", "Museum Mile", "East Side Events"];

const SINGLE_AT = 9;

export function fakeChannels(): { id: string; name: string; service: string }[] {
  if (!fakeMode()) return [];
  const n = Math.min(200, Math.max(0, Math.floor(Number(process.env.BUFFER_FAKE_CHANNELS) || 0)));
  return Array.from({ length: n }, (_, i) => ({
    id: `fake-ch-${i + 1}`,
    name: `${NAMES[i % NAMES.length]} ${String(i + 1).padStart(2, "0")}`,
    service: i === SINGLE_AT ? "mastodon" : SERVICES[i % SERVICES.length],
  }));
}
