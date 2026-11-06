"use client";

import { useState } from "react";
import { BeehiivMark } from "@/components/BeehiivLogo";
import type { BeehiivIssue } from "@/lib/beehiiv";
import { sized } from "@/lib/cdn";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });

/** The issue's thumbnail, or a quiet placeholder when it has none or fails to load. */
function Thumb({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span aria-hidden className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-ink/5">
        <BeehiivMark className="h-5 w-auto text-ink/30" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={sized(url, 240)} alt="" width={80} height={56} loading="lazy" onError={() => setFailed(true)} className="h-14 w-20 shrink-0 rounded-lg bg-ink/5 object-cover" />
  );
}

const pageButton =
  "inline-flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2 text-sm font-bold ring-1 ring-ink/15 hover:ring-ink/40 disabled:opacity-40 disabled:hover:ring-ink/15";

/** Sent issues, five to a page, newest first. One is always chosen: the newest, until the user picks another. */
export function IssueList({
  issues,
  page,
  totalPages,
  chosen,
  onSelect,
  onPage,
  loading,
  error,
  onRetry,
}: {
  issues: BeehiivIssue[] | null;
  page: number;
  totalPages: number;
  chosen: BeehiivIssue | null;
  onSelect: (issue: BeehiivIssue) => void;
  onPage: (page: number) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div>
        <p role="alert" className="mb-2 mt-0 border-l-4 border-coral pl-3 text-sm font-semibold">
          {error}
        </p>
        <button type="button" onClick={onRetry} className="text-sm font-bold underline underline-offset-4">
          Try again
        </button>
      </div>
    );
  }
  if (!issues) {
    return (
      <p role="status" className="m-0 text-sm font-semibold">
        Loading your issues…
      </p>
    );
  }
  if (issues.length === 0 && page === 1) {
    return <p className="m-0 text-sm">No sent issues yet. Once you send one from beehiiv, it will show up here.</p>;
  }
  // The chosen issue can sit on another page: say so, so it is clear what Pick will use.
  const elsewhere = chosen && !issues.some((i) => i.id === chosen.id) ? chosen : null;
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-busy={loading}>
      <legend className="mb-3 p-0 text-lg font-bold">Choose an issue</legend>
      <div role="radiogroup" className={`grid grid-cols-[minmax(0,1fr)] gap-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
        {issues.map((i, n) => (
          <label
            key={i.id}
            className="flex min-w-0 items-center gap-3 rounded-xl bg-surface px-3 py-3 ring-1 ring-ink/10 sm:px-4 outline-offset-2 has-[:checked]:shadow-[0_0_0_3px_var(--color-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
          >
            <input type="radio" name="issue" value={i.id} checked={chosen?.id === i.id} onChange={() => onSelect(i)} className="size-4 shrink-0 accent-ink" />
            <Thumb url={i.thumbnail} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{i.title}</span>
              <span className="flex items-center gap-2 text-sm">
                {date(i.publishedAt)}
                {page === 1 && n === 0 && <span className="shrink-0 rounded-full bg-honey px-2.5 py-0.5 text-xs font-bold text-ink-deep">Latest</span>}
              </span>
            </span>
          </label>
        ))}
      </div>
      {elsewhere && (
        <p className="mb-0 mt-3 text-sm">
          Selected: <span className="font-semibold">{elsewhere.title}</span> ({date(elsewhere.publishedAt)})
        </p>
      )}
      {totalPages > 1 && (
        <nav aria-label="Issue pages" className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => onPage(page - 1)} disabled={loading || page <= 1} className={pageButton}>
            <span aria-hidden>←</span> Newer
          </button>
          <span className="text-sm font-semibold" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <button type="button" onClick={() => onPage(page + 1)} disabled={loading || page >= totalPages} className={pageButton}>
            Older <span aria-hidden>→</span>
          </button>
        </nav>
      )}
    </fieldset>
  );
}
