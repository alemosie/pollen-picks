"use client";

import { useEffect, useRef, useState } from "react";
import { SavedFlash } from "@/components/SavedFlash";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import Link from "next/link";
import { FlowBar, primaryButton, primaryDisabled } from "@/components/FlowBar";
import { loadFormat, saveFormat } from "@/lib/progress";
import { Check, Copy, X } from "lucide-react";
import { ChannelIcon } from "@/components/ChannelIcon";
import type { Channel } from "@/components/ChannelPicker";
import {
  CAPTION_ORDERS,
  CAPTION_VARIANTS,
  buildCaption,
  captionLeftOut,
  limitOf,
  variantFor,
  variantLimit,
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
  short: {
    solid: "bg-blush",
    light: "bg-blush/30 hover:bg-blush/60",
    border: "border-blush",
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
  const taggedCount = captionItems.filter((i) => i.tag).length;
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
  const [linkHelp, setLinkHelp] = useState(false);
  // Remember order, tab and caption edits for this set of picks + template, so a detour doesn't lose them.
  const sig = `${link}|${picks.join(",")}|${template}`;
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      const f = loadFormat();
      if (f && f.sig === sig) {
        if (CAPTION_ORDERS.some((o) => o.id === f.order)) setOrder(f.order as CaptionOrder);
        setEdited(f.edited as Partial<Record<CaptionVariant, string>>);
        if (f.tab === "instagram" || f.tab === "link" || f.tab === "short") setTab(f.tab);
      }
      setRestored(true);
    }, 0);
    return () => clearTimeout(t);
  }, [sig]);
  useEffect(() => {
    if (restored) saveFormat({ sig, order, edited: edited as Record<string, string>, tab });
  }, [restored, sig, order, edited, tab]);

  // The room each caption has: the tightest limit among the connected networks that use it, so the same text fits all of them.
  const limitFor = (v: CaptionVariant) => variantLimit(v, usable.filter((c) => variantFor(c.service) === v).map((c) => c.service));
  const generated = (variant: CaptionVariant) =>
    buildCaption(captionItems, { newsletter, author, creditLink, heading, order, variant, link, limit: limitFor(variant) });
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
      ? captionLeftOut(captionItems, { newsletter, author, creditLink, heading, order, variant, link, limit: limitFor(variant) })
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
  // The tightest network of a caption is the one that sets its limit: say which.
  const tightest = (v: CaptionVariant) => {
    const limit = limitFor(v);
    return [...new Set(usedBy(v).filter((c) => limitOf(c.service) === limit).map((c) => serviceLabel(c.service)))].sort();
  };

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
              <div role="tablist" aria-label="Captions" className="flex items-end gap-1.5 px-3 sm:pl-6 sm:pr-0">
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
                aria-label={`${variant.label} caption`}
                value={captionFor(activeTab)}
                onChange={(e) => setEdited((m) => ({ ...m, [activeTab]: e.target.value }))}
                rows={12}
                className="rounded-xl bg-surface px-3 py-2 ring-1 ring-ink/15"
              />
              {leftOut(activeTab).length > 0 && (
                <p role="status" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
                  {plural(leftOut(activeTab).length, "pick")} won&rsquo;t fit in the{" "}
                  {limitFor(activeTab).toLocaleString("en")}-character caption and will be left out:{" "}
                  {leftOut(activeTab).join(" · ")}. Pick fewer, or add {leftOut(activeTab).length === 1 ? "it" : "them"} by
                  hand.
                </p>
              )}
              <CharCount text={captionFor(activeTab)} limit={limitFor(activeTab)} networks={tightest(activeTab)} />
              {activeTab === "instagram" && edited.instagram === undefined && taggedCount > 0 && (
                <p className="m-0 flex items-start gap-2 text-sm">
                  <ChannelIcon service="instagram" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {plural(taggedCount, "pick")} link{taggedCount === 1 ? "s" : ""} to an Instagram account, so{" "}
                    {taggedCount === 1 ? "its line ends" : "their lines end"} with{" "}
                    <span className="font-semibold">&ldquo;From @handle&rdquo;</span> — that tags the account when you post.
                  </span>
                </p>
              )}
              {activeTab !== "instagram" && (
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
                {activeTab === "instagram" && (
                  <button type="button" onClick={() => setLinkHelp(true)} className="w-fit text-sm font-semibold underline underline-offset-4">
                    Where&rsquo;s my source link?
                  </button>
                )}
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

      {linkHelp && (
        <SourceLinkHelp
          link={link}
          creditLink={Boolean(creditLink)}
          otherPlatforms={usedBy("link").length + usedBy("short").length > 0}
          onClose={() => setLinkHelp(false)}
        />
      )}

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

/** Why the Instagram caption has no clickable link, and the link to put in the bio instead. */
function SourceLinkHelp({
  link,
  creditLink,
  otherPlatforms,
  onClose,
}: {
  link: string;
  creditLink: boolean;
  otherPlatforms: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      aria-labelledby="source-link-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-cream p-6 text-ink shadow-xl backdrop:bg-ink/50"
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <h2 id="source-link-title" className="m-0 text-2xl">
          Where&rsquo;s my source link?
        </h2>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-ink/10">
          <X aria-hidden className="size-5" strokeWidth={2.5} />
        </button>
      </div>
      {creditLink ? (
        <p className="mb-4 mt-0 text-sm">
          This post comes from someone else&rsquo;s newsletter, so the caption ends with a link to the original. Instagram doesn&rsquo;t make links in captions
          clickable, so readers would have to copy it. Put it in your bio to make it one tap.
        </p>
      ) : (
        <p className="mb-4 mt-0 text-sm">
          Instagram doesn&rsquo;t make links in captions clickable, so the caption says &ldquo;Link in bio&rdquo; instead of showing the link. To send readers
          to your newsletter, put this link in your Instagram bio:
        </p>
      )}
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-surface p-2 pl-4 ring-1 ring-ink/15">
        <span className="min-w-0 flex-1 truncate font-mono text-sm" title={link}>
          {link}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
            } catch {
              window.prompt("Copy this link", link);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-bold text-cream hover:bg-ink-deep"
        >
          {copied ? <Check aria-hidden className="size-4" strokeWidth={3} /> : <Copy aria-hidden className="size-4" strokeWidth={2.25} />}
          <span role="status">{copied ? "Copied" : "Copy link"}</span>
        </button>
      </div>
      {otherPlatforms && <p className="m-0 text-sm">Your other platforms&rsquo; captions include the link directly.</p>}
    </dialog>
  );
}

/** How much of the limit the caption uses. Over it, the Send step won't send to the networks it is too long for. */
function CharCount({ text, limit, networks }: { text: string; limit: number; networks: string[] }) {
  const over = text.length - limit;
  return (
    <p className={`m-0 text-sm ${over > 0 ? "border-l-4 border-coral pl-3 font-semibold" : ""}`} role={over > 0 ? "alert" : undefined}>
      <span className="font-semibold">
        {text.length.toLocaleString("en")} / {limit.toLocaleString("en")} characters
      </span>
      {networks.length > 0 && <> (the limit of {list(networks)})</>}
      {over > 0 && (
        <>
          {" "}
          &mdash; {over.toLocaleString("en")} over. Shorten it here, or leave {networks.length > 0 ? list(networks) : "those networks"} out on the next step.
        </>
      )}
    </p>
  );
}
