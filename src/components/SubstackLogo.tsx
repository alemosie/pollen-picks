type Props = { className?: string; title?: string };

/**
 * Substack's mark (the bookmark with three bars), path from simple-icons (CC0-1.0). Single color: inherits `currentColor`.
 * Check Substack's brand guidelines before using it beyond a "works with" mention.
 */
export function SubstackMark({ className = "h-5 w-auto", title = "Substack" }: Props) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} fill="currentColor" className={className}>
      <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
    </svg>
  );
}

/** Mark + the word. The word is hidden on small screens, where space is tight. */
export function SubstackLogo({ className = "h-5 w-auto" }: { className?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <SubstackMark className={className} />
      <span aria-hidden className="hidden font-display text-base leading-none sm:inline">
        Substack
      </span>
    </span>
  );
}
