"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import { ChannelIcon } from "@/components/ChannelIcon";
import { ChannelPicker, useChannelSelection, type Channel } from "@/components/ChannelPicker";
import { DemoGate } from "@/components/DemoGate";
import { FlowBar, primaryButton, primaryDisabled } from "@/components/FlowBar";
import {
  CAPTION_VARIANTS,
  buildCaption,
  variantFor,
  type CaptionItem,
  type CaptionOrder,
  type CaptionVariant,
} from "@/lib/caption";
import { imageLimit } from "@/lib/channels";
import { track } from "@/lib/events";
import { pollenBurst } from "@/lib/pollen-puff";
import { clearProgress, loadFormat } from "@/lib/progress";
import type { DraftResult } from "@/app/api/draft/route";
import type { PostStatusResult } from "@/app/api/post-status/route";
import type { PostIntent } from "@/lib/bufferPost";
import { SlideCarousel } from "./SlideCarousel";

type Progress = "queued" | "sending" | DraftResult;

/** Drafts are created one channel per request, this many at a time: no single long request, and live progress. */
const CONCURRENCY = 3;

/** After "Send now", how often to ask Buffer whether each post is live, and how long to keep asking. */
// Buffer limits requests per app (shared by everyone using it), so ask less and less often. One request covers every waiting post.
const POLL_BACKOFF_MS = [3000, 4000, 6000, 8000, 10_000, 12_000, 15_000];
const POLL_WINDOW_MS = 90_000;
/** Buffer's post statuses that won't change again. */
const FINAL_STATUS = new Set(["sent", "error", "needs_approval"]);

const ghostButton = "rounded-xl px-4 py-2.5 font-bold ring-1 ring-ink/30 hover:bg-ink/10";
const spinner = "inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-ink/25 border-t-ink";

type RowView = {
  text: string;
  busy?: boolean;
  tone?: "bad" | "warn";
  detail?: string;
  note?: string;
  bufferId?: string;
  liveUrl?: string | null;
};

/** The last step's action is coral, to set it apart from the honey Continue buttons. */
const finishButton =
  "rounded-xl bg-coral px-6 py-3 font-bold text-ink-deep hover:brightness-95";
const ACCENT: Record<CaptionVariant, string> = {
  instagram: "border-honey",
  link: "border-sage",
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
}) {
  // What was written on the Write step, read from this browser once mounted.
  const [choice, setChoice] = useState<Choice | "missing" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  // What the current run is doing. Retries repeat it, so a failed "Send now" never turns into drafts or the other way round.
  const [intent, setIntent] = useState<PostIntent | null>(null);
  // Channels waiting for "Publish now" in the modal: nothing has been sent for them yet.
  const [armed, setArmed] = useState<string[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Where each sent post stands in Buffer (by post id), polled while the modal is open.
  const [live, setLive] = useState<Record<string, PostStatusResult>>({});
  const [pollStopped, setPollStopped] = useState(false);
  const [pollGen, setPollGen] = useState(0);
  const runningRef = useRef(false);
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);
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

  const results = Object.values(progress);
  const allSent =
    !busy &&
    results.length > 0 &&
    results.every((v) => typeof v === "object" && v.ok);
  // A fully successful send finishes the flow: forget the saved progress.
  useEffect(() => {
    if (allSent) clearProgress();
  }, [allSent]);

  // The posts modal: opens the moment either button is pressed, and can be closed without stopping anything.
  const runRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = runRef.current;
    if (!d) return;
    if (modalOpen && !d.open) d.showModal();
    if (!modalOpen && d.open) d.close();
  }, [modalOpen]);

  // After a "Send now", ask Buffer where each post stands until it is live (or failed), for a while.
  const nowIds =
    intent === "now"
      ? Object.values(progress).flatMap((v) => (typeof v === "object" && v.ok && v.postId ? [v.postId] : []))
      : [];
  const nowKey = nowIds.join(",");
  useEffect(() => {
    if (!modalOpen || !nowKey) return;
    const ids = nowKey.split(",");
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    let step = 0;
    const tick = async () => {
      const waiting = ids.filter((id) => {
        const l = liveRef.current[id];
        return !l || "error" in l || !FINAL_STATUS.has(l.status);
      });
      if (waiting.length === 0 || cancelled) return;
      try {
        const res = await fetch(`/api/post-status?ids=${encodeURIComponent(waiting.join(","))}`, { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as { results?: PostStatusResult[] };
        if (!cancelled && j.results) setLive((m) => ({ ...m, ...Object.fromEntries(j.results!.map((r) => [r.id, r])) }));
      } catch {
        /* try again on the next tick */
      }
      if (cancelled) return;
      if (Date.now() - started > POLL_WINDOW_MS) {
        setPollStopped(true);
        return;
      }
      timer = setTimeout(tick, POLL_BACKOFF_MS[Math.min(step++, POLL_BACKOFF_MS.length - 1)]);
    };
    timer = setTimeout(() => {
      setPollStopped(false);
      void tick();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [modalOpen, nowKey, pollGen]);

  if (choice === null || !selectionReady) return <p className="mt-10 font-semibold">Loading…</p>;

  const header = (
    <div className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h1 className="mb-3 text-4xl sm:text-5xl">
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
        <div className="flex flex-wrap items-center gap-3 sm:mt-2">
          <ShareLinkButton />
          {demo && (
            <a
              href="/feedback"
              onClick={() => track("feedback_clicked")}
              className="inline-flex shrink-0 items-center rounded-xl bg-honey px-4 py-2.5 font-bold text-ink-deep hover:brightness-95"
            >
              Leave feedback
            </a>
          )}
        </div>
      </div>
      {demo ? (
        <p className="mb-0 max-w-2xl text-lg">
          You&rsquo;ve made it to the end of the demo. In the live app, this is where you send your posts to socials
          via Buffer: as drafts to review and schedule, or published straight away.
        </p>
      ) : (
        <p className="mb-0 max-w-2xl text-lg">
          Choose where it goes and take one last look. Then create drafts to review and schedule in Buffer, or
          send now to publish straight away.
        </p>
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
    });
  const visible = CAPTION_VARIANTS.filter((v) =>
    chosen.some((c) => variantFor(c.service) === v.id),
  );

  const entries = Object.entries(progress);
  const done = entries.filter(([, v]) => typeof v === "object");
  const okCount = done.filter(([, v]) => (v as DraftResult).ok).length;
  const failed = done
    .filter(([, v]) => !(v as DraftResult).ok)
    .map(([id]) => byId.get(id)!)
    .filter(Boolean);

  const resultOf = (id: string) => {
    const v = progress[id];
    return typeof v === "object" ? v : null;
  };
  // A publish that died mid-request may have gone out, so it is never offered for retry: check Buffer first.
  const retryable = failed.filter((c) => !resultOf(c.id)?.unknown);
  const unknownCount = failed.length - retryable.length;
  const mode: PostIntent = intent ?? "draft";

  // When every failure has the same reason (e.g. images unreachable), say it once instead of on every row.
  const reasons = new Set(
    done
      .filter(([, v]) => !(v as DraftResult).ok)
      .map(([, v]) => (v as DraftResult).error),
  );
  const sharedReason =
    failed.length > 1 && reasons.size === 1 ? [...reasons][0] : undefined;

  async function send(targets: Channel[], how: PostIntent) {
    if (demo || runningRef.current) return; // the demo never sends; and one run at a time, so a double click can't post twice
    runningRef.current = true;
    setIntent(how);
    setArmed(null);
    setModalOpen(true);
    setBusy(true);
    setError("");
    setProgress((p) => ({
      ...p,
      ...Object.fromEntries(targets.map((c) => [c.id, "queued" as Progress])),
    }));
    const queue = [...targets];
    let expired = false;
    const set = (id: string, v: Progress) =>
      setProgress((p) => ({ ...p, [id]: v }));

    const worker = async () => {
      while (queue.length && !expired) {
        const c = queue.shift()!;
        set(c.id, "sending");
        try {
          const res = await fetch("/api/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source,
              channels: [{ id: c.id, service: c.service }],
              picks,
              captions: { [c.id]: captionFor(variantFor(c.service)) },
              template,
              intent: how,
              // Only the "Publish now" click inside the modal gets here with how === "now".
              confirmed: how === "now",
            }),
          });
          if (res.status === 401) {
            expired = true;
            set(c.id, {
              channelId: c.id,
              ok: false,
              error: "Not sent: your Buffer session expired.",
            });
            continue;
          }
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
            results?: DraftResult[];
          };
          set(
            c.id,
            j.results?.[0] ?? {
              channelId: c.id,
              ok: false,
              error: j.error ?? `HTTP ${res.status}`,
            },
          );
        } catch (e) {
          set(c.id, {
            channelId: c.id,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker),
    );

    if (expired) {
      for (const c of queue)
        set(c.id, {
          channelId: c.id,
          ok: false,
          error: "Not sent: your Buffer session expired.",
        });
      setError(
        "Your Buffer session expired. Reload this page to reconnect, then retry the failed channels.",
      );
    }
    setBusy(false);
    runningRef.current = false;
  }

  /** "Send now" never sends by itself: it opens the modal and waits for "Publish now" there. */
  function arm(list: Channel[]) {
    if (runningRef.current) return;
    setArmed(list.map((c) => c.id));
    setIntent("now");
    setModalOpen(true);
  }

  const started = entries.length > 0;
  // With a single draft, the finish button can open that draft directly.
  const only = entries.length === 1 ? entries[0][1] : null;
  const onlyPost =
    only && typeof only === "object" && only.ok ? only.postId : undefined;
  const onlyFake = Boolean(only && typeof only === "object" && only.fake);
  const status = busy
    ? mode === "now"
      ? `Sending… ${done.length} of ${entries.length}`
      : `Creating drafts… ${done.length} of ${entries.length}`
    : started
      ? mode === "now"
        ? `${okCount} of ${entries.length} sent to Buffer`
        : `${okCount} of ${entries.length} ${entries.length === 1 ? "draft" : "drafts"} created`
      : demo
        ? ""
        : n === 0
          ? "Select at least one channel"
          : plural(n, "channel");

  const ready = armed !== null && !busy;
  const modalTitle = ready
    ? `Publish ${plural(armed!.length, "post")} now?`
    : busy
      ? mode === "now"
        ? "Sending…"
        : "Creating drafts…"
      : unknownCount > 0 && retryable.length === 0
        ? "Check these posts in Buffer"
        : failed.length > 0
          ? mode === "now"
            ? "Some posts need another try"
            : "Some drafts need another try"
          : mode === "now"
            ? "Posts sent to Buffer"
            : "Your drafts are ready";
  const modalIntro = ready
    ? "This publishes straight away to the channels below, and can't be undone from here."
    : mode === "now"
      ? "Buffer publishes each post to its network. Live links appear here once they are out."
      : "Nothing is published. Open each draft in Buffer to review, edit and schedule it.";
  const rowView = (c: Channel): RowView => {
    if (armed?.includes(c.id) && !busy) return { text: "Ready to publish" };
    const v = progress[c.id];
    const r = typeof v === "object" ? v : null;
    if (!r) {
      if (v === "sending") return { text: "Sending…", busy: true };
      if (v === "queued") return { text: "Waiting…", busy: true };
      return { text: "Not sent" };
    }
    if (!r.ok) {
      return r.unknown
        ? { text: "Unknown, check Buffer", tone: "warn", detail: r.error }
        : { text: "Failed", tone: "bad", detail: r.error };
    }
    const base = { note: r.note, bufferId: r.fake ? undefined : r.postId };
    if (mode !== "now") return { ...base, text: r.fake ? "Fake draft (not sent)" : "Draft created" };
    const l = r.postId ? live[r.postId] : undefined;
    if (l && !("error" in l)) {
      if (l.status === "sent") return { ...base, text: l.externalLink ? "Live" : "Published", liveUrl: l.externalLink };
      if (l.status === "error")
        return { ...base, text: "Buffer couldn't publish this", tone: "bad", detail: "Open it in Buffer to see why and try again there." };
      if (l.status === "needs_approval") return { ...base, text: "Needs approval in Buffer", tone: "warn" };
    }
    return {
      ...base,
      text: "Sent to Buffer",
      detail: pollStopped ? "Still publishing. Refresh to check again." : "Publishing…",
      busy: !pollStopped,
    };
  };

  return (
    <>
      {header}
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
          <ChannelPicker channels={channels} selected={selected} setSelected={setSelected} demo={Boolean(demo)} />
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
        <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start">
          <SlideCarousel urls={urls} />
          <section className="grid min-w-0 gap-4">
            {visible.length === 0 && (
              <p className="m-0 rounded-2xl border-[3px] border-ink/15 p-4 text-sm">
                Select a channel to see its caption.
              </p>
            )}
            {visible.map((v) => (
              <div key={v.id} className={`grid gap-2 rounded-2xl border-[3px] p-4 ${ACCENT[v.id]}`}>
                <p className="m-0 flex items-center gap-2 text-sm font-semibold">
                  {v.id === "instagram" && <ChannelIcon service="instagram" className="size-4 shrink-0" />}
                  {v.label} · {plural(chosen.filter((c) => variantFor(c.service) === v.id).length, "channel")}
                </p>
                <div className="whitespace-pre-wrap rounded-xl bg-surface px-3 py-2 ring-1 ring-ink/15">
                  {captionFor(v.id)}
                </div>
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
            <h2 className="m-0 text-2xl">{modalTitle}</h2>
            <button
              type="button"
              onClick={() => runRef.current?.close()}
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full hover:bg-ink/10"
            >
              <X aria-hidden className="size-5" strokeWidth={2.25} />
            </button>
          </div>
          <p className="m-0 px-7 pb-4 text-sm">{modalIntro}</p>
          {results.some((v) => typeof v === "object" && v.fake) && (
            <p role="status" className="mx-7 mb-4 rounded-xl bg-surface p-3 text-sm font-semibold ring-2 ring-honey">
              Fake mode: nothing was sent to Buffer.
            </p>
          )}
          {unknownCount > 0 && (
            <p role="alert" className="mx-7 mb-4 rounded-xl bg-surface p-3 text-sm font-semibold ring-2 ring-coral">
              {plural(unknownCount, "post")} may or may not have gone out. Check Buffer before sending again, so nothing is
              posted twice.
            </p>
          )}
          {started && !busy && !ready && (
            <p className="m-0 px-7 pb-4 text-sm">
              How did it go?{" "}
              <a href="/feedback" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                Leave feedback
              </a>
            </p>
          )}
          <div className="min-h-0 overflow-y-auto px-7 pb-2">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{mode === "now" ? "Posts by channel" : "Drafts by channel"}</caption>
              <thead>
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
              <tbody>
                {chosen.map((c) => {
                  const v = rowView(c);
                  return (
                    <tr key={c.id} className="border-b border-ink/10 align-top">
                      <td className="py-2.5 pr-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <ChannelIcon service={c.service} className="size-4 shrink-0 text-ink/60" />
                          <span title={c.name} className="min-w-0 truncate font-semibold">
                            {c.name}
                          </span>
                        </span>
                        <span className="block pl-6 text-xs text-ink/70">
                          {plural(Math.min(urls.length, imageLimit(c.service)), "slide")}
                        </span>
                        <span className="block max-w-[16rem] truncate pl-6 text-xs text-ink/70" title={captionFor(variantFor(c.service))}>
                          {captionFor(variantFor(c.service))}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`flex items-center gap-2 ${v.tone === "bad" ? "font-semibold text-coral" : v.tone === "warn" ? "font-semibold" : ""}`}
                        >
                          {v.busy && <span aria-hidden className={spinner} />}
                          {v.text}
                        </span>
                        {v.detail && <span className="block text-xs">{v.detail}</span>}
                        {v.note && <span className="block text-xs">{v.note}</span>}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="flex flex-col items-end gap-1">
                          {v.bufferId && (
                            <a
                              href={`https://publish.buffer.com/posts/${encodeURIComponent(v.bufferId)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="whitespace-nowrap font-bold underline underline-offset-4"
                            >
                              {mode === "now" ? "In Buffer" : "Open in Buffer"}
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
                  Publish now
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => runRef.current?.close()} className={ghostButton}>
                  Close
                </button>
                {!busy && mode === "now" && pollStopped && nowIds.length > 0 && (
                  <button type="button" onClick={() => setPollGen((g) => g + 1)} className={ghostButton}>
                    Refresh
                  </button>
                )}
                {!busy && !allSent && retryable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => (mode === "now" ? arm(retryable) : send(retryable, "draft"))}
                    className={finishButton}
                  >
                    Retry {retryable.length} failed
                  </button>
                )}
                {!busy && started && (allSent || retryable.length === 0) && (
                  <a
                    href="https://publish.buffer.com"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-honey px-5 py-2.5 font-bold text-ink-deep hover:brightness-95"
                  >
                    Open Buffer
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </dialog>

      <FlowBar
        back={busy ? undefined : { href: backHref, label: "Write" }}
        status={
          started && !busy ? (
            <>
              {status} ·{" "}
              <button type="button" onClick={() => setModalOpen(true)} className="font-bold underline underline-offset-4">
                {mode === "now" ? "View posts" : "View drafts"}
              </button>
            </>
          ) : (
            status
          )
        }
      >
        {demo ? (
          <DemoGate signedIn={demo.signedIn} label="Finish demo" className={finishButton} onOpen={pollenBurst} />
        ) : n === 0 && !started ? (
          <>
            <span aria-disabled className={primaryDisabled}>
              Create draft
            </span>
            <span aria-disabled className={primaryDisabled}>
              Send now
            </span>
          </>
        ) : busy ? (
          <span aria-disabled className={primaryDisabled}>
            Sending…
          </span>
        ) : allSent ? (
          <a
            href={
              onlyPost && !onlyFake
                ? `https://publish.buffer.com/posts/${encodeURIComponent(onlyPost)}`
                : "https://publish.buffer.com"
            }
            target="_blank"
            rel="noreferrer"
            className={finishButton}
          >
            {onlyPost && !onlyFake ? (mode === "now" ? "Open post in Buffer" : "Open draft in Buffer") : "Open Buffer"}
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
              className={primaryButton}
            >
              Create draft
            </button>
            <button type="button" onClick={() => arm(chosen)} className={finishButton}>
              Send now
            </button>
          </>
        )}
      </FlowBar>
    </>
  );
}
