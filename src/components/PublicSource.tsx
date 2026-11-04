import type { FormEvent } from "react";
import { BeehiivLogo } from "./BeehiivLogo";

/** The "Public newsletter" source card's text, shared by the demo and the app so they look the same. */
export function PublicSourceBody() {
  return <span className="leading-relaxed">Paste a link to a public post, then highlight the parts you want to share.</span>;
}

const logoChip = "flex h-9 items-center rounded-xl bg-surface px-3 ring-1 ring-ink/10";

/** The row of platform logos along the bottom of a source card. */
export function SourceLogos({ substack = false, more }: { substack?: boolean; more?: string }) {
  return (
    <span className="mt-auto flex flex-wrap items-center gap-2 pt-1" aria-label={substack ? "Works with beehiiv and Substack" : "beehiiv"}>
      <span className={logoChip}>
        <BeehiivLogo className="h-4 w-auto" />
      </span>
      {substack && (
        <span className={logoChip}>
          {/* max-w-none: the global img max-width of 100% lets a shrinking flex item squeeze the logo to nothing. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/substack-logo.png" alt="Substack" width={600} height={103} className="h-4 w-auto max-w-none" />
        </span>
      )}
      {more && <span className="text-sm font-semibold">{more}</span>}
    </span>
  );
}

/** The link field and its "Get content" button, shown under the source cards when the public newsletter is selected. */
export function PublicLinkForm({
  value,
  onChange,
  onSubmit,
  busy,
  error,
  note = "Only public posts work. Nothing is stored: the page is read once and shown here for you to highlight.",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  busy: boolean;
  error: string | null;
  note?: string;
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 max-w-2xl">
      <label htmlFor="source-url" className="mb-2 block font-bold">
        Link to the post
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="source-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
          className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-surface px-4 py-3 text-base outline-none focus-visible:shadow-[0_0_0_3px_var(--color-ink)]"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-ink px-6 py-3 font-bold text-cream hover:bg-ink-deep disabled:opacity-60"
        >
          {busy ? "Getting…" : "Get content"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mb-0 mt-3 border-l-4 border-coral pl-3 text-sm font-semibold">
          {error}
        </p>
      )}
      <p className="mb-0 mt-3 text-sm">{note}</p>
    </form>
  );
}
