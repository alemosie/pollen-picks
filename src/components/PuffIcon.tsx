/** A small dandelion puff: the product's own mark for "picked", a cousin of the splash page's pollen burst. */
const SPOKES = 8;

export function PuffIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      {Array.from({ length: SPOKES }, (_, i) => {
        const a = (i / SPOKES) * Math.PI * 2 - Math.PI / 2;
        const at = (r: number) => [+(12 + Math.cos(a) * r).toFixed(2), +(12 + Math.sin(a) * r).toFixed(2)];
        const [x1, y1] = at(3.6);
        const [x2, y2] = at(7.4);
        const [cx, cy] = at(9.7);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <circle cx={cx} cy={cy} r="1.5" fill="currentColor" stroke="none" />
          </g>
        );
      })}
    </svg>
  );
}
