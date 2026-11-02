"use client";

import { useEffect } from "react";
import { saveProgress } from "@/lib/progress";

/** Renders nothing; remembers that the user reached this step (with its URL, so picks and template come along). */
export function SaveStep({ step }: { step: number }) {
  useEffect(() => {
    saveProgress(location.pathname + location.search, step);
  }, [step]);
  return null;
}
