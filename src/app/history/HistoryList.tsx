"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDismiss } from "@/components/useDismiss";
import { Check, ChevronRight, CircleHelp, FileText, RefreshCw } from "lucide-react";
import { ChannelIcon } from "@/components/ChannelIcon";
import { PollenSpinner } from "@/components/PollenSpinner";
import type { HistoryEntry } from "@/lib/postHistory";
import { SLIDE_LINK_DAYS, slideLinkState } from "@/lib/slideLinks";
import { useHistory } from "./HistoryProvider";

/** A publish still "sending" after this long needs a look in Buffer. */
const SLOW_AFTER_MS = 10 * 60_000;

const when = (iso: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

function describe(c: HistoryEntry, now: number): { text: string; busy?: boolean; tone?: "bad" | "warn"; detail?: string } {
  if (c.status === "queued" && c.heldUp)
    return { text: "Waiting for Buffer", busy: true, detail: "Buffer asked us to slow down a little. This one is safe and is tried again automatically while this page is open." };
  if (c.status === "queued") return { text: "Waiting to send", busy: true, detail: "In the queue. It goes out on its own, so you can leave this page." };
  if (c.status === "working") return { text: "Sending to Buffer…", busy: true, detail: "Pollen Picks is creating this in Buffer now." };
  if (c.status === "failed")
    return {
      text: "Failed",
      tone: "bad",
      detail: `${c.error ?? "Buffer didn't accept this post."}${c.retryable ? "" : " Retrying only works for 24 hours after sending, so use the app to send it again."}`,
    };
  if (c.status === "unknown")
    return { text: "Unknown, check Buffer", tone: "warn", detail: `The request didn't finish, so this may or may not have gone out. Check Buffer first, then send it again if it isn't there.${c.resendable ? "" : " Sending again from here only works for 24 hours, so use the app to send it again."}` };
  if (c.status === "removed")
    return { text: "Deleted in Buffer", detail: "This draft is no longer in Buffer, so it won't go out from there. If you still want to post it, send it again from the app." };
  if (c.status === "scheduled")
    return { text: "Scheduled in Buffer", ...(c.slidesStored ? {} : { detail: `Slide images stay linked for ${SLIDE_LINK_DAYS} days after sending. If it is scheduled for later than that, send it again from the app closer to the date.` }) };
  // Only while it is still a draft: once the person has published it in Buffer it falls through to "Live" below, with its link.
  if (c.mode === "draft" && c.status === "draft") {
    const links = slideLinkState(c, now);
    if (links === "expired")
      return {
        text: "Slides expired",
        tone: "bad",
        detail: `Still a draft as far as Pollen Picks knows. Its slide links worked for ${SLIDE_LINK_DAYS} days and have run out, so Buffer may show broken images. If it hasn't gone out, send it again from the app to get fresh ones.`,
      };
    if (links === "soon")
      return {
        text: "Slides expiring soon",
        tone: "warn",
        detail: `The slides in this post will be expiring soon. Their links stop working ${SLIDE_LINK_DAYS} days after sending, so publish or schedule it, or send it again from the app.`,
      };
    return { text: "Draft in Buffer", detail: c.error ?? undefined };
  }
  if (c.status === "sent") return { text: c.liveUrl ? "Live" : "Published" };
  if (c.status === "error") return { text: "Buffer couldn't publish this", tone: "bad", detail: "Open it in Buffer to see why and try again there." };
  if (c.status === "needs_approval") return { text: "Needs approval in Buffer", tone: "warn" };
  if (now - new Date(c.createdAt).getTime() > SLOW_AFTER_MS)
    return { text: "Still processing at Buffer", tone: "warn", detail: "This is taking longer than usual. Open it in Buffer for the latest status." };
  return { text: "Publishing…", busy: true, detail: "Buffer is still sending this to the network." };
}

/** Entries that need the person to do something: the failed, the maybe-lost, the ones Buffer refused or holds for approval, and drafts whose slide links are about to run out (or have). */
const needsAttention = (c: HistoryEntry, now: number | null) =>
  c.status === "failed" || c.status === "unknown" || c.status === "error" || c.status === "needs_approval" || slideLinkState(c, now) !== "ok";
const inProgress = (c: HistoryEntry) => c.status === "queued" || c.status === "working" || c.status === "sending";

/** One press of Send: its entries, newest send first. Entries from before sends were grouped fall back to the same issue at the same minute. */
type Group = { key: string; entries: HistoryEntry[] };
function groupBySend(items: HistoryEntry[]): Group[] {
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
  for (const c of items) {
    const key = c.batchId ?? `${c.issueTitle}|${c.createdAt.slice(0, 16)}`;
    let g = byKey.get(key);
    if (!g) {
      g = { key, entries: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.entries.push(c);
  }
  return groups;
}

/** "12 channels · 9 live · 1 draft · 2 need attention": what became of one send, at a glance. */
function summarize(entries: HistoryEntry[], now: number | null) {
  const n = (f: (c: HistoryEntry) => boolean) => entries.filter(f).length;
  const bad = n((c) => needsAttention(c, now));
  const going = n(inProgress);
  const quiet = (c: HistoryEntry) => !needsAttention(c, now) && !inProgress(c);
  const drafts = n((c) => quiet(c) && c.mode === "draft" && c.status === "draft");
  const scheduled = n((c) => quiet(c) && c.status === "scheduled");
  const gone = n((c) => quiet(c) && c.status === "removed");
  const live = entries.length - bad - going - drafts - scheduled - gone;
  return { total: entries.length, bad, going, drafts, scheduled, gone, live };
}

/** The History page: every attempt to create a post in Buffer for this account, failed ones too, with the Buffer link and live link. */
export function HistoryList({ filterQuery = "" }: { /** The page's filters as a query string, only to tell "nothing yet" from "nothing matches". */ filterQuery?: string }) {
  const { items, now, error, watching, gaveUp, retrying, retry, check, checking } = useHistory();
  const retryable = items.filter((c) => c.retryable);
  const attention = items.filter((c) => needsAttention(c, now));
  const groups = groupBySend(items);
  const [picked, setPicked] = useState<"attention" | "all" | null>(null);
  // Opens on what needs doing, if anything does; a link to one entry opens All.
  const tab = picked ?? (attention.length > 0 ? "attention" : "all");
  // Retrying a failed live post publishes it, and sending an unknown one again may post it twice, so both ask first (like Send now does).
  // Drafts that failed retry at once.
  const [confirming, setConfirming] = useState<{ ids: number[]; again: boolean } | null>(null);
  const live = (ids: number[]) => items.filter((c) => ids.includes(c.id) && c.mode === "now").length;
  const ask = (ids: number[], again = false) => (again || live(ids) > 0 ? setConfirming({ ids, again }) : retry(ids));
  const confirmed = (ids: number[], again: boolean) => {
    setConfirming(null);
    retry(ids, true, again);
  };
  const confirmBox = ({ ids, again }: { ids: number[]; again: boolean }) => {
    const n = live(ids);
    return (
      <div role="group" aria-label="Confirm" className="mt-2 grid gap-2 rounded-lg bg-honey/30 p-2 text-xs">
        <p role="alert" className="m-0 font-semibold">
          {again
            ? `The first try may already be in Buffer. Check there first: sending again can ${n > 0 ? "post it twice" : "leave you with two drafts"}.`
            : ids.length === 1
              ? "This goes live on the network right away."
              : `${n} of these ${n === 1 ? "goes" : "go"} live on the network right away${n < ids.length ? `, the rest become drafts` : ""}.`}
        </p>
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={() => confirmed(ids, again)} className="rounded-lg bg-coral px-3 py-1.5 font-bold text-ink-deep hover:brightness-95">
            {again ? "Send again anyway" : ids.length === 1 ? "Yes, publish now" : `Yes, retry ${ids.length}`}
          </button>
          <button type="button" onClick={() => setConfirming(null)} className="rounded-lg bg-surface px-3 py-1.5 font-bold ring-1 ring-ink/20 hover:ring-ink/40">
            Cancel
          </button>
        </span>
      </div>
    );
  };
  const here = (id: number) => confirming?.ids.length === 1 && confirming.ids[0] === id;

  // A link like /history#entry-123 (from the sent window) scrolls to that row and marks it for a few seconds. Done once, when the page opens.
  const [marked, setMarked] = useState<string | null>(null);
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || items.length === 0) return;
    const id = window.location.hash.slice(1);
    if (!/^entry-\d+$/.test(id)) return;
    const t = setTimeout(() => {
      // Marked done inside the timer: React's development double-run of effects clears the first timer, and the second run must still go ahead.
      jumped.current = true;
      setPicked("all");
      setTimeout(() => {
        const el = document.getElementById(id);
        if (!el) return;
        const box = el.closest("details");
        if (box) box.open = true;
        el.scrollIntoView({ block: "center" });
        setMarked(id);
        setTimeout(() => setMarked(null), 4_000);
      }, 50);
    }, 0);
    return () => clearTimeout(t);
  }, [items.length]);

  if (items.length === 0)
    return (
      <p className="m-0 rounded-xl bg-surface p-4 text-sm font-semibold">
        {filterQuery ? "Nothing matches these filters." : "Nothing here yet. Every draft or post you send to Buffer, and any that fail, will be listed here."}
      </p>
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <p className="m-0 text-sm">
        {groups.length} {groups.length === 1 ? "send" : "sends"}, {items.length} {items.length === 1 ? "entry" : "entries"}
        {filterQuery ? " match" : ""}, newest first.
      </p>
      {watching && (
        <p role="status" className="m-0 flex items-center gap-2 text-sm font-semibold">
          <PollenSpinner className="size-4" />
          Watching for updates&hellip; this list refreshes on its own.
        </p>
      )}
      {gaveUp && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 border-honey pl-3 text-sm font-semibold">
          Still waiting on Buffer.
          <button
            type="button"
            onClick={check}
            disabled={checking}
            className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 font-bold ring-1 ring-ink/20 hover:ring-ink/40 disabled:opacity-60"
          >
            {checking && <PollenSpinner className="size-4" />}
            {checking ? "Checking Buffer…" : "Check Buffer for updates"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
          {error}
        </p>
      )}
      <div>
      <div className="flex items-center gap-2 px-3 sm:pl-6 sm:pr-0">
      <div role="tablist" aria-label="Which posts to show" className="flex min-w-0 flex-1 items-end gap-1.5 sm:flex-none">
        {(
          [
            { id: "attention", label: `Needs a look (${attention.length})`, grow: "max-sm:flex-[3]", solid: "bg-coral", light: "bg-coral/30 hover:bg-coral/50" },
            { id: "all", label: `All (${items.length})`, grow: "max-sm:flex-[2]", solid: "bg-sage", light: "bg-sage/20 hover:bg-sage/40" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setPicked(t.id)}
            className={`${t.grow} whitespace-nowrap rounded-t-2xl px-2 text-sm font-bold transition min-[420px]:text-base sm:flex-none sm:px-6 sm:text-lg ${
              tab === t.id ? `${t.solid} relative z-10 -mb-[3px] py-3.5 text-ink-deep` : `${t.light} py-2.5`
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={check}
        disabled={checking}
        title="Fetch most recent post status from Buffer"
        aria-label="Fetch most recent post status from Buffer"
        className="grid size-9 shrink-0 place-items-center self-end rounded-full mb-0.5 sm:mb-2 text-ink/70 transition hover:bg-ink/10 hover:text-ink disabled:opacity-60"
      >
        <RefreshCw aria-hidden className={`size-4 ${checking ? "motion-safe:animate-spin" : ""}`} strokeWidth={2.5} />
      </button>
      </div>
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border-[3px] p-4 sm:p-5 ${tab === "attention" ? "border-coral" : "border-sage"}`}>
      {tab === "attention" && (
        attention.length === 0 ? (
          <p role="tabpanel" className="m-0 text-sm font-semibold">Nothing needs a look. Every post went through.</p>
        ) : (
        <section role="tabpanel" aria-label="Needs a look">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {attention.some((c) => c.retryable || c.resendable) && (
              <p className="m-0 min-w-0 flex-1 basis-64 text-xs">
                Failed posts can be retried for <strong>24 hours</strong> after they were sent. After that, their caption is deleted and you send them again from the app.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {retryable.length > 1 && (
                <button
                  type="button"
                  onClick={() => ask(retryable.map((c) => c.id))}
                  disabled={retrying}
                  className="inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-2 text-sm font-bold text-ink-deep hover:brightness-95 disabled:opacity-60"
                >
                  {retrying && <PollenSpinner className="size-4" />}
                  Retry all {retryable.length} failed
                </button>
              )}
              <a
                href="https://publish.buffer.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-honey px-4 py-2 text-sm font-bold text-ink-deep hover:brightness-95"
              >
                Open Buffer
              </a>
            </div>
          </div>
          {confirming && confirming.ids.length > 1 && confirmBox(confirming)}
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
            {groupBySend(attention).map((g, gi) => (
              <details key={g.key} open={gi === 0 ? true : undefined} className="group overflow-hidden rounded-xl bg-surface ring-1 ring-ink/10">
                <summary className="flex cursor-pointer list-none items-start gap-2 rounded-xl p-4 group-open:rounded-b-none group-open:bg-coral/15 group-open:pb-3 [&::-webkit-details-marker]:hidden">
                  <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 transition-transform group-open:rotate-90" strokeWidth={2.5} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold" title={g.entries[0].issueTitle}>
                      {g.entries[0].issueTitle || g.entries[0].newsletter}
                    </span>
                    <time dateTime={g.entries[0].createdAt} suppressHydrationWarning className="block text-xs text-ink/80">
                      {now === null ? "" : when(g.entries[0].createdAt)}
                    </time>
                    <span className="mt-1 block text-sm">{g.entries.length} need a look</span>
                  </span>
                  <SendStatus entries={g.entries} now={now} />
                </summary>
                <ul className="m-0 mx-4 mb-2 grid list-none divide-y divide-ink/10 border-t border-ink/10 p-0">
            {g.entries.map((c) => {
              const v = describe(c, now ?? new Date(c.createdAt).getTime());
              return (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-64">
                      <span className="flex min-w-0 items-center gap-2">
                        <ChannelIcon service={c.service} className="size-4 shrink-0 text-ink/60" />
                        <span title={c.channelName} className="min-w-0 truncate font-semibold">
                          {c.channelName || c.service}
                        </span>
                      </span>
                      <span className="mt-1 block pl-6 text-sm">{v.text}</span>
                      {v.detail && <span className="block pl-6 text-xs">{v.detail}</span>}
                      {(c.retryable || c.resendable) && c.retryUntil && !here(c.id) && (
                        <span className="block pl-6 text-xs text-ink/80">
                          {c.retryable ? "Retry" : "Send again"} until {when(c.retryUntil)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
                      {c.retryable && !here(c.id) && (
                        <button
                          type="button"
                          aria-label={`Retry ${c.channelName || c.service}${c.mode === "now" ? " (publishes live)" : ""}`}
                          onClick={() => ask([c.id])}
                          disabled={retrying}
                          className="rounded-lg bg-coral px-3 py-1.5 text-sm font-bold text-ink-deep hover:brightness-95 disabled:opacity-60"
                        >
                          Retry
                        </button>
                      )}
                      {c.resendable && !here(c.id) && (
                        <button
                          type="button"
                          aria-label={`Send again to ${c.channelName || c.service}, after checking Buffer`}
                          onClick={() => ask([c.id], true)}
                          disabled={retrying}
                          className="rounded-lg bg-surface px-3 py-1.5 text-sm font-bold ring-1 ring-ink/20 hover:ring-ink/40 disabled:opacity-60"
                        >
                          Send again
                        </button>
                      )}
                      <BufferLink c={c} />
                    </div>
                  </div>
                  {(c.retryable || c.resendable) && here(c.id) && confirming && confirmBox(confirming)}
                </li>
              );
            })}
                </ul>
              </details>
            ))}
          </div>
        </section>
        )
      )}
      {tab === "all" && (
      <div role="tabpanel" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {groups.map((g, i) => {
          const sum = summarize(g.entries, now);
          const first = g.entries[0];
          return (
            <details key={g.key} open={i === 0 ? true : undefined} className="group overflow-hidden rounded-xl bg-surface ring-1 ring-ink/10">
              <summary className="flex cursor-pointer list-none items-start gap-2 rounded-xl p-4 group-open:rounded-b-none group-open:bg-sage/30 group-open:pb-3 [&::-webkit-details-marker]:hidden">
                <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 transition-transform group-open:rotate-90" strokeWidth={2.5} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold" title={first.issueTitle}>
                    {first.issueTitle || first.newsletter}
                  </span>
                  <time dateTime={first.createdAt} suppressHydrationWarning className="block text-xs text-ink/80">
                    {now === null ? "" : when(first.createdAt)}
                  </time>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                    <span>{sum.total} {sum.total === 1 ? "channel" : "channels"}</span>
                    {sum.live > 0 && <span>{sum.live} live</span>}
                    {sum.drafts > 0 && <span>{sum.drafts} {sum.drafts === 1 ? "draft" : "drafts"}</span>}
                    {sum.scheduled > 0 && <span>{sum.scheduled} scheduled</span>}
                    {sum.gone > 0 && <span>{sum.gone} deleted</span>}
                    {sum.going > 0 && <span>{sum.going} in progress</span>}
                    {sum.bad > 0 && <span>{sum.bad} need a look</span>}
                  </span>
                </span>
                <SendStatus entries={g.entries} now={now} />
              </summary>
              <div className="overflow-x-auto px-4 pb-3">
                <table className="w-full border-collapse text-left text-sm max-sm:block sm:min-w-[34rem] sm:table-fixed">
                  <caption className="sr-only">Posts from this send</caption>
                  {/* Fixed link columns, so they line up from one send to the next whether or not anything is live. */}
                  <colgroup className="max-sm:hidden">
                    <col />
                    <col />
                    <col className="w-40" />
                    <col className="w-28" />
                    <col className="w-10" />
                  </colgroup>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Channel</th>
                      <th scope="col">Status</th>
                      <th scope="col">In Buffer</th>
                      <th scope="col">Live post</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody className="max-sm:block">
                    {g.entries.map((c) => {
                      const v = describe(c, now ?? new Date(c.createdAt).getTime());
                      const bad = needsAttention(c, now);
                      return (
                        <tr key={c.id} id={`entry-${c.id}`} className={`border-t border-ink/10 align-top transition-colors duration-700 max-sm:relative max-sm:block max-sm:py-3 ${marked === `entry-${c.id}` ? "bg-honey/30" : ""}`}>
                          <td className="py-2.5 pr-4 max-sm:block max-sm:py-0 max-sm:pr-8">
                            <span className="flex min-w-0 items-center gap-2">
                              <ChannelIcon service={c.service} className="size-4 shrink-0 text-ink/60" />
                              <span title={c.channelName} className="min-w-0 truncate font-semibold">
                                {c.channelName || c.service}
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 max-sm:block max-sm:py-0 max-sm:pl-6 max-sm:pr-8 empty:max-sm:hidden">
                            {/* The icon says how it stands (tap it for the words); only the extra explanation is written out. */}
                            {!bad && v.detail && <span className="block text-xs text-ink/80">{v.detail}</span>}
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-6 text-right max-sm:mr-5 max-sm:ml-6 max-sm:mt-1 max-sm:inline-block max-sm:p-0 max-sm:text-left empty:max-sm:hidden">
                            <BufferLink c={c} />
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-right max-sm:mt-1 max-sm:inline-block max-sm:p-0 max-sm:text-left empty:max-sm:hidden">
                            {c.liveUrl && (
                              <a href={c.liveUrl} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                                Live post
                              </a>
                            )}
                          </td>
                          <td className="relative py-2.5 text-right max-sm:absolute max-sm:right-0 max-sm:top-3 max-sm:p-0">
                            <EntryStatus c={c} label={v.text} now={now} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
      )}
      </div>
      </div>
    </div>
  );
}

/** The link into Buffer for one entry: the post itself, or Buffer in general when it may not exist. */
function BufferLink({ c }: { c: HistoryEntry }): ReactNode {
  // Buffer no longer has this post, so its page would be empty: say so instead of linking to it.
  if (c.status === "removed") return <span className="font-semibold text-ink/80">Deleted in Buffer</span>;
  if (c.postId)
    return (
      <a href={`https://publish.buffer.com/posts/${encodeURIComponent(c.postId)}`} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
        See in Buffer
      </a>
    );
  return null;
}

/** One icon for one post: how it stands, at a glance. */
function EntryStatus({ c, label, now }: { c: HistoryEntry; label: string; now: number | null }) {
  const cls = "size-5 shrink-0";
  if (inProgress(c))
    return (
      <IconTip label={label}>
        <PollenSpinner className={cls} />
      </IconTip>
    );
  const icon = needsAttention(c, now) ? (
    c.status === "unknown" ? (
      <CircleHelp className={`${cls} text-ink/70`} strokeWidth={1.5} />
    ) : (
      <Alert className={cls} />
    )
  ) : c.mode === "draft" && (c.status === "draft" || c.status === "removed") ? (
    <FileText className={`${cls} text-ink/60`} strokeWidth={1.5} />
  ) : (
    <Done className={cls} />
  );
  return <IconTip label={label}>{icon}</IconTip>;
}

/** An icon that says what it means: on hover or keyboard focus, and on tap (a tap elsewhere closes it). */
function IconTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useDismiss(open, box, () => setOpen(false));
  return (
    <span ref={box} className="group/tip relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex rounded-full outline-offset-2"
      >
        {children}
      </button>
      <span
        aria-hidden
        className={`pointer-events-none absolute right-full top-1/2 z-20 mr-2 w-max max-w-48 -translate-y-1/2 rounded-lg bg-ink px-3 py-1.5 text-left text-xs font-semibold text-cream shadow-lg ${
          open ? "block" : "hidden group-hover/tip:block"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

/** Success: a filled honey circle with a check. */
function Done({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-grid place-items-center rounded-full bg-honey text-ink-deep ${className}`}>
      <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
    </span>
  );
}

/** One icon for a whole send: something needs a look, still going out, or all well. */
function SendStatus({ entries, now }: { entries: HistoryEntry[]; now: number | null }) {
  const { bad, going } = summarize(entries, now);
  const cls = "mt-0.5 size-6 shrink-0";
  if (bad > 0)
    return (
      <span role="img" aria-label="Needs a look" className="inline-flex">
        <Alert className={cls} />
      </span>
    );
  if (going > 0) return <PollenSpinner className={cls} />;
  return (
    <span role="img" aria-label="All went through" className="inline-flex">
      <Done className={cls} />
    </span>
  );
}

/** Something needs a look: a filled coral circle with an exclamation mark. */
function Alert({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-grid place-items-center rounded-full bg-coral text-sm font-bold leading-none text-ink-deep ${className}`}>
      !
    </span>
  );
}
