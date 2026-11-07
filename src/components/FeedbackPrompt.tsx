"use client";

import { useState } from "react";
import { feedbackOpen } from "@/lib/contest";
import { track } from "@/lib/events";

/**
 * "How did it go?" with a real button. Shown once something has been sent, and only until 12 Nov 2026 00:00 Amsterdam time (see ../lib/contest). Opens the form in a new tab,
 * so a send in progress is never lost.
 */
export function FeedbackPrompt({ className = "" }: { className?: string }) {
  // Read once when the prompt first appears: it is not worth a re-render at the stroke of midnight.
  const [open] = useState(() => feedbackOpen());
  if (!open) return null;
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
