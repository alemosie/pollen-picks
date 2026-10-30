import Link from "next/link";

// Progress indicator: a gently wavy branch with five pollen dots on short twigs, above and below it.
// Done = honey, current = larger coral, upcoming = hollow.
const STEPS = ["Home", "Source", "Pick", "Create", "Review"] as const;
const STEM = "M30 120 C120 90 240 84 360 92 S 600 128 720 128 S 900 108 970 92";
// Share of the branch's length at which each twig joins it.
const AT = [0.077, 0.277, 0.478, 0.702, 0.924];
// sy = stem height under the dot; (dx, dy) = how far its twig reaches to the dot centre.
const DOTS = [
  { x: 100, sy: 102, dx: 16, dy: -36 },
  { x: 290, sy: 89, dx: 20, dy: 34 },
  { x: 480, sy: 105, dx: 16, dy: -32 },
  { x: 690, sy: 127, dx: 16, dy: 34 },
  { x: 900, sy: 109, dx: 16, dy: -36 },
];

export function StepTree({ current, hrefs = {} }: { current: 1 | 2 | 3 | 4 | 5; hrefs?: Partial<Record<number, string>> }) {
  const progress = AT[current - 1];
  return (
    <nav aria-label="Progress" className="mx-auto w-full max-w-[50%] max-sm:max-w-full">
      <svg viewBox="0 40 1000 147" role="img" aria-label={`Step ${current} of 5: ${STEPS[current - 1]}`} className="h-auto w-full overflow-visible">
        <path d={STEM} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-[#dcd3c6]" />
        <path d={STEM} fill="none" strokeWidth="7" strokeLinecap="round" pathLength={1} strokeDasharray={`${progress} 1`} className="stroke-ink" />
        {DOTS.map((d, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "todo";
          const r = 16;
          const up = d.dy < 0;
          const href = state === "done" ? hrefs[n] : undefined;
          const cx = d.x + d.dx;
          const cy = d.sy + d.dy;
          const dot = (
            <g className="group">
              <path
                d={`M${d.x} ${d.sy} L${cx} ${cy}`}
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                className={n <= current ? "stroke-ink" : "stroke-[#dcd3c6]"}
              />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                                className={state === "done" ? "fill-honey" : state === "current" ? "fill-coral" : "fill-[#dcd3c6]"}
              />
              <rect
                x={cx - STEPS[i].length * 8}
                y={(up ? cy - r - 22 : cy + r + 30) + 7}
                width={STEPS[i].length * 16}
                height="4"
                rx="2"
                className="pointer-events-none fill-coral opacity-0 transition-opacity group-hover:opacity-100"
              />
              <text
                x={cx}
                y={up ? cy - r - 22 : cy + r + 30}
                textAnchor="middle"
                fontSize="28"
                fontWeight="700"
                className="pointer-events-none fill-ink opacity-0 transition-opacity group-hover:opacity-100"
              >
                {STEPS[i]}
              </text>
            </g>
          );
          return href ? (
            <Link key={i} href={href} aria-label={`Go back to ${STEPS[i]}`} className="cursor-pointer">
              {dot}
            </Link>
          ) : (
            <g key={i}>{dot}</g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-sm font-bold" aria-hidden>
        Step {current} of 5: <span className="underline decoration-coral decoration-[3px] underline-offset-4">{STEPS[current - 1]}</span>
      </p>
    </nav>
  );
}

/** Centered progress row above the page title. */
export function StepAside({ current, hrefs }: { current: 1 | 2 | 3 | 4 | 5; hrefs?: Partial<Record<number, string>> }) {
  return (
    <div className="mb-12">
      <StepTree current={current} hrefs={hrefs} />
    </div>
  );
}
