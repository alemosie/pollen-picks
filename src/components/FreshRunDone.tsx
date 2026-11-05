"use client";

import { useEffect } from "react";
import { endFreshRun } from "@/lib/progress";

/** Renders nothing. The new run's first page has loaded, so the request for a fresh start is spent (reloading must not repeat it). */
export function FreshRunDone() {
  useEffect(() => endFreshRun(), []);
  return null;
}
