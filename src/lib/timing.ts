// Where a page's server time goes. A page wraps each step it waits for in `t.step("label", promise)`; the steps are listed in the server log
// ("[timing] /source 412ms: session 120, connection 98") and sent to the browser, which prints them with `?timing=1` on the address (see
// components/ServerTimings). Steps that run together overlap, so their times add up to more than the total: the total is the wall clock.

export type TimingReport = { page: string; totalMs: number; steps: { label: string; ms: number }[] };

export function timer(page: string) {
  const t0 = Date.now();
  const steps: { label: string; ms: number }[] = [];
  return {
    /** Awaits `work` and records how long it took. Errors pass through (and are timed too). */
    async step<T>(label: string, work: Promise<T> | (() => Promise<T>)): Promise<T> {
      const s = Date.now();
      try {
        return await (typeof work === "function" ? work() : work);
      } finally {
        steps.push({ label, ms: Date.now() - s });
      }
    },
    /** Logs the report and returns it. Call once, after the awaits. */
    report(): TimingReport {
      const r = { page, totalMs: Date.now() - t0, steps: [...steps] };
      console.info(`[timing] ${page} ${r.totalMs}ms: ${r.steps.map((x) => `${x.label} ${x.ms}`).join(", ")}`);
      return r;
    },
  };
}

/** A `Server-Timing` header value for a route handler (shows in the browser's Network tab, Timing section). */
export const serverTimingHeader = (steps: { label: string; ms: number }[]) =>
  steps.map((s, i) => `s${i};desc="${s.label.replace(/[^a-z0-9 _-]/gi, "")}";dur=${s.ms}`).join(", ");
