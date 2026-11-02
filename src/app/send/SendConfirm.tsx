"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import { ChannelIcon } from "@/components/ChannelIcon";
import { FlowBar, primaryDisabled } from "@/components/FlowBar";
import {
  CAPTION_VARIANTS,
  buildCaption,
  variantFor,
  type CaptionItem,
  type CaptionOrder,
  type CaptionVariant,
} from "@/lib/caption";
import { serviceLabel, unsupportedReason } from "@/lib/channels";
import { pollenBurst } from "@/lib/pollen-puff";
import { clearProgress, loadFormat } from "@/lib/progress";
import type { DraftResult } from "@/app/api/draft/route";
import { SlideCarousel } from "./SlideCarousel";

type Channel = { id: string; name: string; service: string };
type Progress = "queued" | "sending" | DraftResult;

/** Drafts are created one channel per request, this many at a time: no single long request, and live progress. */
const CONCURRENCY = 3;

/** The last step's action is coral, to set it apart from the honey Continue buttons. */
const finishButton =
  "rounded-xl bg-coral px-6 py-3 font-bold text-ink-deep hover:brightness-95";
const ACCENT: Record<CaptionVariant, string> = {
  instagram: "border-honey",
  link: "border-sage",
};
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

type Choice = {
  selected: Set<string>;
  order: CaptionOrder;
  edited: Partial<Record<CaptionVariant, string>>;
};

export function SendConfirm({
  urls,
  channels,
  picks,
  captionItems,
  newsletter,
  heading,
  template,
  link,
  backHref,
}: {
  urls: string[];
  channels: Channel[];
  picks: number[];
  captionItems: CaptionItem[];
  newsletter: string;
  heading?: string;
  template: string;
  link: string;
  backHref: string;
}) {
  // What was chosen on the Prepare step, read from this browser once mounted.
  const [choice, setChoice] = useState<Choice | "missing" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  // "View all channels" modal, its network filter, and which network groups the user has opened or closed by hand.
  const [listOpen, setListOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = listRef.current;
    if (!d) return;
    if (listOpen && !d.open) d.showModal();
    if (!listOpen && d.open) d.close();
  }, [listOpen]);

  const sig = `${picks.join(",")}|${template}`;
  useEffect(() => {
    const t = setTimeout(() => {
      const f = loadFormat();
      const usable = new Set(
        channels.filter((c) => !unsupportedReason(c.service)).map((c) => c.id),
      );
      const selected =
        f && f.sig === sig ? f.selected.filter((id) => usable.has(id)) : [];
      setChoice(
        selected.length > 0 && f
          ? {
              selected: new Set(selected),
              order: f.order as CaptionOrder,
              edited: f.edited as Choice["edited"],
            }
          : "missing",
      );
    }, 0);
    return () => clearTimeout(t);
  }, [sig, channels]);

  const results = Object.values(progress);
  const allSent =
    !busy &&
    results.length > 0 &&
    results.every((v) => typeof v === "object" && v.ok);
  // A fully successful send finishes the flow: forget the saved progress.
  useEffect(() => {
    if (allSent) clearProgress();
  }, [allSent]);

  // When a send run finishes (with at least one draft made), show a results table once.
  const resultsRef = useRef<HTMLDialogElement>(null);
  const shownResults = useRef(false);
  const finished =
    !busy &&
    results.length > 0 &&
    results.every((v) => typeof v === "object") &&
    results.some((v) => typeof v === "object" && v.ok);
  useEffect(() => {
    if (!finished) shownResults.current = false;
    else if (!shownResults.current) {
      shownResults.current = true;
      resultsRef.current?.showModal();
    }
  }, [finished]);

  if (choice === null) return <p className="mt-10 font-semibold">Loading…</p>;

  const header = (
    <div className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h1 className="mb-3 text-4xl sm:text-5xl">
          <StepWord>Send</StepWord> to Buffer
        </h1>
        <div className="sm:mt-2">
          <ShareLinkButton />
        </div>
      </div>
      <p className="mb-0 max-w-2xl text-lg">
        One last look. Everything here is saved to Buffer as a draft; nothing is
        published.
      </p>
    </div>
  );

  if (choice === "missing")
    return (
      <>
        {header}
        <p className="rounded-2xl bg-surface p-6 font-semibold">
          Pick your channels and caption first.
        </p>
        <FlowBar back={{ href: backHref, label: "Prepare" }} />
      </>
    );

  const { selected, order, edited } = choice;
  const byId = new Map(channels.map((c) => [c.id, c]));
  const chosen = channels.filter((c) => selected.has(c.id));
  const n = chosen.length;
  const byService = new Map<string, Channel[]>();
  for (const c of [...chosen].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }),
  ))
    byService.set(c.service, [...(byService.get(c.service) ?? []), c]);
  const networks = [...byService.keys()].sort((a, b) =>
    serviceLabel(a).localeCompare(serviceLabel(b), "en", {
      sensitivity: "base",
    }),
  );
  const captionFor = (v: CaptionVariant) =>
    edited[v] ??
    buildCaption(captionItems, {
      newsletter,
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

  // When every failure has the same reason (e.g. images unreachable), say it once instead of on every row.
  const reasons = new Set(
    done
      .filter(([, v]) => !(v as DraftResult).ok)
      .map(([, v]) => (v as DraftResult).error),
  );
  const sharedReason =
    failed.length > 1 && reasons.size === 1 ? [...reasons][0] : undefined;

  async function send(targets: Channel[]) {
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
              channels: [{ id: c.id, service: c.service }],
              picks,
              captions: { [c.id]: captionFor(variantFor(c.service)) },
              template,
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
  }

  const started = entries.length > 0;
  // With a single draft, the finish button can open that draft directly.
  const only = entries.length === 1 ? entries[0][1] : null;
  const onlyPost =
    only && typeof only === "object" && only.ok ? only.postId : undefined;
  const status = busy
    ? `Creating drafts… ${done.length} of ${entries.length}`
    : started
      ? `${okCount} of ${entries.length} ${entries.length === 1 ? "draft" : "drafts"} created`
      : `${plural(n, "channel")} · saved as drafts`;

  const statusOf = (c: Channel) => {
    const v = progress[c.id];
    return typeof v === "object"
      ? v.ok
        ? "ok"
        : "failed"
      : v
        ? "pending"
        : "idle";
  };
  const channelRow = (c: Channel, tile = false) => {
    const v = progress[c.id];
    const r = typeof v === "object" ? v : null;
    return (
      <li
        key={c.id}
        className={tile ? "rounded-xl bg-surface px-4 py-3" : "py-2.5"}
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChannelIcon
            service={c.service}
            className="size-4 shrink-0 text-ink/60"
          />
          <span title={c.name} className="min-w-0 truncate font-semibold">
            {c.name}
          </span>
        </div>
        {v && (
          <p className="m-0 mt-1 pl-6 text-sm">
            {r ? (
              r.ok ? (
                <a
                  href={`https://publish.buffer.com/posts/${encodeURIComponent(r.postId ?? "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-4"
                >
                  Open draft in Buffer
                </a>
              ) : (
                <span className="font-semibold text-coral">Failed</span>
              )
            ) : (
              <span className="text-ink/70">
                {v === "sending" ? "Sending…" : "Waiting…"}
              </span>
            )}
          </p>
        )}
        {r && !r.ok && !sharedReason && (
          <p className="m-0 mt-1 pl-6 text-sm font-semibold">{r.error}</p>
        )}
        {r?.note && <p className="m-0 mt-1 pl-6 text-sm">{r.note}</p>}
      </li>
    );
  };
  const groupSummary = (list: Channel[]) => {
    const st = list.map(statusOf);
    if (st.includes("failed"))
      return (
        <span className="font-semibold text-coral">
          {st.filter((x) => x === "failed").length} failed
        </span>
      );
    if (st.every((x) => x === "ok"))
      return <span className="font-semibold">All created</span>;
    if (st.includes("pending") || st.includes("ok"))
      return <span className="text-ink/70">Sending…</span>;
    return null;
  };

  return (
    <>
      {header}
      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start">
        <div className="grid min-w-0 content-start gap-8">
          <SlideCarousel urls={urls} />
          <section className="rounded-2xl bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="m-0 text-2xl">Sending to ({n})</h2>
              {n >= 3 && (
                <button
                  type="button"
                  onClick={() => setListOpen(true)}
                  className="text-sm font-semibold underline underline-offset-4"
                >
                  View all
                </button>
              )}
            </div>
            <div className="divide-y divide-ink/10 border-y border-ink/10">
              {networks.map((svc) => {
                const list = byService.get(svc)!;
                // Open once there is something to show: each finished channel has its own "Open draft in Buffer" link.
                const open =
                  toggled[svc] ??
                  list.some((c) => typeof progress[c.id] === "object");
                return (
                  <details
                    key={svc}
                    open={open}
                    onToggle={(e) =>
                      e.currentTarget.open !== open
                        ? setToggled((t) => ({
                            ...t,
                            [svc]: e.currentTarget.open,
                          }))
                        : undefined
                    }
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 py-2.5 [&::-webkit-details-marker]:hidden">
                      <ChannelIcon service={svc} className="size-4 shrink-0" />
                      <span className="font-bold">{serviceLabel(svc)}</span>
                      <span className="text-ink/70">({list.length})</span>
                      <span className="ml-auto text-sm">
                        {groupSummary(list)}
                      </span>
                      <span aria-hidden className="text-ink/60">
                        {open ? "▾" : "▸"}
                      </span>
                    </summary>
                    <ul className="m-0 list-none divide-y divide-ink/10 p-0 pb-1 pl-2">
                      {list.map((c) => channelRow(c))}
                    </ul>
                  </details>
                );
              })}
            </div>
            {sharedReason && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-surface p-3 font-semibold ring-2 ring-coral"
              >
                {sharedReason}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-surface p-3 font-semibold ring-2 ring-coral"
              >
                {error}
              </p>
            )}
          </section>
        </div>

        <div className="grid min-w-0 gap-8">
          <section className="grid gap-4">
            {visible.map((v) => (
              <div
                key={v.id}
                className={`grid gap-2 rounded-2xl border-[3px] p-4 ${ACCENT[v.id]}`}
              >
                <p className="m-0 flex items-center gap-2 text-sm font-semibold">
                  {v.id === "instagram" && (
                    <ChannelIcon
                      service="instagram"
                      className="size-4 shrink-0"
                    />
                  )}
                  {v.label} ·{" "}
                  {plural(
                    chosen.filter((c) => variantFor(c.service) === v.id).length,
                    "channel",
                  )}
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
        ref={listRef}
        onClose={() => setListOpen(false)}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        aria-label="All channels"
        className="m-auto h-[min(34rem,85vh)] w-[min(34rem,94vw)] overflow-hidden rounded-2xl bg-page p-0 text-ink backdrop:bg-ink/60"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 px-7 pb-2 pt-6">
            <h2 className="m-0 text-2xl">Sending to ({n})</h2>
            <button
              type="button"
              onClick={() => listRef.current?.close()}
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full hover:bg-ink/10"
            >
              <X aria-hidden className="size-5" strokeWidth={2.25} />
            </button>
          </div>
          <div
            className="flex flex-wrap gap-2.5 border-b border-ink/10 px-7 py-5"
            role="group"
            aria-label="Filter by network"
          >
            {["all", ...networks].map((svc) => {
              const on = filter === svc;
              return (
                <button
                  key={svc}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(svc)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold transition ${on ? "bg-card text-ink-deep" : "bg-surface ring-1 ring-ink/15 hover:bg-ink/10"}`}
                >
                  {svc !== "all" && (
                    <ChannelIcon service={svc} className="size-3.5" />
                  )}
                  {svc === "all"
                    ? `All (${n})`
                    : `${serviceLabel(svc)} (${byService.get(svc)!.length})`}
                </button>
              );
            })}
          </div>
          <ul className="m-0 grid min-h-0 list-none content-start gap-2 overflow-y-auto px-7 py-5">
            {(filter === "all"
              ? networks
              : networks.filter((x) => x === filter)
            )
              .flatMap((svc) => byService.get(svc)!)
              .map((c) => channelRow(c, true))}
          </ul>
        </div>
      </dialog>

      <dialog
        ref={resultsRef}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        aria-label="Your drafts"
        className="m-auto max-h-[85vh] w-[min(36rem,94vw)] overflow-hidden rounded-2xl bg-page p-0 text-ink backdrop:bg-ink/60"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-4 px-7 pb-2 pt-6">
            <h2 className="m-0 text-2xl">
              {failed.length > 0
                ? "Some drafts need another try"
                : "Your drafts are ready"}
            </h2>
            <button
              type="button"
              onClick={() => resultsRef.current?.close()}
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full hover:bg-ink/10"
            >
              <X aria-hidden className="size-5" strokeWidth={2.25} />
            </button>
          </div>
          <p className="m-0 px-7 pb-4 text-sm">
            Nothing is published. Open each draft in Buffer to review, edit and
            schedule it.
          </p>
          <div className="min-h-0 overflow-y-auto px-7 pb-2">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Drafts by channel</caption>
              <thead>
                <tr className="border-b border-ink/15">
                  <th scope="col" className="py-2 pr-3 font-bold">
                    Channel
                  </th>
                  <th scope="col" className="py-2 pr-3 font-bold">
                    Status
                  </th>
                  <th scope="col" className="py-2 text-right font-bold">
                    <span className="sr-only">Link</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {chosen.map((c) => {
                  const v = progress[c.id];
                  const r = typeof v === "object" ? v : null;
                  return (
                    <tr key={c.id} className="border-b border-ink/10 align-top">
                      <td className="py-2.5 pr-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <ChannelIcon
                            service={c.service}
                            className="size-4 shrink-0 text-ink/60"
                          />
                          <span
                            title={c.name}
                            className="min-w-0 truncate font-semibold"
                          >
                            {c.name}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {r ? (
                          r.ok ? (
                            "Draft created"
                          ) : (
                            <span className="font-semibold">
                              {r.error ?? "Failed"}
                            </span>
                          )
                        ) : (
                          "Not sent"
                        )}
                        {r?.note && (
                          <span className="block text-xs">{r.note}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {r?.ok && (
                          <a
                            href={`https://publish.buffer.com/posts/${encodeURIComponent(r.postId ?? "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="whitespace-nowrap font-bold underline underline-offset-4"
                          >
                            Open in Buffer
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink/10 px-7 py-4">
            <button
              type="button"
              onClick={() => resultsRef.current?.close()}
              className="rounded-xl px-4 py-2.5 font-bold ring-1 ring-ink/30 hover:bg-ink/10"
            >
              Close
            </button>
            <a
              href="https://publish.buffer.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-honey px-5 py-2.5 font-bold text-ink-deep hover:brightness-95"
            >
              Open Buffer
            </a>
          </div>
        </div>
      </dialog>

      <FlowBar
        back={busy ? undefined : { href: backHref, label: "Prepare" }}
        status={
          finished ? (
            <>
              {status} ·{" "}
              <button
                type="button"
                onClick={() => resultsRef.current?.showModal()}
                className="font-bold underline underline-offset-4"
              >
                View drafts
              </button>
            </>
          ) : (
            status
          )
        }
      >
        {busy ? (
          <span aria-disabled className={primaryDisabled}>
            Sending…
          </span>
        ) : allSent ? (
          <a
            href={
              onlyPost
                ? `https://publish.buffer.com/posts/${encodeURIComponent(onlyPost)}`
                : "https://publish.buffer.com"
            }
            target="_blank"
            rel="noreferrer"
            className={finishButton}
          >
            {onlyPost ? "Open draft in Buffer" : "Open Buffer"}
          </a>
        ) : failed.length > 0 ? (
          <button
            type="button"
            onClick={() => send(failed)}
            className={finishButton}
          >
            Retry {failed.length} failed
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              pollenBurst(e.currentTarget);
              send(chosen);
            }}
            className={finishButton}
          >
            Finish – Send {n === 1 ? "1 draft" : `${n} drafts`}
          </button>
        )}
      </FlowBar>
    </>
  );
}
