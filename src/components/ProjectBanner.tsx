"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { track } from "@/lib/events";

/** The logged-in app's pages. The landing page has its own banner, and the demo has the Demo strip. */
const APP_PAGES = /^\/(source|pick|design|write|send|history|settings|beehiiv)(\/|$)/;

function Strip() {
  const path = usePathname();
  if (!APP_PAGES.test(path)) return null;
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

/** A slim strip above every page of the app: this is a Buffer Commit entry, and feedback is how it gets judged. */
export function ProjectBanner() {
  return (
    <Suspense fallback={null}>
      <Strip />
    </Suspense>
  );
}
