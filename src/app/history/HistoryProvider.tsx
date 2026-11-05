"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PollenSpinner } from "@/components/PollenSpinner";
import type { HistoryEntry } from "@/lib/postHistory";

/** Buffer's statuses that won't change again. */
const FINAL = new Set(["sent", "error", "needs_approval", "draft", "failed", "unknown"]);
/** Posts Buffer is still publishing are asked about this often, for a while (Buffer limits requests for the whole app). */
const CHECK_EVERY_MS = 20_000;
const MAX_CHECKS = 12;
/** Entries our own send queue is still working on are checked often. */
const QUEUE_EVERY_MS = 4_000;
const MAX_QUEUE_CHECKS = 150;

export const isQueued = (c: HistoryEntry) => c.status === "queued" || c.status === "working";

type Ctx = {
  items: HistoryEntry[];
  /** Browser clock, set once mounted so the server's HTML never has to match it. */
  now: number | null;
  checking: boolean;
  error: string;
  /** Something is still going out and this page is asking now and then. */
  watching: boolean;
  /** Something is still going out but this page has stopped asking: the person has to press the button. */
  gaveUp: boolean;
  /** Ask now (and start watching again). */
  check: () => void;
  retrying: boolean;
  /** Put failed entries back in the queue. */
  /** `confirmed`: the person said yes to publishing live posts among them (the server asks for it). */
  retry: (ids: number[], confirmed?: boolean, sendAgain?: boolean) => void;
};
const HistoryContext = createContext<Ctx | null>(null);

export function useHistory(): Ctx {
  const c = useContext(HistoryContext);
  if (!c) throw new Error("useHistory needs a HistoryProvider.");
  return c;
}

/**
 * Holds the History page's entries and keeps them fresh: it asks the server (which also moves the send queue along) straight away when something is
 * waiting, every few seconds while the queue is busy, and less often for posts Buffer is still publishing. `filterQuery` keeps refreshes to the
 * filters in the URL. The provider is keyed by it, so changing a filter starts afresh.
 */
export function HistoryProvider({ initial, filterQuery, children }: { initial: HistoryEntry[]; filterQuery: string; children: ReactNode }) {
  const [items, setItems] = useState(initial);
  const [checking, setChecking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState<number | null>(null);
  // How many times the page has asked on its own since it last started watching.
  const [asked, setAsked] = useState(0);
  const wasQueue = useRef(isQueuedAny(initial));

  const queueOpen = items.some(isQueued);
  const pending = queueOpen || items.some((c) => c.mode === "now" && c.postId && !FINAL.has(c.status));
  const limit = queueOpen ? MAX_QUEUE_CHECKS : MAX_CHECKS;
  const gaveUp = pending && asked >= limit;
  const watching = pending && !gaveUp;

  const refresh = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const res = await fetch(`/api/history/refresh${filterQuery ? `?${filterQuery}` : ""}`, { method: "POST", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { history?: HistoryEntry[]; error?: string };
      if (res.status === 401) setError("Your Buffer login has expired. Log in again to check on these.");
      else if (!res.ok || !j.history) setError(j.error ?? "Couldn't check Buffer right now. Try again in a moment.");
      else {
        const stillQueued = isQueuedAny(j.history);
        // Once the queue has emptied, Buffer's own statuses get a fresh allowance of checks.
        if (wasQueue.current && !stillQueued) setAsked(0);
        wasQueue.current = stillQueued;
        setItems(j.history);
      }
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setChecking(false);
      setNow(Date.now());
    }
  }, [filterQuery]);

  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!watching) return;
    const t = setTimeout(
      () => {
        setAsked((n) => n + 1);
        void refresh();
      },
      asked === 0 ? 0 : queueOpen ? QUEUE_EVERY_MS : CHECK_EVERY_MS,
    );
    return () => clearTimeout(t);
  }, [watching, asked, queueOpen, items, refresh]);

  const check = useCallback(() => {
    setAsked(0);
    void refresh();
  }, [refresh]);

  const retry = useCallback(
    (ids: number[], confirmed = false, sendAgain = false) => {
      if (ids.length === 0) return;
      setRetrying(true);
      setError("");
      void (async () => {
        try {
          const res = await fetch("/api/history/retry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids, confirmed, sendAgain }),
          });
          const j = (await res.json().catch(() => ({}))) as { requeued?: number; error?: string };
          if (res.status === 401) setError("Your Buffer login has expired. Log in again to retry these.");
          else if (res.status === 409) setError("Check those posts and try again.");
          else if (!res.ok) setError(j.error ?? "Couldn't retry right now. Try again in a moment.");
          else {
            if (!j.requeued) setError("Those can't be retried any more. Send them again from the send page.");
            wasQueue.current = true;
            setAsked(0);
            await refresh();
          }
        } catch {
          setError("Couldn't reach Pollen Picks. Check your connection and try again.");
        } finally {
          setRetrying(false);
        }
      })();
    },
    [refresh],
  );

  const value = useMemo<Ctx>(
    () => ({ items, now, checking, error, watching, gaveUp, check, retrying, retry }),
    [items, now, checking, error, watching, gaveUp, check, retrying, retry],
  );
  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

function isQueuedAny(rows: HistoryEntry[]) {
  return rows.some(isQueued);
}

const HEADER_BUTTON = "inline-flex shrink-0 items-center gap-2 rounded-xl bg-surface px-4 py-2.5 font-bold ring-1 ring-ink/15 transition hover:ring-ink/40 disabled:opacity-60";

/** "Check Buffer for updates", for the top of the page. */
export function HistoryCheckButton() {
  const { check, checking } = useHistory();
  return (
    <button type="button" onClick={check} disabled={checking} className={HEADER_BUTTON}>
      {checking && <PollenSpinner className="size-4" />}
      {checking ? "Checking Buffer…" : "Check Buffer for updates"}
    </button>
  );
}
