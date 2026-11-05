"use client";

import { track } from "@/lib/events";

/** "How did it go?" with a real button. Shown once something has been sent. Opens the form in a new tab, so a send in progress is never lost. */
export function FeedbackPrompt({ className = "" }: { className?: string }) {
  return (
    <div role="region" aria-label="Feedback" className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl bg-surface p-4 ring-2 ring-honey ${className}`}>
      <p className="m-0 min-w-0 flex-1 basis-56 text-sm">
        <span className="font-bold">Did everything go as expected?</span> We&rsquo;d love to hear about how it went.
      </p>
      <a
        href="/feedback"
        target="_blank"
        rel="noreferrer"
        onClick={() => track("feedback_clicked")}
        className="shrink-0 rounded-xl bg-honey px-5 py-2.5 font-bold text-ink-deep hover:brightness-95"
      >
        Leave feedback
      </a>
    </div>
  );
}
