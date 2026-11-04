"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Search } from "lucide-react";
import { ChannelIcon } from "@/components/ChannelIcon";
import { serviceLabel, unsupportedReason } from "@/lib/channels";
import { loadChannelChoice, saveChannelChoice } from "@/lib/progress";

export type Channel = { id: string; name: string; service: string };

/** Show a filter box above a network's channel list once it has this many channels. */
const SEARCH_FROM = 5;
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });

/**
 * Which channels are ticked. Everything usable starts ticked; the choice is remembered. Channels are fetched on the server,
 * so coming back from Buffer's settings tab re-runs that fetch (not in the demo, whose channels are examples), and any
 * channel connected since is ticked while one that was removed drops out.
 */
export function useChannelSelection(channels: Channel[], demo = false) {
  const usable = channels.filter((c) => !unsupportedReason(c.service));
  const usableKey = usable.map((c) => c.id).join(",");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(usable.map((c) => c.id)));
  const [ready, setReady] = useState(false);
  const known = useRef(new Set(usable.map((c) => c.id)));

  // Restore the saved choice once mounted (not during the first render, so server and browser HTML match).
  useEffect(() => {
    const t = setTimeout(() => {
      const ids = new Set(usableKey ? usableKey.split(",") : []);
      const saved = loadChannelChoice();
      if (saved) {
        const kept = saved.selected.filter((id) => ids.has(id));
        const seen = new Set(saved.known);
        const fresh = [...ids].filter((id) => !seen.has(id));
        // Saved with some channels, none of them here any more (another account, or all disconnected): start from everything.
        if (saved.selected.length === 0 || kept.length > 0) setSelected(new Set([...kept, ...fresh]));
        known.current = ids;
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
    // Only on mount: later changes to the channel list are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The channel list changed (refetched after a focus): tick new channels, drop removed ones.
  useEffect(() => {
    if (!ready) return;
    const ids = new Set(usableKey ? usableKey.split(",") : []);
    const added = [...ids].filter((id) => !known.current.has(id));
    const removed = [...known.current].filter((id) => !ids.has(id));
    if (added.length === 0 && removed.length === 0) return;
    known.current = ids;
    const t = setTimeout(
      () =>
        setSelected((s) => {
          const n = new Set([...s].filter((id) => ids.has(id)));
          for (const id of added) n.add(id);
          return n;
        }),
      0,
    );
    return () => clearTimeout(t);
  }, [ready, usableKey]);

  useEffect(() => {
    if (ready) saveChannelChoice({ selected: [...selected], known: usableKey ? usableKey.split(",") : [] });
  }, [ready, selected, usableKey]);

  const router = useRouter();
  useEffect(() => {
    if (demo) return;
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 10_000) return;
      last = Date.now();
      router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [demo, router]);

  return { selected, setSelected, ready, usable };
}

export function ChannelPicker({
  channels,
  selected,
  setSelected,
  demo = false,
}: {
  channels: Channel[];
  selected: Set<string>;
  setSelected: (fn: (s: Set<string>) => Set<string>) => void;
  /** Public demo: the channels are examples, and the text says so. */
  demo?: boolean;
}) {
  const usable = channels.filter((c) => !unsupportedReason(c.service));
  // Networks whose channel box stays open after its last channel is unticked, until focus leaves the box (in case it was a slip).
  const [held, setHeld] = useState<Set<string>>(new Set());
  const [queries, setQueries] = useState<Record<string, string>>({});

  // Turning a network on jumps to its channel list, so the channels can be configured straight away. The list only exists
  // once something in it is ticked, so the jump waits until it has rendered. "Back to top" returns to the networks.
  const topRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingJump = useRef<string | null>(null);
  const behavior = (): ScrollBehavior =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  useEffect(() => {
    const svc = pendingJump.current;
    const el = svc ? boxRefs.current[svc] : null;
    if (!el) return;
    pendingJump.current = null;
    el.scrollIntoView({ behavior: behavior(), block: "start" });
    el.focus({ preventScroll: true });
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Networks as pills; networks that can't take a carousel are listed quietly instead.
  const byService = new Map<string, Channel[]>();
  for (const c of [...usable].sort(byName)) byService.set(c.service, [...(byService.get(c.service) ?? []), c]);
  const networks = [...byService.keys()].sort((a, b) =>
    serviceLabel(a).localeCompare(serviceLabel(b), "en", { sensitivity: "base" }),
  );
  const blockedNetworks = [...new Set(channels.filter((c) => unsupportedReason(c.service)).map((c) => c.service))];

  return (
    <div className="grid gap-4">
      <div ref={topRef} className="scroll-mt-24">
        <h2 className="mb-1 text-2xl">Where to?</h2>
        <p className="m-0 text-sm">
          Every selected channel gets its own post.
          {demo ? (
            " In demo mode, we've created example channels for you to explore."
          ) : (
            <>
              {" "}
              Want more channels? Configure your connections on{" "}
              <a
                href="https://publish.buffer.com/settings/channels"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline underline-offset-4"
              >
                your Buffer account
              </a>{" "}
              — we&rsquo;ll pick up the changes here.
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Networks">
        {networks.map((svc) => {
          const group = byService.get(svc)!;
          const on = group.some((c) => selected.has(c.id));
          return (
            <button
              key={svc}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (!on) pendingJump.current = svc;
                setSelected((s) => {
                  const next = new Set(s);
                  for (const c of group) {
                    if (on) next.delete(c.id);
                    else next.add(c.id);
                  }
                  return next;
                });
              }}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-base font-bold transition sm:gap-2.5 sm:px-5 sm:py-3 sm:text-lg ${on ? "bg-ink text-cream" : "bg-ink/10 ring-1 ring-ink/15 hover:bg-ink/15"}`}
            >
              <ChannelIcon service={svc} className="size-5 shrink-0" />
              {serviceLabel(svc)}
              <span className="font-normal opacity-80">({group.length})</span>
            </button>
          );
        })}
      </div>
      {blockedNetworks.length > 0 && (
        <p className="m-0 text-xs">
          Not supported yet:{" "}
          {blockedNetworks.map((svc) => `${serviceLabel(svc)} (${unsupportedReason(svc)?.toLowerCase()})`).join(", ")}.
        </p>
      )}

      {networks
        .filter((svc) => byService.get(svc)!.some((c) => selected.has(c.id)) || held.has(svc))
        .map((svc) => {
          const group = byService.get(svc)!;
          const count = group.filter((c) => selected.has(c.id)).length;
          const all = count === group.length;
          const q = (queries[svc] ?? "").trim().toLowerCase();
          const rows = q ? group.filter((c) => c.name.toLowerCase().includes(q)) : group;
          return (
            <div
              key={svc}
              ref={(el) => {
                boxRefs.current[svc] = el;
              }}
              // tabIndex -1 lets a click on the box's padding keep focus inside it, so it doesn't count as leaving.
              tabIndex={-1}
              onChange={() => setHeld((h) => new Set(h).add(svc))}
              onBlur={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setHeld((h) => {
                  const next = new Set(h);
                  next.delete(svc);
                  return next;
                });
              }}
              className="scroll-mt-24 rounded-xl bg-surface/60 p-5 outline-none"
            >
              {/* Headings default to the display font; this is a quiet label, so use the body font. */}
              <h3 className="m-0 mb-4 font-sans text-sm font-semibold">Choose your {serviceLabel(svc)} channels:</h3>
              <label className="flex cursor-pointer items-center gap-3 border-b border-ink/10 pb-3 text-sm">
                <input
                  type="checkbox"
                  checked={all}
                  ref={(el) => {
                    if (el) el.indeterminate = count > 0 && !all;
                  }}
                  onChange={() =>
                    setSelected((s) => {
                      const next = new Set(s);
                      for (const c of group) {
                        if (all) next.delete(c.id);
                        else next.add(c.id);
                      }
                      return next;
                    })
                  }
                  className="size-[18px] accent-ink"
                />
                <span>
                  Select all{" "}
                  <span className="text-ink/60">
                    ({count} of {group.length})
                  </span>
                </span>
              </label>
              {group.length >= SEARCH_FROM && (
                <label className="mt-3 flex items-center gap-2 rounded-lg border border-ink/15 bg-surface px-3 py-2">
                  <Search aria-hidden className="size-4 shrink-0 text-ink/60" />
                  <input
                    value={queries[svc] ?? ""}
                    onChange={(e) => setQueries((m) => ({ ...m, [svc]: e.target.value }))}
                    placeholder={`Filter ${serviceLabel(svc)} channels`}
                    aria-label={`Filter ${serviceLabel(svc)} channels`}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </label>
              )}
              {/* Plain divided rows (no ring/shadow), so the scroll area has nothing to clip. */}
              <ul className="max-h-60 divide-y divide-ink/10 overflow-y-auto">
                {rows.length === 0 && <li className="py-3 text-sm">No channels match.</li>}
                {rows.map((c) => (
                  <li key={c.id}>
                    <label title={c.name} className="flex min-w-0 cursor-pointer items-center gap-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                        className="size-[18px] accent-ink"
                      />
                      <ChannelIcon service={c.service} className="size-4 shrink-0 text-ink/60" />
                      <span className="min-w-0 truncate">{c.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => topRef.current?.scrollIntoView({ behavior: behavior(), block: "start" })}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
              >
                <ArrowUp aria-hidden className="size-4" strokeWidth={2.5} />
                Back to top
              </button>
            </div>
          );
        })}
    </div>
  );
}
