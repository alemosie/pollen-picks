// Which channels a post is going to, as far as the steps before Send are concerned. Design and Write check slide count and caption room against
// the ticked channels ("Posting to"), not against every channel the account has, so a network the user never posts to doesn't set the limits.
// Pure, so it is tested without a page.

import { serviceLabel, unsupportedReason } from "./channels";

type Ch = { id: string; name: string; service: string };

/**
 * The channels the slides and the caption are checked against: the usable channels that are ticked. When none is ticked (not yet chosen, or
 * everything unticked) all usable channels count, so there is always something to check against.
 */
export function fitScope<T extends Ch>(channels: T[], selected: ReadonlySet<string>): T[] {
  const usable = channels.filter((c) => !unsupportedReason(c.service));
  const on = usable.filter((c) => selected.has(c.id));
  return on.length > 0 ? on : usable;
}

/**
 * The first selection for a browser with no saved choice: the channels the last send went to (those still connected), else everything usable.
 * A saved choice always wins over this (see useChannelSelection).
 */
export function seedSelection(usableIds: readonly string[], lastSend: readonly string[] | undefined): Set<string> {
  const ids = new Set(usableIds);
  const kept = (lastSend ?? []).filter((id) => ids.has(id));
  return new Set(kept.length > 0 ? kept : usableIds);
}

/** The usable networks, split into those with at least one ticked channel ("Posting to") and the rest ("Unselected channels"), each A to Z. */
export function splitNetworks(channels: Ch[], selected: ReadonlySet<string>): { on: string[]; off: string[] } {
  const on = new Set<string>();
  const all = new Set<string>();
  for (const c of channels) {
    if (unsupportedReason(c.service)) continue;
    all.add(c.service);
    if (selected.has(c.id)) on.add(c.service);
  }
  const az = (a: string, b: string) => serviceLabel(a).localeCompare(serviceLabel(b), "en", { sensitivity: "base" });
  return { on: [...on].sort(az), off: [...all].filter((s) => !on.has(s)).sort(az) };
}

/** Tapping a network pill: turns all of that network's channels on or off, and leaves every other channel as it was. Choosing single channels is for Send. */
export function toggleNetwork(channels: Ch[], selected: ReadonlySet<string>, service: string, turnOn: boolean): Set<string> {
  const next = new Set(selected);
  for (const c of channels) {
    if (c.service !== service) continue;
    if (turnOn) next.add(c.id);
    else next.delete(c.id);
  }
  return next;
}
