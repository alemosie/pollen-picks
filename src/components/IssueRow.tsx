"use client";

import { useState, type ReactNode } from "react";
import { BeehiivMark } from "./BeehiivLogo";
import { sized } from "@/lib/cdn";

/** A post's preview image, or a quiet placeholder when it has none or fails to load. */
function Thumb({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false);
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

/** One chosen post, in the same style as a row of the issue list on the signed-in source step. */
export function IssueRow({ title, detail, image, badge }: { title: string; detail: ReactNode; image?: string | null; badge?: string }) {
  return (
    <label className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-ink/10 shadow-[0_0_0_3px_var(--color-ink)]">
      <input type="radio" checked readOnly name="post" className="size-4 shrink-0 accent-ink" />
      <Thumb url={image} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="block truncate text-sm">{detail}</span>
      </span>
      {badge && <span className="shrink-0 rounded-full bg-honey px-2.5 py-0.5 text-xs font-bold text-ink-deep">{badge}</span>}
    </label>
  );
}
