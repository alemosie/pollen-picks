// Shown while a step loads. Three ribbons of color drift past, each on its own sine wave: a calm, flowing contrast to the hero's pollen burst.
// Pure CSS/SVG, so it works as a Suspense fallback. It only appears if a page takes close to a second, so quick loads never flash it.

const HALF = 200; // half a wave, px
const SPAN = 2000; // wider than the stage so the loop is seamless (it slides by one full wave, 2 x HALF)

/** One long sine ribbon as a single path: a quadratic start, then smooth "T" continuations. */
function wave(y: number, amp: number): string {
  const parts = [
    `M${-2 * HALF} ${y} Q${-2 * HALF + HALF / 2} ${y - amp} ${-HALF} ${y}`,
  ];
  for (let x = 0; x < SPAN - 2 * HALF; x += HALF) parts.push(`T${x} ${y}`);
  return parts.join(" ");
}

const RIBBONS = [
  {
    y: 112,
    amp: 46,
    color: "var(--color-honey)",
    dots: "var(--color-coral)",
    width: 14,
    secs: 7,
    delay: 0,
  },
  {
    y: 100,
    amp: 62,
    color: "var(--color-coral)",
    dots: "var(--color-honey)",
    width: 10,
    secs: 10,
    delay: -3,
  },
  {
    y: 90,
    amp: 34,
    color: "var(--color-sage)",
    dots: "var(--color-ink)",
    width: 12,
    secs: 13,
    delay: -6,
  },
] as const;

// Pollen grains drift above and below each ribbon. The pattern repeats every full wave (400px) so the loop stays seamless.
const GRAINS = [
  { off: -26, r: 6 },
  { off: 20, r: 4 },
  { off: -14, r: 3 },
  { off: 30, r: 5 },
];

/** Height of the ribbon at x: the path's quadratic halves are parabolas that alternate up and down. */
function waveY(x: number, y: number, amp: number): number {
  const k = Math.floor((x + 2 * HALF) / HALF);
  const t = ((x + 2 * HALF) % HALF) / HALF;
  return y - (k % 2 === 0 ? 1 : -1) * 2 * amp * t * (1 - t);
}

function grains(y: number, amp: number) {
  const out: { x: number; y: number; r: number; i: number }[] = [];
  for (let i = 0, x = -2 * HALF; x < SPAN - 2 * HALF; i++, x += 100) {
    const g = GRAINS[i % GRAINS.length];
    out.push({ x, y: waveY(x, y, amp) + g.off, r: g.r, i });
  }
  return out;
}

export function FlowLoader({ label = "One moment…", instant = false }: { label?: string; /** Show at once. By default it waits a moment, so quick loads never flash it. */ instant?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pp-flow-stage fixed inset-0 z-50 grid place-items-center bg-page"
      style={instant ? { animationDelay: "0s" } : undefined}
    >
      <div className="grid justify-items-center gap-6">
        <svg
          viewBox="0 0 800 200"
          width="800"
          height="200"
          aria-hidden
          className="h-auto w-[min(90vw,52rem)] overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]"
        >
          {RIBBONS.map((r, i) => (
            <g
              key={i}
              style={{
                animation: `pp-flow ${r.secs}s linear ${r.delay}s infinite`,
                ["--pp-shift" as string]: `${-2 * HALF}px`,
              }}
            >
              <path
                d={wave(r.y, r.amp)}
                fill="none"
                stroke={r.color}
                strokeWidth={r.width}
                strokeLinecap="round"
                opacity={0.9}
              />
              {grains(r.y, r.amp).map((g) => (
                <circle
                  key={g.i}
                  cx={g.x}
                  cy={g.y}
                  r={g.r}
                  fill={r.dots}
                  className="pp-grain"
                  style={{ animationDelay: `${-(g.i % 4) * 0.45}s` }}
                />
              ))}
            </g>
          ))}
        </svg>
        <p className="m-0 font-display text-2xl">{label}</p>
      </div>
    </div>
  );
}
