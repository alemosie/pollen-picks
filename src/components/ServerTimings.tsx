"use client";

import { useEffect } from "react";
import type { TimingReport } from "@/lib/timing";

/** Prints where the server's time went to the browser console when the address has ?timing=1 (or localStorage "pp-timing" is "1"). Renders nothing. */
export function ServerTimings({ report }: { report: TimingReport }) {
  useEffect(() => {
    let on = window.location.search.includes("timing=1");
    try {
      on ||= localStorage.getItem("pp-timing") === "1";
    } catch {
      /* storage unavailable */
    }
    if (!on) return;
    console.groupCollapsed(`[Pollen Picks] ${report.page}: ${report.totalMs}ms on the server`);
    console.table(report.steps);
    console.groupEnd();
  }, [report]);
  return null;
}
