/** A title word with the hand-drawn wavy underline from the home page hero. */
export function StepWord({ children }: { children: string }) {
  return (
    <span className="relative inline-block">
      {children}
      <svg
        aria-hidden
        viewBox="0 0 220 24"
        preserveAspectRatio="none"
        className="pp-wipe absolute -bottom-2 left-0 h-3 w-full overflow-visible"
      >
        <path
          d="M3 14 C 40 3 70 22 110 12 S 180 4 217 13"
          fill="none"
          stroke="#f28482"
          strokeWidth="6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
