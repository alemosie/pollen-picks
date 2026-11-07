"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { feedbackOpen } from "@/lib/contest";
import { track } from "@/lib/events";

/** The logged-in app's pages. The landing page has its own banner, and the demo has the Demo strip. */
const APP_PAGES = /^\/(source|pick|design|write|send|history|settings|beehiiv)(\/|$)/;

function Strip() {
  const path = usePathname();
  // The strip asks for feedback for the contest, so it goes with the feedback prompt: gone from 12 Nov 00:00 Amsterdam time (see ../lib/contest).
  const [open] = useState(() => feedbackOpen());
  if (!open || !APP_PAGES.test(path)) return null;
  return (
    <div role="region" aria-label="Project status" className="bg-ink px-6 py-2.5 text-center text-sm font-semibold text-cream">
      Building for Buffer Commit 🏗️{" "}
      <Link
        href="/feedback"
        onClick={() => track("feedback_clicked")}
        className="underline decoration-honey decoration-[3px] underline-offset-4 hover:decoration-coral"
      >
        Leave feedback
      </Link>{" "}
      to help our self-funded nonprofit win up to $25,600!
    </div>
  );
}

/** A slim strip above every page of the app: this is a Buffer Commit entry, and feedback is how it gets judged. Shown until 12 Nov 2026 00:00 Amsterdam time. */
export function ProjectBanner() {
  return (
    <Suspense fallback={null}>
      <Strip />
    </Suspense>
  );
}
