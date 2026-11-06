// Server-only: fake mode, for building and testing without publishing anything or needing dozens of real channels.
// Never honoured in production, so a stray env var on the live site can't turn real sends into fake ones.
//   BUFFER_FAKE=1                      no call to Buffer for posts: realistic results instead
//   BUFFER_FAKE_CHANNELS=60            add this many fake channels (up to 200) to the real ones, across the networks
//   BUFFER_FAKE_FAIL=instagram         networks whose create call fails with a Buffer-style error
//   BUFFER_FAKE_UNKNOWN=linkedin       networks whose create call dies mid-request (outcome unknown)
//   BUFFER_FAKE_PUBLISH_FAIL=linkedin  networks that Buffer accepts but then fails to publish
//   BUFFER_FAKE_RATE_LIMIT=3           the first 3 create calls after the server starts get a 429
//   BUFFER_FAKE_LIMITS=1               publish-now calls refuse a caption over its network's limit, like Buffer's "cannot exceed N characters" (drafts may exceed it, as in Buffer)

// A dev settings page (/dev, development only) can change all of this without editing env vars. Its choices are kept in .dev-fake.json (git-ignored)
// and win over the env vars; "Reset" deletes the file, so the env vars apply again. In production none of this is read.

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** What a network does when a post is created for it. */
export const FAKE_BEHAVIOURS = ["pass", "fail", "unknown", "publish_fail"] as const;
export type FakeBehaviour = (typeof FAKE_BEHAVIOURS)[number];

export type FakeSettings = {
  /** Fake mode on or off, over BUFFER_FAKE. */
  enabled?: boolean;
  /** Fake channels added to the real ones, over BUFFER_FAKE_CHANNELS. */
  channels?: number;
  /** Per network (lower case), over the BUFFER_FAKE_FAIL / _UNKNOWN / _PUBLISH_FAIL lists. */
  behaviour?: Record<string, FakeBehaviour>;
  /** The next N create calls get a 429 (Buffer's "too many requests"); counts down as they happen. */
  rateLimitNext?: number;
  /** Refuse captions over a network's limit, over BUFFER_FAKE_LIMITS. */
  enforceLimits?: boolean;
};

const isDev = () => process.env.NODE_ENV !== "production";
const FILE = () => join(process.cwd(), ".dev-fake.json");

const clampInt = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

/** Reads and cleans the saved settings. Anything unexpected in the file is ignored. */
export function readFakeSettings(): FakeSettings {
  if (!isDev()) return {};
  try {
    const raw = JSON.parse(readFileSync(FILE(), "utf8")) as Record<string, unknown>;
    const out: FakeSettings = {};
    if (typeof raw.enabled === "boolean") out.enabled = raw.enabled;
    if (typeof raw.enforceLimits === "boolean") out.enforceLimits = raw.enforceLimits;
    if (raw.channels !== undefined) out.channels = clampInt(raw.channels, 200);
    if (raw.rateLimitNext !== undefined) out.rateLimitNext = clampInt(raw.rateLimitNext, 100);
    if (raw.behaviour && typeof raw.behaviour === "object") {
      out.behaviour = {};
      for (const [k, v] of Object.entries(raw.behaviour as Record<string, unknown>))
        if (/^[a-z0-9_-]{1,40}$/.test(k) && (FAKE_BEHAVIOURS as readonly unknown[]).includes(v)) out.behaviour[k] = v as FakeBehaviour;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeFakeSettings(s: FakeSettings) {
  if (!isDev()) return;
  writeFileSync(FILE(), JSON.stringify(s, null, 2));
}

export function resetFakeSettings() {
  if (!isDev()) return;
  if (existsSync(FILE())) unlinkSync(FILE());
  envLimited = 0;
}

export const fakeMode = () => isDev() && (readFakeSettings().enabled ?? process.env.BUFFER_FAKE === "1");

export const fakeEnforcesLimits = () => fakeMode() && (readFakeSettings().enforceLimits ?? process.env.BUFFER_FAKE_LIMITS === "1");

export const fakeList = (name: string) =>
  (process.env[name] ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** What creating a post does for this network: the dev page's choice, else the env var lists, else it simply works. */
export function fakeBehaviour(service: string): FakeBehaviour {
  const svc = service.toLowerCase();
  const chosen = readFakeSettings().behaviour?.[svc];
  if (chosen) return chosen;
  if (fakeList("BUFFER_FAKE_FAIL").includes(svc)) return "fail";
  if (fakeList("BUFFER_FAKE_UNKNOWN").includes(svc)) return "unknown";
  if (fakeList("BUFFER_FAKE_PUBLISH_FAIL").includes(svc)) return "publish_fail";
  return "pass";
}

let envLimited = 0;
/** True when this create call should be answered with a 429. Counts down the dev page's "next N" (or BUFFER_FAKE_RATE_LIMIT, per server start). */
export function takeFakeRateLimit(): boolean {
  const s = readFakeSettings();
  if ((s.rateLimitNext ?? 0) > 0) {
    writeFakeSettings({ ...s, rateLimitNext: (s.rateLimitNext ?? 0) - 1 });
    return true;
  }
  if (envLimited < clampInt(process.env.BUFFER_FAKE_RATE_LIMIT, 100)) {
    envLimited += 1;
    return true;
  }
  return false;
}

// LinkedIn and Instagram are heavy on purpose (people have many pages), and two networks that can't take a carousel are in
// the mix so the "Not supported yet" note shows up. Mastodon is left out of the cycle and added once (the 10th channel), so
// there is always a network with a single channel to check the picker with.
const SERVICES = ["linkedin", "linkedin", "instagram", "facebook", "linkedin", "threads", "bluesky", "instagram", "twitter", "facebook", "tiktok", "pinterest"];
const NAMES = ["Harbour Cafe", "Canal Yoga", "Oud-West Parents", "Little Sprouts", "Noord Makers", "Jordaan Kids", "Vondelpark Walks", "Nine Streets Market", "Pijp Playgroup", "Zuid Story Time", "Museum Mile", "East Side Events"];

const SINGLE_AT = 9;

export function fakeChannels(): { id: string; name: string; service: string }[] {
  if (!fakeMode()) return [];
  const n = readFakeSettings().channels ?? clampInt(process.env.BUFFER_FAKE_CHANNELS, 200);
  return Array.from({ length: n }, (_, i) => ({
    id: `fake-ch-${i + 1}`,
    name: `${NAMES[i % NAMES.length]} ${String(i + 1).padStart(2, "0")}`,
    service: i === SINGLE_AT ? "mastodon" : SERVICES[i % SERVICES.length],
  }));
}
