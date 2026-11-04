"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { useNextStep } from "@/lib/nextStep";
import { pollenPuff } from "@/lib/pollen-puff";

// Progress indicator: a gently wavy branch with the five steps resting right on it.
// Done = honey and a link back; current = larger coral; upcoming = hollow. The next step is revealed (coral outline, a soft
// puff of pollen once, and a link) once the bottom bar's main action is ready, so there are two places to move forward.
const STEPS = ["Source", "Pick", "Design", "Write", "Send"] as const;
const STEM = "M30 120 C120 90 240 84 360 92 S 600 128 720 128 S 900 108 970 92";
// Share of the branch's length at which each step sits.
const AT = [0.06, 0.28, 0.5, 0.72, 0.94];

// Find where each step lands on the curve by walking its three cubic segments.
type P = [number, number];
const SEGS: [P, P, P, P][] = [
  [
    [30, 120],
    [120, 90],
    [240, 84],
    [360, 92],
  ],
  [
    [360, 92],
    [480, 100],
    [600, 128],
    [720, 128],
  ],
  [
    [720, 128],
    [840, 128],
    [900, 108],
    [970, 92],
  ],
];
const cubic = ([a, b, c, d]: [P, P, P, P], t: number): P => {
  const u = 1 - t;
  return [0, 1].map(
    (k) =>
      u * u * u * a[k] +
      3 * u * u * t * b[k] +
      3 * u * t * t * c[k] +
      t * t * t * d[k],
  ) as P;
};
const POINTS: P[] = SEGS.flatMap((seg) =>
  Array.from({ length: 100 }, (_, i) => cubic(seg, i / 100)),
).concat([[970, 92]]);
const LEN = POINTS.reduce(
  (acc, p, i) =>
    i
      ? [
          ...acc,
          acc[i - 1] +
            Math.hypot(p[0] - POINTS[i - 1][0], p[1] - POINTS[i - 1][1]),
        ]
      : [0],
  [] as number[],
);
const onCurve = (share: number): P => {
  const target = share * LEN[LEN.length - 1];
  const i = Math.max(
    1,
    LEN.findIndex((l) => l >= target),
  );
  return POINTS[i];
};
const SPOTS = AT.map(onCurve);

export function StepTree({
  current,
  hrefs = {},
  finalLabel,
}: {
  current: 1 | 2 | 3 | 4 | 5;
  hrefs?: Partial<Record<number, string>>;
  /** Name for the last step, where it isn't "Send" (the demo ends with "Finish"). */
  finalLabel?: string;
}) {
  const next = useNextStep();
  // Once the next step is ready, the dark line grows halfway toward it.
  const progress = next !== null && current < 5 ? (AT[current - 1] + AT[current]) / 2 : AT[current - 1];
  // One soft puff of pollen the moment the next step is revealed (not on every change of its link).
  const nextDot = useRef<SVGCircleElement>(null);
  const wasReady = useRef(false);
  const mountedAt = useRef(0);
  const isReady = next !== null;
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);
  useEffect(() => {
    // Only for something the visitor just did. A step that is already ready on arrival (picks restored, a source
    // preselected) is revealed quietly: the puff there would just be noise.
    const justArrived = Date.now() - mountedAt.current < 1500;
    if (isReady && !wasReady.current && !justArrived && nextDot.current) pollenPuff(nextDot.current);
    wasReady.current = isReady;
  }, [isReady]);
  const steps = finalLabel ? [...STEPS.slice(0, 4), finalLabel] : STEPS;
  return (
    <nav aria-label="Progress" className="w-[26rem] max-w-full">
      <svg
        viewBox="0 30 1000 160"
        role="img"
        aria-label={`Step ${current} of 5: ${steps[current - 1]}`}
        className="h-auto w-full overflow-visible"
      >
        <path
          d={STEM}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-[#dcd3c6]"
        />
        <path
          d={STEM}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${progress} 1`}
          className="stroke-ink transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none"
        />
        {steps.map((label, i) => {
          const n = i + 1;
          const state =
            n < current ? "done" : n === current ? "current" : "todo";
          const [x, y] = SPOTS[i];
          const above = i % 2 === 0;
          const ty = above ? y - 34 : y + 52;
          const ready = n === current + 1 && next !== null;
          const href = state === "done" ? hrefs[n] : ready ? next.href : undefined;
          const shape = (
            <g className="group">
              <circle
                ref={ready ? nextDot : undefined}
                cx={x}
                cy={y}
                r={state === "current" ? 22 : 16}
                strokeWidth={state === "todo" ? 6 : 0}
                className={
                  state === "done"
                    ? "fill-honey transition group-hover:fill-coral"
                    : state === "current"
                      ? "fill-coral"
                      : ready
                        ? "fill-cream stroke-coral transition group-hover:fill-coral"
                        : "fill-cream stroke-[#dcd3c6]"
                }
              />
              <text
                x={x}
                y={ty}
                textAnchor="middle"
                fontSize="30"
                fontWeight={state === "todo" && !ready ? 500 : 700}
                className={`${state === "todo" && !ready ? "fill-ink/45" : "fill-ink"} ${href ? "group-hover:fill-coral" : ""}`}
              >
                {label}
              </text>
              {href && (
                <rect
                  x={x - 60}
                  y={above ? ty - 36 : y - 30}
                  width={120}
                  height={above ? y - ty + 66 : ty - y + 40}
                  fill="transparent"
                />
              )}
            </g>
          );
          return href ? (
            <Link
              key={label}
              href={href}
              aria-label={state === "done" ? `Go back to ${label}` : `Continue to ${label}`}
              onClick={state === "done" ? undefined : next?.onNavigate}
              className="cursor-pointer outline-offset-2"
            >
              {shape}
            </Link>
          ) : (
            <g
              key={label}
              aria-current={state === "current" ? "step" : undefined}
            >
              {shape}
            </g>
          );
        })}
      </svg>
    </nav>
  );
}

/** Top row of every step: logo, progress, log out. */
export function PageHeader({
  current,
  hrefs,
  logoHref = "/",
  right,
  finalLabel,
}: {
  current: 1 | 2 | 3 | 4 | 5;
  hrefs?: Partial<Record<number, string>>;
  logoHref?: string;
  right?: ReactNode;
  finalLabel?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center pt-5 sm:mb-14 justify-between gap-x-6 gap-y-2">
      <Logo height={48} href={logoHref} />
      <div className="order-last mt-8 flex w-full justify-center sm:order-none sm:mt-0 sm:w-auto">
        <StepTree current={current} hrefs={hrefs} finalLabel={finalLabel} />
      </div>
      {right ?? (
        <span className="flex items-center gap-5 text-sm font-semibold">
          <Link href="/settings" className="underline underline-offset-4">
            Settings
          </Link>
          <a
            href="/api/auth/buffer/logout"
            className="underline underline-offset-4"
          >
            Log out
          </a>
        </span>
      )}
    </header>
  );
}
