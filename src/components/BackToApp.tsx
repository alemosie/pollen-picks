"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loadProgress, resumeHref } from "@/lib/progress";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

/** "Back to the app" on Settings: lands on the step the user left, with its picks and template (the saved address), else the first step. */
export function BackToApp() {
  const href = useSyncExternalStore(subscribe, () => resumeHref(loadProgress()?.href), () => "/source");
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-surface px-4 py-2.5 font-bold ring-1 ring-ink/15 transition hover:ring-ink/40">
      <ArrowLeft aria-hidden className="size-4" />
      Back to the app
    </Link>
  );
}
