"use client";

import { useState, type ReactNode } from "react";
import { BeehiivMark } from "./BeehiivLogo";
import { sized } from "@/lib/cdn";

/** A post's preview image, or a quiet placeholder when it has none or fails to load. */
function Thumb({ url, puff = false }: { url?: string | null; puff?: boolean }) {
  const [failed, setFailed] = useState(false);
  if ((!url || failed) && puff) {
    return (
      <span aria-hidden className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-honey/40">
        {[
          ["12%", "20%", 12, "#f6bd60"],
          ["46%", "58%", 9, "#f28482"],
          ["70%", "18%", 7, "#f5cac3"],
          ["78%", "64%", 11, "#f6bd60"],
          ["24%", "70%", 6, "#fff8ee"],
        ].map(([l, t, d, c], i) => (
          <span key={i} className="absolute rounded-full" style={{ left: l as string, top: t as string, width: d as number, height: d as number, background: c as string }} />
        ))}
      </span>
    );
  }
  if (!url || failed) {
    return (
      <span aria-hidden className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-ink/5">
        <BeehiivMark className="h-5 w-auto text-ink/30" />
      </span>
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
  puff = false,
}: {
  title: string;
  detail: ReactNode;
  image?: string | null;
  badge?: string;
  checked?: boolean;
  onChange?: () => void;
  value?: string;
  /** Without an image, show a few grains of pollen instead of the beehiiv mark (for a post that is not from beehiiv). */
  puff?: boolean;
}) {
  return (
    <label
      className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-xl bg-surface px-3 py-3 ring-1 ring-ink/10 outline-offset-2 sm:px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${checked ? "shadow-[0_0_0_3px_var(--color-ink)]" : "hover:ring-ink/40"}`}
    >
      <input type="radio" name="post" value={value} checked={checked} onChange={onChange ?? (() => {})} readOnly={!onChange} className="size-4 shrink-0 accent-ink" />
      <Thumb url={image} puff={puff} />
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
