/** Top strip on every public demo page: it's a sample, and nothing is sent to Buffer. */
export function DemoBanner() {
  return (
    <div className="bg-accent">
      <p className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-2 text-sm font-semibold">
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-cream">Demo</span>
        Nothing here is sent to real social channels, so feel free to play around.
      </p>
    </div>
  );
}
