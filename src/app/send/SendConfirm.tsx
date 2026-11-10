"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import { ChannelIcon } from "@/components/ChannelIcon";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";
import { PollenSpinner } from "@/components/PollenSpinner";
import { ChannelPicker, useChannelSelection, type Channel } from "@/components/ChannelPicker";
import { fitIssues } from "@/lib/channelFit";
import { DemoGate } from "@/components/DemoGate";
import { FlowBar, primaryButton, primaryDisabled } from "@/components/FlowBar";
import { RunAutosave } from "@/components/RunAutosave";
import { SaveCreationButton } from "@/components/SaveCreationButton";
import {
  CAPTION_VARIANTS,
  variantLabel,
  buildCaption,
  captionLength,
  effectiveIntent,
  variantFor,
  variantLimit,
  type CaptionItem,
  type CaptionOrder,
  type CaptionVariant,
} from "@/lib/caption";
import { imageLimit, serviceKey, serviceLabel, unsupportedReason } from "@/lib/channels";
import { track } from "@/lib/events";
import { pollenBurst } from "@/lib/pollen-puff";
import type { LinkedinFormat } from "@/lib/linkedinFormat";
import { clearResume, clearSendBatches, loadFormat, loadSendBatches, saveSendBatches } from "@/lib/progress";
import type { HistoryEntry } from "@/lib/postHistory";
import type { PostIntent } from "@/lib/bufferPost";
import { SlideCarousel } from "./SlideCarousel";

/**
 * Sending does not happen in this page. "Send" queues one row per channel on the server (post_history), and the server's send queue creates the
 * posts, so closing this tab or leaving the page changes nothing. This page only watches: it asks how the batch is doing every few seconds and
 * shows what comes back. Each answer also moves the queue along a little, so an open tab makes a send quick.
 */
/** How often to ask while posts are waiting or being created, and (backing off) while Buffer publishes them. One request covers a whole send. */
const WATCH_MS = [2500, 3000, 4000, 5000, 6000];
const PUBLISH_BACKOFF_MS = [3000, 4000, 6000, 8000, 10_000, 12_000, 15_000];
/** After everything has been created, how long to keep asking Buffer whether each publish-now post is live. */
const PUBLISH_WINDOW_MS = 90_000;
/** Stop watching after this long. The server keeps sending; History shows the rest. */
const WATCH_LIMIT_MS = 20 * 60_000;
const isOpen = (e: HistoryEntry) => e.status === "queued" || e.status === "working";

const ghostButton = "rounded-xl px-4 py-2.5 font-bold ring-1 ring-ink/30 hover:bg-ink/10";

type RowView = {
  text: string;
  busy?: boolean;
  tone?: "bad" | "warn";
  detail?: string;
  note?: string;
  bufferId?: string;
  liveUrl?: string | null;
  /** No link to one post (it was never created, or may not have been): point to Buffer itself. */
  openBuffer?: boolean;
  /** Failed: nothing exists in Buffer, so the way forward is Retry in History. */
  openHistory?: boolean;
  /** The History entry this row is, so the link can open History at that row. */
  entryId?: number;
};

/** The last step's action is coral, to set it apart from the honey Continue buttons. */
/** Where drafts wait in Buffer, for review and scheduling. */

const finishButton =
  "rounded-xl bg-coral px-6 py-3 font-bold text-ink-deep hover:brightness-95";
/** On a phone the two actions share the bar with Back, so they are a little smaller. */
const compact = "max-sm:px-4 max-sm:py-2.5 max-sm:text-sm max-[360px]:px-3!";
const ACCENT: Record<CaptionVariant, string> = {
  instagram: "border-sage",
  link: "border-honey",
  short: "border-blush",
};
/** The folder tabs, in the same colours as the tabs on /pick and /write. */
const TAB_ACCENT = {
  channels: { solid: "bg-honey", light: "bg-honey/20 hover:bg-honey/40", border: "border-honey" },
  preview: { solid: "bg-sage", light: "bg-sage/20 hover:bg-sage/40", border: "border-sage" },
};
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

// What Write saved: caption order and hand edits. Which channels are ticked is chosen here, on Send.
type Choice = {
  order: CaptionOrder;
  edited: Partial<Record<CaptionVariant, string>>;
};

export function SendConfirm({
  urls,
  channels,
  picks,
  source,
  captionItems,
  newsletter,
  author,
  creditLink,
  heading,
  template,
  link,
  backHref,
  demo,
  linkedinFormat = "pdf",
}: {
  urls: string[];
  channels: Channel[];
  picks: number[];
  /** The content source the picks come from (the page's `mode`). The server loads the issue from it. */
  source?: string;
  captionItems: CaptionItem[];
  newsletter: string;
  author?: string | null;
  creditLink?: boolean;
  heading?: string;
  template: string;
  link: string;
  backHref: string;
  /** Public demo: the final action opens an account prompt and never creates drafts. */
  demo?: { signedIn: boolean };
  /** How LinkedIn gets the slides (Settings > LinkedIn format): only shown as a note here, the server decides when it sends. */
  linkedinFormat?: LinkedinFormat;
}) {
  // What was written on the Write step, read from this browser once mounted.
  const [choice, setChoice] = useState<Choice | "missing" | null>(null);
  const [error, setError] = useState("");
  // Each press of Send is a batch on the server. Retries add another; what a channel shows is its latest entry across them.
  const [batches, setBatches] = useState<string[]>([]);
  const [byBatch, setByBatch] = useState<Record<string, HistoryEntry[]>>({});
  const [starting, setStarting] = useState(false);
  // True once the server has answered for the current batches (so a restored send can say "Checking…" until then).
  const [checked, setChecked] = useState(false);
  // What the current run is doing. Retries repeat it, so a failed "Send now" never turns into drafts or the other way round.
  const [intent, setIntent] = useState<PostIntent | null>(null);
  // Channels waiting for "Publish now" in the modal: nothing has been sent for them yet.
  const [armed, setArmed] = useState<string[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pollStopped, setPollStopped] = useState(false);
  // True while the batches on screen were restored from an earlier visit (not started in this one). Only those are checked for "already finished".
  const [restored, setRestored] = useState(false);
  // How many posts of an earlier, finished send failed or are unknown. Shown as a nudge to History.
  const [earlierProblems, setEarlierProblems] = useState(0);
  const runningRef = useRef(false);
  const batchesRef = useRef<string[]>([]);
  const byBatchRef = useRef<Record<string, HistoryEntry[]>>({});
  // The folder on this page: where it goes, or one last look.
  const [view, setView] = useState<"channels" | "preview">("channels");
  const { selected, setSelected, ready: selectionReady } = useChannelSelection(channels, Boolean(demo));

  // Must match the key Write saves under.
  const sig = `${link}|${picks.join(",")}|${template}`;
  useEffect(() => {
    const t = setTimeout(() => {
      const f = loadFormat();
      setChoice(
        f && f.sig === sig
          ? { order: f.order as CaptionOrder, edited: f.edited as Choice["edited"] }
          : "missing",
      );
    }, 0);
    return () => clearTimeout(t);
  }, [sig]);

  // Coming back to this page (or reloading it) while a send is still running: pick it up again, so it isn't sent twice. If it turns out to have finished already, the
  // effect below drops it and opens a fresh form (History is the record; if something failed, a note points there).
  useEffect(() => {
    if (demo) return;
    const t = setTimeout(() => {
      const saved = loadSendBatches(sig);
      if (saved && saved.batchIds.length > 0) {
        batchesRef.current = saved.batchIds;
        setBatches(saved.batchIds);
        setIntent(saved.intent);
        setRestored(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [sig, demo]);

  useEffect(() => {
    if (!restored || !checked || starting) return;
    const rows = Object.values(byBatch).flat();
    if (rows.length === 0) return;
    const newest = new Map<string, HistoryEntry>();
    for (const e of rows) {
      const k = e.channelId ?? String(e.id);
      const cur = newest.get(k);
      if (!cur || e.id > cur.id) newest.set(k, e);
    }
    const entries = [...newest.values()];
    // Still going: keep showing it. (A publish-now post Buffer is still sending counts: sending it again could duplicate it.)
    if (entries.some((e) => isOpen(e) || (e.mode === "now" && e.status === "sending"))) return;
    const problems = entries.filter((e) => e.status === "failed" || e.status === "unknown").length;
    const t = setTimeout(() => {
      batchesRef.current = [];
      byBatchRef.current = {};
      setBatches([]);
      setByBatch({});
      setChecked(false);
      setIntent(null);
      setPollStopped(false);
      setRestored(false);
      setEarlierProblems(problems);
      clearSendBatches();
    }, 0);
    return () => clearTimeout(t);
  }, [restored, checked, starting, byBatch]);

  // What each channel shows: its latest entry (the newest batch wins).
  const latest = new Map<string, HistoryEntry>();
  for (const e of Object.values(byBatch).flat()) {
    if (!e.channelId) continue;
    const cur = latest.get(e.channelId);
    if (!cur || e.id > cur.id) latest.set(e.channelId, e);
  }
  const current = [...latest.values()];
  const busy = starting || current.some(isOpen);
  const allSent = !busy && current.length > 0 && current.every((e) => e.postId);
  // A fully successful send finishes the flow: forget the resume point, but not the caption, so coming back to /send still works.
  useEffect(() => {
    if (allSent) clearResume();
  }, [allSent]);

  // The posts modal: opens the moment either button is pressed, and can be closed without stopping anything.
  const runRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = runRef.current;
    if (!d) return;
    if (modalOpen && !d.open) d.showModal();
    if (!modalOpen && d.open) d.close();
  }, [modalOpen]);

  // Watch the batches: ask the server how each is doing until nothing is waiting, being created, or (for publish-now) still publishing.
  const batchKey = batches.join(",");
  useEffect(() => {
    if (!batchKey) return;
    const ids = batchKey.split(",");
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    let quietSince: number | null = null;
    let step = 0;
    const tick = async () => {
      // Skip a batch that is settled: nothing waiting and nothing still publishing.
      const live = ids.filter((id) => {
        const rows = byBatchRef.current[id];
        return !rows || rows.some((e) => isOpen(e) || (e.mode === "now" && e.status === "sending"));
      });
      for (const id of live) {
        try {
          const res = await fetch(`/api/history/refresh?batch=${encodeURIComponent(id)}`, { method: "POST", cache: "no-store" });
          if (cancelled) return;
          if (res.status === 401) {
            setError("Your Buffer session expired. Reload this page to reconnect. Anything already queued is still being sent.");
            return;
          }
          const j = (await res.json().catch(() => ({}))) as { history?: HistoryEntry[] };
          if (j.history) {
            byBatchRef.current = { ...byBatchRef.current, [id]: j.history };
            setByBatch(byBatchRef.current);
            setChecked(true);
          }
        } catch {
          /* try again on the next tick */
        }
      }
      if (cancelled) return;
      const rows = ids.flatMap((id) => byBatchRef.current[id] ?? []);
      const waiting = rows.some(isOpen) || live.length > 0 && rows.length === 0;
      const publishing = rows.some((e) => e.mode === "now" && e.status === "sending");
      if (Date.now() - started > WATCH_LIMIT_MS) return;
      if (waiting) {
        quietSince = null;
        timer = setTimeout(tick, WATCH_MS[Math.min(step++, WATCH_MS.length - 1)]);
      } else if (publishing) {
        quietSince ??= Date.now();
        if (Date.now() - quietSince > PUBLISH_WINDOW_MS) {
          setPollStopped(true);
          return;
        }
        timer = setTimeout(tick, PUBLISH_BACKOFF_MS[Math.min(step++, PUBLISH_BACKOFF_MS.length - 1)]);
      }
    };
    timer = setTimeout(() => {
      setPollStopped(false);
      void tick();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [batchKey]);

  if (choice === null || !selectionReady)
    return (
      <p className="mt-10 flex items-center gap-3 font-semibold">
        <PollenSpinner className="size-6" /> Loading…
      </p>
    );

  const header = (
    <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:gap-x-4">
        <h1 className="col-span-2 row-start-2 mb-3 min-w-0 text-3xl sm:col-span-1 sm:col-start-1 sm:row-start-1 sm:text-5xl">
          {demo ? (
            <>
              Here&rsquo;s your <StepWord>creation</StepWord>
            </>
          ) : (
            <>
              <StepWord>Send</StepWord> to Buffer
            </>
          )}
        </h1>
      {demo ? (
        <p className="col-span-2 row-start-3 mb-0 max-w-2xl text-lg sm:col-span-1 sm:col-start-1 sm:row-start-2">
          You&rsquo;ve made it to the end of the demo. In the live app, this is where you send your posts to socials
          via Buffer: as drafts to review and schedule, or published straight away.
        </p>
      ) : (
        <p className="col-span-2 row-start-3 mb-0 max-w-2xl text-lg sm:col-span-1 sm:col-start-1 sm:row-start-2">
          Choose where it goes and take one last look. Then create drafts to review and schedule in Buffer, or
          send now to publish straight away. Your slide images are saved when you send, so a draft can wait in Buffer, or a post be scheduled for
          later, without losing its images.
        </p>
      )}
      <div className="col-span-2 row-start-1 mb-2 flex items-center gap-3 justify-self-end sm:col-span-1 sm:col-start-2 sm:mb-0 sm:row-span-2 sm:mt-2 sm:self-start">
          <ShareLinkButton />
          {demo && (
            <a
              href="/feedback"
              onClick={() => track("feedback_clicked")}
              className="hidden shrink-0 items-center rounded-xl bg-honey px-4 py-2.5 font-bold text-ink-deep hover:brightness-95 sm:inline-flex"
            >
              Leave feedback
            </a>
          )}
        </div>
      {demo && (
        <a
          href="/feedback"
          onClick={() => track("feedback_clicked")}
          className="col-span-2 row-start-4 mt-4 inline-flex w-fit shrink-0 items-center rounded-xl bg-honey px-4 py-2.5 font-bold text-ink-deep hover:brightness-95 sm:hidden"
        >
          Leave feedback
        </a>
      )}
    </div>
  );

  if (choice === "missing")
    return (
      <>
        {header}
        <p className="rounded-2xl bg-surface p-6 font-semibold">
          Write your caption first.
        </p>
        <FlowBar back={{ href: backHref, label: "Write" }} />
      </>
    );

  const { order, edited } = choice;
  const byId = new Map(channels.map((c) => [c.id, c]));
  // The demo has no channel picker: all of its example channels are used.
  const chosen = demo ? channels : channels.filter((c) => selected.has(c.id));
  const n = chosen.length;
  // The caption Write showed: its room is the tightest limit among the account's usable channels (not only the ticked ones), so it reads the same here.
  const usable = channels.filter((c) => !unsupportedReason(c.service));
  const captionFor = (v: CaptionVariant) =>
    edited[v] ??
    buildCaption(captionItems, {
      newsletter,
      author,
      creditLink,
      heading,
      order,
      variant: v,
      link,
      limit: variantLimit(v, usable.map((c) => c.service)),
    });
  // "Send now" never publishes a caption that is over a network's limit: that channel is saved as a draft to shorten in Buffer. The server does the same.
  const draftsOf = (ids: string[]) => chosen.filter((c) => ids.includes(c.id) && effectiveIntent(c.service, captionFor(variantFor(c.service)), "now") === "draft");
  const armedDrafts = armed ? draftsOf(armed) : [];
  const armedNow = armed ? armed.length - armedDrafts.length : 0;
  const visible = CAPTION_VARIANTS.filter((v) =>
    chosen.some((c) => variantFor(c.service) === v.id),
  );

  const done = current.filter((e) => !isOpen(e));
  const okCount = done.filter((e) => e.postId).length;
  const entryFor = (id: string) => latest.get(id);
  const failed = done
    .filter((e) => e.status === "failed" || e.status === "unknown")
    .map((e) => byId.get(e.channelId ?? ""))
    .filter((c): c is Channel => Boolean(c));
  // A publish that died mid-request may have gone out, so it is never offered for retry: check Buffer first.
  const retryable = failed.filter((c) => entryFor(c.id)?.status === "failed");
  const unknownCount = failed.length - retryable.length;
  const mode: PostIntent = intent ?? "draft";
  const started = batches.length > 0 || starting;
  // Posts Buffer hasn't finished publishing. We keep asking for a while after the last one is created, then stop and point to Buffer.
  const stillPublishing = mode === "now" && !busy && current.some((e) => e.status === "sending");
  // Everything was created (and, for publish-now, nothing was refused): the only time the window asks for feedback. Otherwise History's button does the job.
  const cleanSuccess = allSent && !stillPublishing && !current.some((e) => e.status === "error" || e.status === "needs_approval");
  const fakeAny = current.some((e) => e.postId?.startsWith("fake-"));

  // When every failure has the same reason (e.g. images unreachable), say it once instead of on every row.
  const reasons = new Set(failed.map((c) => entryFor(c.id)?.error ?? ""));
  const sharedReason = failed.length > 1 && reasons.size === 1 ? [...reasons][0] || undefined : undefined;

  /** Queues the send on the server and starts watching. Nothing is created in this request: the server's send queue does it. */
  async function send(targets: Channel[], how: PostIntent) {
    if (demo || runningRef.current) return; // the demo never sends; and one press at a time, so a double click can't queue twice
    runningRef.current = true;
    setIntent(how);
    setArmed(null);
    setModalOpen(true);
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          channels: targets.map((c) => ({ id: c.id, service: c.service, name: c.name })),
          picks,
          captions: Object.fromEntries(targets.map((c) => [c.id, captionFor(variantFor(c.service))])),
          template,
          intent: how,
          // Only the "Publish now" click inside the modal gets here with how === "now".
          confirmed: how === "now",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; batchId?: string };
      if (res.status === 401) setError("Your Buffer session expired. Reload this page to reconnect, then send again. Nothing was sent.");
      else if (!res.ok || !j.batchId) setError(j.error ?? `Couldn't start the send (HTTP ${res.status}). Nothing was sent.`);
      else {
        const next = [...batchesRef.current, j.batchId];
        batchesRef.current = next;
        setBatches(next);
        saveSendBatches(sig, { batchIds: next, intent: how });
      }
    } catch {
      setError("Couldn't reach Pollen Picks. Nothing was sent. Check your connection and try again.");
    }
    setStarting(false);
    runningRef.current = false;
  }

  /** "Send now" never sends by itself: it opens the modal and waits for "Publish now" there. */
  function arm(list: Channel[]) {
    if (runningRef.current) return;
    setArmed(list.map((c) => c.id));
    setIntent("now");
    setModalOpen(true);
  }

  /** Forget the finished send, so the channels can be chosen again. */
  function startNewSend() {
    batchesRef.current = [];
    byBatchRef.current = {};
    setBatches([]);
    setByBatch({});
    setChecked(false);
    setIntent(null);
    setPollStopped(false);
    setRestored(false);
    setEarlierProblems(0);
    setError("");
    clearSendBatches();
  }

  // Labels follow what was really created: a "Send now" where every caption was too long only made drafts.
  const draftRows = current.filter((e) => e.mode !== "now").length;
  const labelMode: PostIntent = current.length > 0 && draftRows === current.length ? "draft" : mode;
  const status = busy
    ? labelMode === "now"
      ? `Sending… ${done.length} of ${Math.max(current.length, chosen.length)}`
      : `Creating drafts… ${done.length} of ${Math.max(current.length, chosen.length)}`
    : started
      ? labelMode === "now"
        ? `${okCount} of ${current.length} sent to Buffer${draftRows > 0 && labelMode === "now" ? ` (${plural(draftRows, "draft")} to finish there)` : ""}`
        : `${okCount} of ${current.length} ${current.length === 1 ? "draft" : "drafts"} created`
      : demo
        ? ""
        : n === 0
          ? "Select at least one channel"
          : plural(n, "channel");

  const ready = armed !== null && !busy;
  const modalTitle = ready
    ? armedNow > 0
      ? `Publish ${plural(armedNow, "post")} now?`
      : `Save ${plural(armedDrafts.length, "draft")} instead?`
    : busy
      ? labelMode === "now"
        ? "Sending…"
        : "Creating drafts…"
      : unknownCount > 0 && retryable.length === 0
        ? "Check these posts in Buffer"
        : failed.length > 0
          ? labelMode === "now"
            ? "Some posts need another try"
            : "Some drafts need another try"
          : labelMode === "now"
            ? draftRows > 0
              ? `Sent, with ${plural(draftRows, "draft")} to finish`
              : "Posts sent to Buffer"
            : "Your drafts are ready";
  // Once the send is confirmed the modal stops reporting progress (History does that); it just says it\u2019s done and points there.
  const doneTitle = error && batches.length === 0 ? "Nothing was sent" : starting ? "Sending\u2026" : "It\u2019s sent!";
  const names = (list: Channel[]) => list.map((c) => c.name).join(", ");
  const draftChannels = current.filter((e) => e.mode !== "now").map((e) => byId.get(e.channelId ?? "")).filter((c): c is Channel => Boolean(c));
  const tooLongNote = (list: Channel[], past: boolean) => {
    const one = list.length === 1;
    return `${names(list)} ${one ? "has a caption" : "have captions"} over the network's limit, so ${one ? "it" : "they"} ${past ? (one ? "was" : "were") : "will be"} saved as ${one ? "a draft" : "drafts"} for you to shorten in Buffer.`;
  };
  const modalIntro = ready
    ? armedNow > 0
      ? `This publishes straight away to the channels below, and can't be undone from here.${armedDrafts.length > 0 ? ` ${tooLongNote(armedDrafts, false)}` : ""}`
      : `Nothing is published. ${tooLongNote(armedDrafts, false)}`
    : labelMode === "now"
      ? `Buffer publishes each post to its network. Live links appear here once they are out.${draftChannels.length > 0 ? ` ${tooLongNote(draftChannels, true)}` : ""}`
      : "Nothing is published. Open each draft in Buffer to review, edit and schedule it.";

  const rowView = (c: Channel): RowView => {
    if (armed?.includes(c.id) && !busy) return armedDrafts.some((d) => d.id === c.id) ? { text: "Will be saved as a draft", detail: "Over its network's limit." } : { text: "Ready to publish" };
    const e = entryFor(c.id);
    if (!e) return started && (starting || !checked) ? { text: "Waiting…", busy: true } : { text: "Not sent" };
    if (e.status === "queued") return { text: "Waiting…", busy: true, detail: "Waiting for its turn." };
    if (e.status === "working") return { text: "Sending…", busy: true };
    if (e.status === "failed") return { text: "Failed", tone: "bad", detail: e.error ?? undefined, openHistory: true, entryId: e.id };
    if (e.status === "unknown") return { text: "Unknown, check Buffer", tone: "warn", detail: e.error ?? undefined, openBuffer: true };
    const fake = Boolean(e.postId?.startsWith("fake-"));
    const note = e.slides && e.slides < urls.length ? `Only the first ${e.slides} of ${urls.length} slides fit on ${c.service}.` : undefined;
    const base = { note, bufferId: fake ? undefined : (e.postId ?? undefined) };
    if (e.mode !== "now")
      return { ...base, text: fake ? "Fake draft (not sent)" : "Draft created", detail: [mode === "now" ? "Saved as a draft instead of being published." : null, e.error].filter(Boolean).join(" ") || undefined };
    if (e.status === "sent") return { ...base, text: e.liveUrl ? "Live" : "Published", liveUrl: e.liveUrl };
    if (e.status === "error")
      return { ...base, text: "Buffer couldn't publish this", tone: "bad", detail: "Open it in Buffer to see why and try again there.", openBuffer: true };
    if (e.status === "needs_approval") return { ...base, text: "Needs approval in Buffer", tone: "warn" };
    return pollStopped
      ? { ...base, text: "Still publishing at Buffer", tone: "warn", detail: "This is taking longer than usual. Open it in Buffer for the latest status." }
      : { ...base, text: "Sent to Buffer", detail: "Publishing…", busy: true };
  };

  return (
    <>
      {header}
      {earlierProblems > 0 && !busy && (
        <p role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-3 text-sm font-semibold ring-2 ring-honey">
          <span>
            {earlierProblems === 1 ? "1 post from your last send didn\u2019t go through." : `${earlierProblems} posts from your last send didn\u2019t go through.`} Check{" "}
            <a href="/history" className="font-bold underline underline-offset-4">
              History
            </a>{" "}
            to retry {earlierProblems === 1 ? "it" : "them"}.
          </span>
          <button type="button" onClick={() => setEarlierProblems(0)} className="font-bold underline underline-offset-4">
            Dismiss
          </button>
        </p>
      )}
      {(sharedReason || error) && (
        <div className="mb-4 grid gap-3">
          {sharedReason && (
            <p role="alert" className="m-0 rounded-xl bg-surface p-3 font-semibold ring-2 ring-coral">
              {sharedReason}
            </p>
          )}
          {error && (
            <p role="alert" className="m-0 rounded-xl bg-surface p-3 font-semibold ring-2 ring-coral">
              {error}
            </p>
          )}
        </div>
      )}

      {!demo && (
        <>
      <div role="tablist" aria-label="Send" className="flex items-end gap-1.5 px-3 sm:pl-6 sm:pr-0">
        {(["channels", "preview"] as const).map((id) => {
          const on = view === id;
          return (
            <button
              key={id}
              role="tab"
              type="button"
              id={`send-tab-${id}`}
              aria-selected={on}
              aria-controls={`send-panel-${id}`}
              onClick={() => setView(id)}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-t-2xl px-3 text-sm font-bold transition sm:flex-none sm:px-6 sm:text-lg ${on ? `${TAB_ACCENT[id].solid} relative z-10 -mb-[3px] py-3.5 text-ink-deep` : `${TAB_ACCENT[id].light} py-2.5`}`}
            >
              {id === "channels" ? `Channels (${n})` : "Preview"}
            </button>
          );
        })}
      </div>
      {/* Both panels stay mounted (the inactive one is hidden), so the slide previews, which are slow to draw, don't reload. */}
      <div
        role="tabpanel"
        id="send-panel-channels"
        aria-labelledby="send-tab-channels"
        hidden={view !== "channels"}
        className={`mb-4 rounded-2xl border-[3px] p-4 sm:p-5 ${TAB_ACCENT.channels.border}`}
      >
        {started && (
          <p className="mb-4 mt-0 text-sm font-semibold">Channels are locked once sending has started.</p>
        )}
        {/* A disabled fieldset disables every checkbox and button inside it. */}
        <fieldset disabled={started} className="m-0 min-w-0 border-0 p-0">
          <ChannelPicker
            channels={channels}
            selected={selected}
            setSelected={setSelected}
            demo={Boolean(demo)}
            fit={(service) => fitIssues(service, { slideCount: urls.length, caption: captionFor(variantFor(service)) })}
          />
          {!demo && chosen.some((c) => serviceKey(c.service) === "linkedin") && (
            <p className="mb-0 mt-4 rounded-2xl bg-surface p-4 text-sm ring-1 ring-ink/15">
              {linkedinFormat === "pdf" ? (
                <>
                  <span className="font-bold">LinkedIn gets a PDF carousel.</span> All {plural(urls.length, "slide")} in one swipeable document. If LinkedIn doesn&rsquo;t take it, the slides go as images instead.
                </>
              ) : (
                <>
                  <span className="font-bold">LinkedIn gets separate images.</span> LinkedIn shows several images as a grid with the edges cropped.
                </>
              )}{" "}
              <a href="/settings?section=linkedin" target="_blank" rel="noopener" className="font-bold underline underline-offset-4">
                Change in Settings
              </a>
            </p>
          )}
        </fieldset>
      </div>
        </>
      )}
      <div
        role={demo ? undefined : "tabpanel"}
        id="send-panel-preview"
        aria-labelledby={demo ? undefined : "send-tab-preview"}
        hidden={!demo && view !== "preview"}
        className={demo ? "mb-4" : `mb-4 rounded-2xl border-[3px] p-4 sm:p-5 ${TAB_ACCENT.preview.border}`}
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start">
          <SlideCarousel urls={urls} />
          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
            {visible.length === 0 && (
              <p className="m-0 rounded-2xl border-[3px] border-ink/15 p-4 text-sm">
                Select a channel to see its caption.
              </p>
            )}
            {visible.map((v) => (
              <div key={v.id} className={`grid grid-cols-[minmax(0,1fr)] gap-2 rounded-2xl border-[3px] p-4 ${ACCENT[v.id]}`}>
                <p className="m-0 flex items-center gap-2 text-sm font-semibold">
                  {v.id === "instagram" && <ChannelIcon service="instagram" className="size-4 shrink-0" />}
                  {variantLabel(v.id, visible.map((x) => x.id))} · {plural(chosen.filter((c) => variantFor(c.service) === v.id).length, "channel")}
                </p>
                <div className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded-xl bg-surface px-3 py-2 ring-1 ring-ink/15">
                  {captionFor(v.id)}
                </div>
                {(() => {
                  const text = captionFor(v.id);
                  const limit = variantLimit(v.id, chosen.map((c) => c.service));
                  const length = captionLength(text, v.id);
                  const over = length > limit;
                  return (
                    <p className={`m-0 text-xs ${over ? "font-semibold text-coral" : ""}`}>
                      {length.toLocaleString("en")} / {limit.toLocaleString("en")} characters{over ? ": too long. Send now saves a draft instead." : ""}
                    </p>
                  );
                })()}
              </div>
            ))}
          </section>
        </div>
      </div>

      <dialog
        ref={runRef}
        onClose={() => {
          setModalOpen(false);
          setArmed(null);
        }}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        aria-label={mode === "now" ? "Your posts" : "Your drafts"}
        className="m-auto max-h-[85vh] w-[min(38rem,94vw)] overflow-hidden rounded-2xl bg-page p-0 text-ink backdrop:bg-ink/60"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-4 px-7 pb-2 pt-6">
            <h2 className="m-0 text-2xl">{ready ? modalTitle : doneTitle}</h2>
            <button
              type="button"
              onClick={() => runRef.current?.close()}
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full hover:bg-ink/10"
            >
              <X aria-hidden className="size-5" strokeWidth={2.25} />
            </button>
          </div>
          {ready ? (
            <>
          <p className="m-0 px-7 pb-4 text-sm">{modalIntro}</p>
          {fakeAny && !(started && !ready && (busy || stillPublishing)) && (
            <p role="status" className="mx-7 mb-4 rounded-xl bg-surface p-3 text-sm font-semibold ring-2 ring-honey">
              Fake mode: nothing was sent to Buffer.
            </p>
          )}
          {started && !ready && (busy || stillPublishing) && (
            <p role="status" className={`mx-7 mb-4 rounded-xl bg-surface p-3 text-sm ${pollStopped || current.some((e) => e.heldUp) ? "font-semibold ring-2 ring-honey" : ""}`}>
              {pollStopped ? (
                <>
                  Buffer is taking longer than usual to publish. Your posts were sent to Buffer, so they&rsquo;re not lost: check their status in{" "}
                  <a href="https://publish.buffer.com" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                    Buffer
                  </a>
                  . They&rsquo;re also listed in{" "}
                  <a href="/history" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                    History
                  </a>
                  .
                </>
              ) : current.some((e) => e.heldUp) ? (
                <>
                  <span className="font-bold">Buffer is asking us to slow down a little.</span> Your posts are safe and will go out as it catches up.{" "}
                  <a href="/history" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                    Go to History
                  </a>{" "}
                  to check on them. You can close this window &mdash; they&rsquo;ll keep sending when you open History.
                </>
              ) : (
                <>
                  <span className="font-bold">This can take a while.</span> Everything is saved in{" "}
                  <a href="/history" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                    History
                  </a>
                  , so you can close this window or leave the page. Your posts keep sending!
                </>
              )}
            </p>
          )}
          <div className="min-h-0 overflow-y-auto px-7 pb-2">
            <table className="w-full border-collapse text-left text-sm max-sm:block">
              <caption className="sr-only">{mode === "now" ? "Posts by channel" : "Drafts by channel"}</caption>
              <thead className="max-sm:sr-only">
                <tr className="border-b border-ink/15">
                  <th scope="col" className="py-2 pr-3 font-bold">
                    Channel
                  </th>
                  <th scope="col" className="py-2 pr-3 font-bold">
                    Status
                  </th>
                  <th scope="col" className="py-2 text-right font-bold">
                    Links
                  </th>
                </tr>
              </thead>
              <tbody className="max-sm:block">
                {chosen.map((c) => {
                  const v = rowView(c);
                  return (
                    // On a phone each row stacks (channel, then its status, then its links) instead of three columns that don't fit.
                    <tr key={c.id} className="border-b border-ink/10 align-top max-sm:block max-sm:py-3">
                      <td className="py-2.5 pr-3 max-sm:block max-sm:py-0 max-sm:pr-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <ChannelIcon service={c.service} className="size-4 shrink-0 text-ink/60" />
                          <span title={c.name} className="min-w-0 truncate font-semibold">
                            {c.name}
                          </span>
                        </span>
                        <span className="block pl-6 text-xs text-ink/70">
                          {plural(Math.min(urls.length, imageLimit(c.service)), "slide")}
                        </span>
                        <span className="block max-w-[16rem] truncate pl-6 text-xs text-ink/70 max-sm:max-w-full" title={captionFor(variantFor(c.service))}>
                          {captionFor(variantFor(c.service))}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 max-sm:mt-1.5 max-sm:block max-sm:py-0 max-sm:pl-6 max-sm:pr-0">
                        <span
                          className={`flex items-center gap-2 ${v.tone === "bad" ? "font-semibold text-coral" : v.tone === "warn" ? "font-semibold" : ""}`}
                        >
                          {v.busy && <PollenSpinner className="size-4" />}
                          {v.text}
                        </span>
                        {v.detail && <span className="block text-xs">{v.detail}</span>}
                        {v.note && <span className="block text-xs">{v.note}</span>}
                      </td>
                      <td className="py-2.5 text-right max-sm:block max-sm:py-0 max-sm:pl-6 max-sm:text-left">
                        <span className="flex flex-col items-end gap-1 max-sm:mt-1 max-sm:items-start">
                          {v.bufferId && !(mode === "now" && v.busy) && (
                            <a
                              href={`https://publish.buffer.com/posts/${encodeURIComponent(v.bufferId)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="whitespace-nowrap font-bold underline underline-offset-4"
                            >
                              {mode === "now" ? "In Buffer" : "Open in Buffer"}
                            </a>
                          )}
                          {v.openHistory && (
                            <a href={v.entryId ? `/history#entry-${v.entryId}` : "/history"} target="_blank" rel="noreferrer" className="whitespace-nowrap font-bold underline underline-offset-4">
                              Go to History
                            </a>
                          )}
                          {!v.bufferId && v.openBuffer && (
                            <a href="https://publish.buffer.com" target="_blank" rel="noreferrer" className="whitespace-nowrap font-bold underline underline-offset-4">
                              Open Buffer
                            </a>
                          )}
                          {v.liveUrl && (
                            <a
                              href={v.liveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="whitespace-nowrap font-bold underline underline-offset-4"
                            >
                              Live post
                            </a>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink/10 px-7 py-4">
            {ready ? (
              <>
                <button type="button" onClick={() => runRef.current?.close()} className={ghostButton}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    pollenBurst(e.currentTarget);
                    send(
                      chosen.filter((c) => armed!.includes(c.id)),
                      "now",
                    );
                  }}
                  className={finishButton}
                >
                  {armedNow > 0 ? "Publish now" : "Save drafts"}
                </button>
              </>
            ) : null}
          </div>
            </>
          ) : (
            <div className="flex flex-col gap-4 px-7 pb-7 pt-1">
              {fakeAny && (
                <p role="status" className="m-0 rounded-xl bg-surface p-3 text-sm font-semibold ring-2 ring-honey">
                  Fake mode: nothing was sent to Buffer.
                </p>
              )}
              {error && batches.length === 0 ? (
                <p role="alert" className="m-0 border-l-4 border-coral pl-3 font-semibold">
                  {error}
                </p>
              ) : starting ? (
                <p role="status" className="m-0 flex items-center gap-3 font-semibold">
                  <PollenSpinner className="size-5" /> Queuing your {labelMode === "now" ? "posts" : "drafts"}…
                </p>
              ) : (
                <>
                  <p className="m-0 text-lg">
                    Now, check on the status of your {labelMode === "now" ? "posts" : "drafts"} &mdash; including any failed {labelMode === "now" ? "posts" : "drafts"} that need retries.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <a href="/history" target="_blank" rel="noreferrer" className="rounded-xl bg-honey px-6 py-3 text-center font-bold text-ink-deep hover:brightness-95">
                      Go to History
                    </a>
                    {/* History, not Buffer: a post still going out (or a draft just created) isn't in Buffer's lists yet, so a link there opens a page without it. History follows it live. */}
                  </div>
                  {/* Publish-now asks straight away (the window is the last thing they see); drafts ask once everything was created. */}
                  {(cleanSuccess || labelMode === "now") && <FeedbackPrompt className="mt-1" />}
                </>
              )}
            </div>
          )}
        </div>
      </dialog>

      {/* Not once a send has begun: the run is deleted when the send is queued, and must not come back with its caption. */}
      {!demo && source && <RunAutosave source={source} picks={picks} template={template} step={5} enabled={!started} />}
      <FlowBar
        back={{ href: backHref, label: "Write" }}
        status={
          started && !busy ? (
            <>
              {status} ·{" "}
              <button type="button" onClick={() => setModalOpen(true)} className="font-bold underline underline-offset-4">
                {mode === "now" ? "View posts" : "View drafts"}
              </button>
              {" · "}
              <button type="button" onClick={startNewSend} className="font-bold underline underline-offset-4">
                Start a new send
              </button>
            </>
          ) : (
            status
          )
        }
        statusHiddenOnPhone={!started}
      >
        {!demo && source && <SaveCreationButton source={source} picks={picks} template={template} step={5} />}
        {demo ? (
          <DemoGate
            signedIn={demo.signedIn}
            label="Finish demo"
            className={finishButton}
            onOpen={pollenBurst}
            download={{
              urls,
              // One caption per kind of network, named for the demo channels that use it (Instagram, LinkedIn, X), with any edits made on Write.
              captions: visible.map((v) => ({
                label: [...new Set(chosen.filter((c) => variantFor(c.service) === v.id).map((c) => serviceLabel(c.service)))].join(" and "),
                text: captionFor(v.id),
              })),
            }}
          />
        ) : n === 0 && !started ? (
          <>
            <span aria-disabled className={`${primaryDisabled} ${compact}`}>
              Create draft
            </span>
            <span aria-disabled className={`${primaryDisabled} ${compact}`}>
              Send now
            </span>
          </>
        ) : busy ? (
          <span aria-disabled className={primaryDisabled}>
            Sending…
          </span>
        ) : allSent ? (
          // History, not Buffer: a post still going out (or a draft just created) isn't in Buffer's lists yet, so a link there opens a page without it.
          <a href="/history" target="_blank" rel="noreferrer" className={finishButton}>
            Go to History
          </a>
        ) : started && failed.length > 0 ? (
          retryable.length > 0 ? (
            <button
              type="button"
              onClick={() => (mode === "now" ? arm(retryable) : send(retryable, "draft"))}
              className={finishButton}
            >
              Retry {retryable.length} failed
            </button>
          ) : (
            <a href="https://publish.buffer.com" target="_blank" rel="noreferrer" className={finishButton}>
              Open Buffer
            </a>
          )
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                pollenBurst(e.currentTarget);
                send(chosen, "draft");
              }}
              className={`${primaryButton} ${compact}`}
            >
              Create draft
            </button>
            <button type="button" onClick={() => arm(chosen)} className={`${finishButton} ${compact}`}>
              Send now
            </button>
          </>
        )}
      </FlowBar>
    </>
  );
}
