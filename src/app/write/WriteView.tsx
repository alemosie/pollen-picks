"use client";

import { useEffect, useState } from "react";
import { SavedFlash } from "@/components/SavedFlash";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import Link from "next/link";
import { FlowBar, primaryButton, primaryDisabled } from "@/components/FlowBar";
import { loadFormat, saveFormat } from "@/lib/progress";
import { Check, Copy } from "lucide-react";
import { ChannelIcon } from "@/components/ChannelIcon";
import type { Channel } from "@/components/ChannelPicker";
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

/** Same accents as the pick-type tabs on /pick. */
const ACCENT: Record<CaptionVariant, { solid: string; light: string; border: string }> = {
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

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (items: string[]) =>
  items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * Write the caption. Where it goes is chosen on the next step, so this shows a caption for each kind of network the account
 * has connected (Instagram, and "everything else"), not only for the channels that end up ticked.
 */
export function WriteView({
  channels,
  picks,
  captionItems,
  newsletter,
  author,
  creditLink,
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
  author?: string | null;
  creditLink?: boolean;
  heading?: string;
  template: string;
  link: string;
  backHref: string;
  nextHref: string;
  /** Public demo: the channels are examples. */
  demo?: boolean;
}) {
  const usable = channels.filter((c) => !unsupportedReason(c.service));
  const [chosenOrder, setOrder] = useState<CaptionOrder>("clicks");
  // Only the orders the picks can support: highlights have no click ranking and no dates, so they can only go A–Z.
  const orders = CAPTION_ORDERS.filter(
    (o) =>
      o.id === "alpha" ||
      captionItems.some((i) => (o.id === "clicks" ? i.rank != null : i.date != null)),
  );
  const order = orders.some((o) => o.id === chosenOrder) ? chosenOrder : orders[0].id;
  const [edited, setEdited] = useState<Partial<Record<CaptionVariant, string>>>({});
  const [tab, setTab] = useState<CaptionVariant>("instagram");
  const [copied, setCopied] = useState(false);
  // Remember order, tab and caption edits for this set of picks + template, so a detour doesn't lose them.
  const sig = `${link}|${picks.join(",")}|${template}`;
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      const f = loadFormat();
      if (f && f.sig === sig) {
        if (CAPTION_ORDERS.some((o) => o.id === f.order)) setOrder(f.order as CaptionOrder);
        setEdited(f.edited as Partial<Record<CaptionVariant, string>>);
        if (f.tab === "instagram" || f.tab === "link") setTab(f.tab);
      }
      setRestored(true);
    }, 0);
    return () => clearTimeout(t);
  }, [sig]);
  useEffect(() => {
    if (restored) saveFormat({ sig, order, edited: edited as Record<string, string>, tab });
  }, [restored, sig, order, edited, tab]);

  const generated = (variant: CaptionVariant) =>
    buildCaption(captionItems, { newsletter, author, creditLink, heading, order, variant, link });
  const captionFor = (variant: CaptionVariant) => edited[variant] ?? generated(variant);
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
      ? captionLeftOut(captionItems, { newsletter, author, creditLink, heading, order, variant, link })
      : [];

  if (channels.length === 0)
    return (
      <p className="mt-10 font-semibold">
        No Buffer channels found on this account. Connect one in Buffer first.
      </p>
    );

  // Networks the account has connected, by the caption they use.
  const usedBy = (v: CaptionVariant) => usable.filter((c) => variantFor(c.service) === v);
  const visible = CAPTION_VARIANTS.filter((v) => usedBy(v.id).length > 0);
  const activeTab = visible.find((v) => v.id === tab)?.id ?? visible[0]?.id;
  const variant = CAPTION_VARIANTS.find((v) => v.id === activeTab);
  const networksFor = (v: CaptionVariant) => [...new Set(usedBy(v).map((c) => serviceLabel(c.service)))].sort();

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h1 className="mb-3 text-4xl sm:text-5xl">
            <StepWord>Write</StepWord> your {visible.length > 1 ? "captions" : "caption"}
          </h1>
          <div className="flex shrink-0 items-center gap-3 sm:mt-2">
            <SavedFlash />
            <ShareLinkButton />
          </div>
        </div>
        <p className="mb-0 max-w-2xl text-lg">
          Choose how the caption reads. You&rsquo;ll pick where it goes, and review everything, on the next step.
          {demo ? " In demo mode, the channels are examples." : ""}
        </p>
      </div>

      <section className="min-w-0 max-w-3xl">
        {orders.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm" role="group" aria-label="Picks by">
            <span className="mr-1 font-semibold">Picks by</span>
            {orders.map((o) => (
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
        )}
        <p className="mb-6 mt-0 text-sm">
          {orders.length > 1 ? "Choose how picks are listed. " : ""}
          {orders.length > 1 && visible.length > 1 ? "Picking a different order replaces both captions. " : ""}
          Per-channel tweaks happen in Buffer.
        </p>
        {variant && activeTab ? (
          <>
            {visible.length > 1 && (
              <div role="tablist" aria-label="Base caption" className="flex items-end gap-1.5 px-3 sm:pl-6 sm:pr-0">
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
                      {v.id === "instagram" && <ChannelIcon service="instagram" className="size-4 shrink-0" />}
                      {v.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div
              id="caption-panel"
              role={visible.length > 1 ? "tabpanel" : undefined}
              aria-labelledby={visible.length > 1 ? `tab-${activeTab}` : undefined}
              className={`grid gap-3 rounded-2xl border-[3px] p-4 sm:p-5 ${ACCENT[activeTab].border}`}
            >
              <textarea
                aria-label={`${variant.label} base caption`}
                value={captionFor(activeTab)}
                onChange={(e) => setEdited((m) => ({ ...m, [activeTab]: e.target.value }))}
                rows={12}
                className="rounded-xl bg-surface px-3 py-2 ring-1 ring-ink/15"
              />
              {leftOut(activeTab).length > 0 && (
                <p role="status" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
                  {plural(leftOut(activeTab).length, "pick")} won&rsquo;t fit in the{" "}
                  {MAX_CAPTION_CHARS.toLocaleString("en")}-character caption and will be left out:{" "}
                  {leftOut(activeTab).join(" · ")}. Pick fewer, or add {leftOut(activeTab).length === 1 ? "it" : "them"} by
                  hand.
                </p>
              )}
              {visible.length > 1 && (
                <p className="m-0 text-sm">
                  <span className="font-semibold">{variant.note}</span> Used for your {list(networksFor(activeTab))}{" "}
                  {usedBy(activeTab).length === 1 ? "channel" : "channels"}.
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
                  <span role="status">{copied ? "Caption copied" : "Copy caption"}</span>
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
                    Reset to template ({CAPTION_ORDERS.find((o) => o.id === order)?.label.toLowerCase()})
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="rounded-2xl border-[3px] border-ink/15 p-4 text-sm sm:p-5">
            None of your Buffer channels can take a carousel yet, so there is no caption to write. Connect another channel in
            Buffer.
          </p>
        )}
      </section>

      <FlowBar next={visible.length === 0 ? null : { href: nextHref }} back={{ href: backHref, label: "Design" }}>
        {visible.length === 0 ? (
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
