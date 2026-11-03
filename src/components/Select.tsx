import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

/**
 * A native select with our own chevron. The browser's built-in arrow sits hard against the right edge, so the arrow is
 * drawn here with room around it, and long option text is kept clear of it.
 */
export function Select({
  className = "",
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <span className="relative block min-w-0">
      <select
        {...props}
        className={`w-full appearance-none rounded-xl bg-surface py-2 pl-3 pr-11 ring-1 ring-ink/20 ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        strokeWidth={2.5}
        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2"
      />
    </span>
  );
}
