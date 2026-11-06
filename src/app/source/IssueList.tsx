"use client";

import { IssueRow } from "@/components/IssueRow";
import type { BeehiivIssue } from "@/lib/beehiiv";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });

const pageButton =
  "inline-flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2 text-sm font-bold ring-1 ring-ink/15 hover:ring-ink/40 disabled:opacity-40 disabled:hover:ring-ink/15";

/** Sent issues, five to a page, newest first. One is always chosen: the newest, until the user picks another. */
export function IssueList({
  issues,
  page,
  totalPages,
  chosen,
  active,
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
  /** False while the pasted link is the chosen post: no issue row shows as chosen then. */
  active: boolean;
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
  const elsewhere = active && chosen && !issues.some((i) => i.id === chosen.id) ? chosen : null;
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-busy={loading}>
      <legend className="sr-only">Your issues</legend>
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
        {issues.map((i, n) => (
          <IssueRow
            key={i.id}
            value={i.id}
            title={i.title}
            image={i.thumbnail}
            detail={date(i.publishedAt)}
            badge={page === 1 && n === 0 ? "Latest" : undefined}
            checked={active && chosen?.id === i.id}
            onChange={() => onSelect(i)}
          />
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
