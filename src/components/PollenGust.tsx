import { gustGrains } from "@/lib/gust";

const GRAINS = gustGrains(64, 1.25);

/** A frozen frame of the step loader's pollen gust: pollen blowing in from the left, around one loop and out to the right. Decoration only. */
export function PollenGust({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="-60 -30 920 230"
      aria-hidden
      focusable="false"
      className={`h-auto w-full overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)] ${className}`}
    >
      {GRAINS.map((g, i) => (
        <circle key={i} cx={g.x} cy={g.y} r={g.r} fill={g.color} opacity="0.9" />
      ))}
    </svg>
  );
}
