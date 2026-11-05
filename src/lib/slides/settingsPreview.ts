// Server-only: addresses of sample slides drawn with the signed-in user's own style, for the Settings screen.
// Each is signed for that user (like the links Buffer gets), so the style is applied and the address is theirs alone.

import { loadDemoIssue } from "../demo";
import { signPreview } from "../previewSig";
import { templateParams } from "./options";

const address = (ids: number[], userId: string, version: string | undefined, bg?: string) => {
  const p = templateParams({ spec: { slides: [ids], ...(bg ? { bgs: [bg] } : {}) }, sv: version });
  p.set("picks", ids.join(","));
  const signed = signPreview(p, userId);
  signed.set("n", "1"); // slide 0 is the cover
  return `/api/slide/preview?${signed.toString()}`;
};

/**
 * Two sample pick slides from the sample issue, each made of two real events (short title, a date, a place, a description; best-ranked first).
 * A slide whose picks all share a category gets that category as a label in its header, so:
 *   [0] two events from different categories: no label (how most slides look), and
 *   [1] two events from the same category: with the label.
 * `version` makes a changed style a new address. `bg` is the slide background (a #rrggbb color, the first color of the user's palette); the
 * server does not know the palette (it lives in the browser), so the screen passes it in.
 */
export function settingsPreviews(userId: string, version: string | undefined, bg?: string | null): [string, string] {
  const color = typeof bg === "string" && /^#[0-9a-f]{6}$/i.test(bg) ? bg.toLowerCase() : undefined;
  const chunks = loadDemoIssue().chunks;
  const events = chunks
    .filter((c) => c.kind === "bullet" && c.when && c.place && c.blurb && c.title.length <= 45)
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  const byGroup = new Map<string, typeof events>();
  for (const e of events) if (e.group) byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e]);
  const labelled = [...byGroup.values()].find((l) => l.length >= 2)?.slice(0, 2) ?? [];
  const rest = events.filter((e) => !labelled.includes(e));
  const first = rest[0];
  const second = rest.find((e) => e !== first && e.group !== first?.group);
  const plain = first && second ? [first, second] : events.slice(0, 2);
  const fallback = (events.length >= 2 ? events : chunks.filter((c) => c.kind !== "paragraph")).slice(0, 2);
  const ids = (l: typeof events) => (l.length === 2 ? l : fallback).map((c) => c.id);
  return [address(ids(plain), userId, version, color), address(ids(labelled), userId, version, color)];
}
