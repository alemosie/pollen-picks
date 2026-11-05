// The small loading circle: a ring of pollen grains in the brand colours that turns, with the tail fading out like a gust.
// Pure SVG + CSS, so it works anywhere (buttons, table rows, a Suspense fallback). With reduced motion it holds still.

const COLORS = ["var(--color-honey)", "var(--color-coral)", "var(--color-sage)", "var(--color-honey)", "var(--color-coral)", "var(--color-ink)"];
// Eight grains round a ring in a 24 x 24 box. Size and opacity taper from the head (first grain) to the tail.
const GRAINS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  return { x: 12 + 8.5 * Math.cos(a), y: 12 + 8.5 * Math.sin(a), r: 2.6 - i * 0.22, o: 1 - i * 0.1, c: COLORS[i % COLORS.length] };
});

export function PollenSpinner({ className = "size-5", label }: { className?: string; /** Read out by screen readers. Leave out when nearby text already says what is loading. */ label?: string }) {
  return (
    <span role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`inline-grid shrink-0 place-items-center ${className}`}>
      <svg viewBox="0 0 24 24" className="pp-pollen-spinner size-full overflow-visible" aria-hidden>
        {GRAINS.map((g, i) => (
          <circle key={i} cx={g.x} cy={g.y} r={Math.max(g.r, 1)} fill={g.c} opacity={g.o} />
        ))}
      </svg>
    </span>
  );
}
