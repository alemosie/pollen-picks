"use client";

import { useEffect, useRef, useState } from "react";
import { ChannelIcon } from "@/components/ChannelIcon";
import { PollenSpinner } from "@/components/PollenSpinner";
import type { HistoryEntry } from "@/lib/postHistory";
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
  if (c.mode === "draft") return { text: "Draft in Buffer" };
  if (c.status === "sent") return { text: c.liveUrl ? "Live" : "Published" };
  if (c.status === "error") return { text: "Buffer couldn't publish this", tone: "bad", detail: "Open it in Buffer to see why and try again there." };
  if (c.status === "needs_approval") return { text: "Needs approval in Buffer", tone: "warn" };
  if (now - new Date(c.createdAt).getTime() > SLOW_AFTER_MS)
    return { text: "Still processing at Buffer", tone: "warn", detail: "This is taking longer than usual. Open it in Buffer for the latest status." };
  return { text: "Publishing…", busy: true, detail: "Buffer is still sending this to the network." };
}

/** The History page: every attempt to create a post in Buffer for this account, failed ones too, with the Buffer link and live link. */
export function HistoryList({ filterQuery = "" }: { /** The page's filters as a query string, only to tell "nothing yet" from "nothing matches". */ filterQuery?: string }) {
  const { items, now, error, watching, gaveUp, retrying, retry } = useHistory();
  const retryable = items.filter((c) => c.retryable);
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
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      setMarked(id);
      setTimeout(() => setMarked(null), 4_000);
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
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm">
          {items.length} {items.length === 1 ? "entry" : "entries"}
          {filterQuery ? " match" : ""}, newest first.
        </p>
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
        {confirming && confirming.ids.length > 1 && confirmBox(confirming)}
      </div>
      {items.some((c) => c.status === "failed" || c.status === "unknown") && (
        <p className="m-0 text-sm">
          Failed posts can be retried for <strong>24 hours</strong> after they were sent. After that, their caption is deleted and you send them again from the app.
        </p>
      )}
      {watching && (
        <p role="status" className="m-0 flex items-center gap-2 text-sm font-semibold">
          <PollenSpinner className="size-4" />
          Watching for updates&hellip; this list refreshes on its own.
        </p>
      )}
      {gaveUp && (
        <p role="status" className="m-0 border-l-4 border-honey pl-3 text-sm font-semibold">
          Still waiting on Buffer. Press &ldquo;Check Buffer for updates&rdquo; to try again.
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-auto max-w-full border-collapse text-left text-sm">
          <caption className="sr-only">Attempts to create posts in Buffer</caption>
          <thead>
            <tr className="border-b border-ink/15">
              <th scope="col" className="py-2 pr-3 font-bold">
                Post
              </th>
              <th scope="col" className="py-2 pr-3 font-bold">
                Status
              </th>
              <th scope="col" className="py-2 pr-6 font-bold">
                Buffer
              </th>
              <th scope="col" className="py-2 font-bold">
                Live post
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const v = describe(c, now ?? new Date(c.createdAt).getTime());
              return (
                <tr key={c.id} id={`entry-${c.id}`} className={`border-b border-ink/10 align-top transition-colors duration-700 ${marked === `entry-${c.id}` ? "bg-honey/30" : ""}`}>
                  <td className="py-3 pr-8">
                    <div className="max-w-[30rem]">
                    <span className="flex min-w-0 items-center gap-2">
                      <ChannelIcon service={c.service} className="size-4 shrink-0 text-ink/60" />
                      <span title={c.channelName} className="min-w-0 truncate font-semibold">
                        {c.channelName || c.service}
                      </span>
                    </span>
                    <span className="block truncate pl-6 text-xs text-ink/70" title={c.issueTitle}>
                      {c.issueTitle || c.newsletter}
                    </span>
                    <time dateTime={c.createdAt} suppressHydrationWarning className="block pl-6 text-xs text-ink/70">
                      {now === null ? "" : `${when(c.createdAt)}${c.slides ? ` · ${c.slides} ${c.slides === 1 ? "slide" : "slides"}` : ""}`}
                    </time>
                    </div>
                  </td>
                  <td className="min-w-[12rem] max-w-[24rem] py-3 pr-8">
                    <span className={`flex items-center gap-2 ${v.tone === "bad" ? "font-semibold text-coral" : v.tone === "warn" ? "font-semibold" : ""}`}>
                      {v.busy && <PollenSpinner className="size-4" />}
                      {v.text}
                    </span>
                    {v.detail && <span className="block text-xs">{v.detail}</span>}
                    {(c.retryable || c.resendable) && here(c.id) && confirming && confirmBox(confirming)}
                    {c.retryable && !here(c.id) && (
                      <button
                        type="button"
                        aria-label={`Retry ${c.channelName || c.service}${c.mode === "now" ? " (publishes live)" : ""}`}
                        onClick={() => ask([c.id])}
                        disabled={retrying}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-coral px-3 py-1.5 text-xs font-bold text-ink-deep hover:brightness-95 disabled:opacity-60"
                      >
                        Retry
                      </button>
                    )}
                    {(c.retryable || c.resendable) && c.retryUntil && !here(c.id) && (
                      <span className="mt-1 block text-xs text-ink/70">
                        {c.retryable ? "Retry" : "Send again"} until {when(c.retryUntil)}
                      </span>
                    )}
                    {c.resendable && !here(c.id) && (
                      <button
                        type="button"
                        aria-label={`Send again to ${c.channelName || c.service}, after checking Buffer`}
                        onClick={() => ask([c.id], true)}
                        disabled={retrying}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-xs font-bold ring-1 ring-ink/20 hover:ring-ink/40 disabled:opacity-60"
                      >
                        Send again&hellip;
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-6">
                    {c.postId ? (
                      <a
                        href={`https://publish.buffer.com/posts/${encodeURIComponent(c.postId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold underline underline-offset-4"
                      >
                        {c.mode === "now" ? "In Buffer" : "Open in Buffer"}
                      </a>
                    ) : c.status === "unknown" ? (
                      <a href="https://publish.buffer.com" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                        Open Buffer
                      </a>
                    ) : (
                      <span aria-label="No Buffer link" className="text-ink/40">
                        &ndash;
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3">
                    {c.liveUrl ? (
                      <a href={c.liveUrl} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                        Live post
                      </a>
                    ) : (
                      <span aria-label="Not live" className="text-ink/40">
                        &ndash;
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
