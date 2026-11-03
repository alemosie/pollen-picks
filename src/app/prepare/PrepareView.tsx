"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SavedFlash } from "@/components/SavedFlash";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import Link from "next/link";
import { FlowBar, primaryButton, primaryDisabled } from "@/components/FlowBar";
import { loadFormat, saveFormat } from "@/lib/progress";
import { Check, Copy, Search } from "lucide-react";
import { ChannelIcon } from "@/components/ChannelIcon";
import {
  CAPTION_ORDERS,
  CAPTION_VARIANTS,
  MAX_CAPTION_CHARS,
  buildCaption,
  captionLeftOut,
  variantFor,
  type CaptionItem,
  type CaptionOrder,
  type CaptionVariant,
} from "@/lib/caption";
import { serviceLabel, unsupportedReason } from "@/lib/channels";

type Channel = { id: string; name: string; service: string };

/** Show a filter box above a network's channel list once it has this many channels. */
const SEARCH_FROM = 5;
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });

/** Same accents as the pick-type tabs on /pick. */
const ACCENT: Record<
  CaptionVariant,
  { solid: string; light: string; border: string }
> = {
  instagram: {
    solid: "bg-honey",
    light: "bg-honey/20 hover:bg-honey/40",
    border: "border-honey",
  },
  link: {
    solid: "bg-sage",
    light: "bg-sage/20 hover:bg-sage/40",
    border: "border-sage",
  },
};

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export function PrepareView({
  channels,
  picks,
  captionItems,
  newsletter,
  heading,
  template,
  link,
  backHref,
  nextHref,
  demo = false,
}: {
  channels: Channel[];
  picks: number[];
  captionItems: CaptionItem[];
  newsletter: string;
  heading?: string;
  template: string;
  link: string;
  backHref: string;
  nextHref: string;
  /** Public demo: the channels are examples, and the section says so. */
  demo?: boolean;
}) {
  const usable = channels.filter((c) => !unsupportedReason(c.service));
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(usable.map((c) => c.id)),
  );
  // Channels are fetched on the server. Coming back from Buffer's settings tab re-runs that fetch (not in the demo,
  // whose channels are examples), then the effect below ticks any new channel and drops any that were removed.
  const router = useRouter();
  useEffect(() => {
    if (demo) return;
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 10_000)
        return;
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
  const known = useRef(new Set(usable.map((c) => c.id)));
  const usableKey = usable.map((c) => c.id).join(",");
  useEffect(() => {
    const ids = new Set(usableKey ? usableKey.split(",") : []);
    const added = [...ids].filter((id) => !known.current.has(id));
    const removed = [...known.current].filter((id) => !ids.has(id));
    if (added.length === 0 && removed.length === 0) return;
    known.current = ids;
    // Like the first load, every usable channel starts ticked: a channel the user just connected is there to be used.
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
  }, [usableKey]);
  // Networks whose channel box stays open after its last channel is unticked, until focus leaves the box (in case it was a slip).
  const [held, setHeld] = useState<Set<string>>(new Set());
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<CaptionOrder>("clicks");
  const [edited, setEdited] = useState<Partial<Record<CaptionVariant, string>>>(
    {},
  );
  const [tab, setTab] = useState<CaptionVariant>("instagram");
  const [copied, setCopied] = useState(false);
  // Remember channel choice, order, tab and caption edits for this set of picks + template, so a detour doesn't lose them.
  const sig = `${picks.join(",")}|${template}`;
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      const f = loadFormat();
      if (f && f.sig === sig) {
        const ids = new Set(usable.map((c) => c.id));
        const chosen = f.selected.filter((id) => ids.has(id));
        if (f.selected.length === 0 || chosen.length > 0)
          setSelected(new Set(chosen));
        if (CAPTION_ORDERS.some((o) => o.id === f.order))
          setOrder(f.order as CaptionOrder);
        setEdited(f.edited as Partial<Record<CaptionVariant, string>>);
        if (f.tab === "instagram" || f.tab === "link") setTab(f.tab);
      }
      setRestored(true);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  useEffect(() => {
    if (restored)
      saveFormat({
        sig,
        selected: [...selected],
        order,
        edited: edited as Record<string, string>,
        tab,
      });
  }, [restored, sig, selected, order, edited, tab]);

  const generated = (variant: CaptionVariant) =>
    buildCaption(captionItems, { newsletter, heading, order, variant, link });
  const captionFor = (variant: CaptionVariant) =>
    edited[variant] ?? generated(variant);
  async function copyCaption(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy this caption", text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }
  // Picks the template caption can't fit. Not shown once the caption has been edited by hand: then it's the user's text.
  const leftOut = (variant: CaptionVariant) =>
    edited[variant] === undefined
      ? captionLeftOut(captionItems, {
          newsletter,
          heading,
          order,
          variant,
          link,
        })
      : [];

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (channels.length === 0)
    return (
      <p className="mt-10 font-semibold">
        No Buffer channels found on this account. Connect one in Buffer first.
      </p>
    );

  const selectedChannels = channels.filter((c) => selected.has(c.id));
  const n = selectedChannels.length;
  // Networks as pills; networks that can't take a carousel are listed quietly instead.
  const byService = new Map<string, Channel[]>();
  for (const c of [...usable].sort(byName))
    byService.set(c.service, [...(byService.get(c.service) ?? []), c]);
  const networks = [...byService.keys()].sort((a, b) =>
    serviceLabel(a).localeCompare(serviceLabel(b), "en", {
      sensitivity: "base",
    }),
  );
  const blockedNetworks = [
    ...new Set(
      channels
        .filter((c) => unsupportedReason(c.service))
        .map((c) => c.service),
    ),
  ];

  const usedBy = (v: CaptionVariant) =>
    selectedChannels.filter((c) => variantFor(c.service) === v);

  // Only offer a base caption for networks that are selected.
  const visible = CAPTION_VARIANTS.filter((v) => usedBy(v.id).length > 0);
  const activeTab = visible.find((v) => v.id === tab)?.id ?? visible[0]?.id;

  const variant = CAPTION_VARIANTS.find((v) => v.id === activeTab);
  const used = activeTab ? usedBy(activeTab) : [];

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h1 className="mb-3 text-4xl sm:text-5xl">
            <StepWord>Prepare</StepWord> your posts
          </h1>
          <div className="flex shrink-0 items-center gap-3 sm:mt-2">
            <SavedFlash />
            <ShareLinkButton />
          </div>
        </div>
        <div>
          <p className="mb-0 max-w-2xl text-lg">
            Choose where they go and how the caption reads. You&apos;ll review
            everything before it&apos;s created.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <section className="min-w-0">
          <h2 className="mb-1 text-2xl">Where to?</h2>
          <p className="mb-4 mt-0 text-sm">
            Every selected channel gets its own draft.
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
          <div className="grid gap-4 rounded-2xl bg-card p-5">
            <div
              className="flex flex-wrap gap-3"
              role="group"
              aria-label="Networks"
            >
              {networks.map((svc) => {
                const group = byService.get(svc)!;
                const on = group.some((c) => selected.has(c.id));
                return (
                  <button
                    key={svc}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setSelected((s) => {
                        const next = new Set(s);
                        for (const c of group) {
                          if (on) next.delete(c.id);
                          else next.add(c.id);
                        }
                        return next;
                      })
                    }
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-base font-bold transition sm:gap-2.5 sm:px-5 sm:py-3 sm:text-lg ${on ? "bg-ink text-cream" : "bg-ink/10 ring-1 ring-ink/15 hover:bg-ink/15"}`}
                  >
                    <ChannelIcon service={svc} className="size-5 shrink-0" />
                    {serviceLabel(svc)}
                    {group.length > 1 && (
                      <span className="font-normal opacity-80">
                        ({group.length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {blockedNetworks.length > 0 && (
              <p className="m-0 text-xs">
                Not supported yet:{" "}
                {blockedNetworks
                  .map(
                    (svc) =>
                      `${serviceLabel(svc)} (${unsupportedReason(svc)?.toLowerCase()})`,
                  )
                  .join(", ")}
                .
              </p>
            )}

            {networks
              .filter(
                (svc) =>
                  byService.get(svc)!.length > 1 &&
                  (byService.get(svc)!.some((c) => selected.has(c.id)) ||
                    held.has(svc)),
              )
              .map((svc) => {
                const group = byService.get(svc)!;
                const count = group.filter((c) => selected.has(c.id)).length;
                const all = count === group.length;
                const q = (queries[svc] ?? "").trim().toLowerCase();
                const rows = q
                  ? group.filter((c) => c.name.toLowerCase().includes(q))
                  : group;
                return (
                  <div
                    key={svc}
                    // tabIndex -1 lets a click on the box's padding keep focus inside it, so it doesn't count as leaving.
                    tabIndex={-1}
                    onChange={() => setHeld((h) => new Set(h).add(svc))}
                    onBlur={(e) => {
                      if (
                        e.currentTarget.contains(e.relatedTarget as Node | null)
                      )
                        return;
                      setHeld((h) => {
                        const next = new Set(h);
                        next.delete(svc);
                        return next;
                      });
                    }}
                    className="rounded-xl bg-surface/60 p-5 outline-none"
                  >
                    {/* Headings default to the display font; this is a quiet label, so use the body font. */}
                    <h3 className="m-0 mb-4 font-sans text-sm font-semibold">
                      Choose your {serviceLabel(svc)} channels:
                    </h3>
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
                        <Search
                          aria-hidden
                          className="size-4 shrink-0 text-ink/60"
                        />
                        <input
                          value={queries[svc] ?? ""}
                          onChange={(e) =>
                            setQueries((m) => ({ ...m, [svc]: e.target.value }))
                          }
                          placeholder={`Filter ${serviceLabel(svc)} channels`}
                          aria-label={`Filter ${serviceLabel(svc)} channels`}
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        />
                      </label>
                    )}
                    {/* Plain divided rows (no ring/shadow), so the scroll area has nothing to clip. */}
                    <ul className="max-h-60 divide-y divide-ink/10 overflow-y-auto">
                      {rows.length === 0 && (
                        <li className="py-3 text-sm">No channels match.</li>
                      )}
                      {rows.map((c) => (
                        <li key={c.id}>
                          <label
                            title={c.name}
                            className="flex min-w-0 cursor-pointer items-center gap-3 py-3"
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(c.id)}
                              onChange={() => toggle(c.id)}
                              className="size-[18px] accent-ink"
                            />
                            <ChannelIcon
                              service={c.service}
                              className="size-4 shrink-0 text-ink/60"
                            />
                            <span className="min-w-0 truncate">{c.name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        </section>
        <section className="min-w-0">
          <div>
            <h2 className="mb-3 text-2xl">
              {visible.length > 1 ? "Captions" : "Caption"}
            </h2>
            <div
              className="mb-3 flex flex-wrap items-center gap-1.5 text-sm"
              role="group"
              aria-label="Picks by"
            >
              <span className="mr-1 font-semibold">Picks by</span>
              {CAPTION_ORDERS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={order === o.id}
                  onClick={() => {
                    setOrder(o.id);
                    setEdited({});
                  }}
                  className={`rounded-full px-3 py-1 font-bold transition ${order === o.id ? "bg-ink text-cream" : "bg-surface ring-1 ring-ink/15 hover:bg-ink/10"}`}
                >
                  <span aria-hidden>{o.bullet}</span> {o.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-6 mt-0 text-sm">
            Choose how picks are listed.{" "}
            {visible.length > 1
              ? "Picking a different order replaces both captions. "
              : ""}
            Per-channel tweaks happen in Buffer.
          </p>
          {variant && activeTab ? (
            <>
              {visible.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Base caption"
                  className="flex items-end gap-1.5 px-3 sm:pl-6 sm:pr-0"
                >
                  {visible.map((v) => {
                    const on = activeTab === v.id;
                    return (
                      <button
                        key={v.id}
                        role="tab"
                        type="button"
                        id={`tab-${v.id}`}
                        aria-selected={on}
                        aria-controls="caption-panel"
                        onClick={() => setTab(v.id)}
                        className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-t-2xl px-3 text-sm font-bold transition sm:flex-none sm:px-6 sm:text-base ${on ? `${ACCENT[v.id].solid} relative z-10 -mb-[3px] py-3 text-ink-deep` : `${ACCENT[v.id].light} py-2`}`}
                      >
                        {v.id === "instagram" && (
                          <ChannelIcon
                            service="instagram"
                            className="size-4 shrink-0"
                          />
                        )}
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <div
                id="caption-panel"
                role={visible.length > 1 ? "tabpanel" : undefined}
                aria-labelledby={
                  visible.length > 1 ? `tab-${activeTab}` : undefined
                }
                className={`grid gap-3 rounded-2xl border-[3px] p-4 sm:p-5 ${ACCENT[activeTab].border}`}
              >
                <textarea
                  aria-label={`${variant.label} base caption`}
                  value={captionFor(activeTab)}
                  onChange={(e) =>
                    setEdited((m) => ({ ...m, [activeTab]: e.target.value }))
                  }
                  rows={12}
                  className="rounded-xl bg-surface px-3 py-2 ring-1 ring-ink/15"
                />
                {leftOut(activeTab).length > 0 && (
                  <p
                    role="status"
                    className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold"
                  >
                    {plural(leftOut(activeTab).length, "pick")} won&rsquo;t fit
                    in the {MAX_CAPTION_CHARS.toLocaleString("en")}-character
                    caption and will be left out:{" "}
                    {leftOut(activeTab).join(" · ")}. Pick fewer, or add{" "}
                    {leftOut(activeTab).length === 1 ? "it" : "them"} by hand.
                  </p>
                )}
                {visible.length > 1 && (
                  <p className="m-0 text-sm">
                    <span className="font-semibold">{variant.note}</span> Used
                    for {plural(used.length, "selected channel")}.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button
                    type="button"
                    onClick={() => copyCaption(captionFor(activeTab))}
                    className="inline-flex w-fit items-center gap-2 rounded-xl bg-surface px-4 py-2 text-sm font-bold ring-1 ring-ink/15 transition hover:ring-ink/40"
                  >
                    {copied ? (
                      <Check aria-hidden className="size-4" strokeWidth={3} />
                    ) : (
                      <Copy aria-hidden className="size-4" strokeWidth={2.25} />
                    )}
                    <span role="status">
                      {copied ? "Caption copied" : "Copy caption"}
                    </span>
                  </button>
                  {edited[activeTab] !== undefined && (
                    <button
                      type="button"
                      onClick={() =>
                        setEdited((m) => {
                          const rest = { ...m };
                          delete rest[activeTab];
                          return rest;
                        })
                      }
                      className="w-fit text-sm font-semibold underline underline-offset-4"
                    >
                      Reset to template (
                      {CAPTION_ORDERS.find(
                        (o) => o.id === order,
                      )?.label.toLowerCase()}
                      )
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="rounded-2xl border-[3px] border-ink/15 p-4 text-sm sm:p-5">
              Select a channel to see its caption.
            </p>
          )}
        </section>
      </div>

      <FlowBar back={{ href: backHref, label: "Design" }}>
        <span className="text-sm font-semibold" aria-live="polite">
          {n === 0
            ? "Select at least one channel"
            : `${plural(n, "channel")} selected`}
        </span>
        {n === 0 ? (
          <span aria-disabled className={primaryDisabled}>
            Continue
          </span>
        ) : (
          <Link href={nextHref} className={primaryButton}>
            Continue
          </Link>
        )}
      </FlowBar>
    </>
  );
}
