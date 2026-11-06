"use client";

import { useState, type ReactNode } from "react";
import { STOCK_IMAGES } from "@/lib/slides/stock";
import { sized } from "@/lib/cdn";

/** A post's preview image, or the standard placeholder (plain gray with the Pollen Picks mark) when it has none or fails to load. */
function Thumb({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img aria-hidden src={STOCK_IMAGES[0].src} alt="" width={80} height={56} className="h-14 w-20 shrink-0 rounded-lg object-cover" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={sized(url, 240)} alt="" width={80} height={56} loading="lazy" onError={() => setFailed(true)} className="h-14 w-20 shrink-0 rounded-lg bg-ink/5 object-cover" />
  );
}

/**
 * One post in the "Choose a post" list: the pasted link, an issue of the newsletter, or the demo issue. All rows share one radio group
 * (`name="post"`), so choosing one unchooses the rest. Without `onChange` the row is a fixed, already-chosen display.
 */
export function IssueRow({
  title,
  detail,
  image,
  badge,
  checked = true,
  onChange,
  value,
}: {
  title: string;
  detail: ReactNode;
  image?: string | null;
  badge?: string;
  checked?: boolean;
  onChange?: () => void;
  value?: string;
}) {
  return (
    <label
      className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-xl bg-surface px-3 py-3 ring-1 ring-ink/10 outline-offset-2 sm:px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${checked ? "shadow-[0_0_0_3px_var(--color-ink)]" : "hover:ring-ink/40"}`}
    >
      <input type="radio" name="post" value={value} checked={checked} onChange={onChange ?? (() => {})} readOnly={!onChange} className="size-4 shrink-0 accent-ink" />
      <Thumb url={image} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="flex items-center gap-2 text-sm">
          <span className="min-w-0 truncate">{detail}</span>
          {badge && <span className="shrink-0 rounded-full bg-honey px-2.5 py-0.5 text-xs font-bold text-ink-deep">{badge}</span>}
        </span>
      </span>
    </label>
  );
}
