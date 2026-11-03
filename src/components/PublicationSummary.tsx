"use client";

import { useState } from "react";
import { CalendarDays, MailOpen, MousePointerClick, Users, type LucideIcon } from "lucide-react";
import type { BeehiivPublication } from "@/lib/beehiiv";
import { sized } from "@/lib/cdn";

const fmt = new Intl.NumberFormat("en");
const since = (unix: number) => new Date(unix * 1000).toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });

/**
 * What we know about a connected publication. The avatar is the publication's logo when beehiiv gives one, else its initial.
 * `avatar` is the background class, so it stays visible on whatever card it sits on.
 * `compact` shows each stat as an icon and a value, with its name on hover or focus (used inside the mode card).
 */
export function PublicationSummary({ publication: p, avatar = "bg-honey", compact = false }: { publication: BeehiivPublication; avatar?: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar publication={p} className={avatar} />
      <div className="min-w-0">
        <p className={`m-0 truncate font-display ${compact ? "text-2xl" : "text-xl"}`}>{p.name}</p>
        {p.organization && <p className="m-0 truncate text-sm">{p.organization}</p>}
        {compact ? (
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm font-semibold">
            {p.subscribers !== undefined && <Stat icon={Users} value={fmt.format(p.subscribers)} label={`${fmt.format(p.subscribers)} subscribers`} />}
            {p.openRate !== undefined && <Stat icon={MailOpen} value={`${p.openRate}%`} label={`${p.openRate}% open rate`} />}
            {p.clickRate !== undefined && <Stat icon={MousePointerClick} value={`${p.clickRate}%`} label={`${p.clickRate}% click rate`} />}
            {p.created !== undefined && <Stat icon={CalendarDays} value={since(p.created)} label={`Since ${since(p.created)}`} />}
          </ul>
        ) : (
          <p className="m-0 mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm font-semibold">
            {p.subscribers !== undefined && <span>{fmt.format(p.subscribers)} subscribers</span>}
            {p.openRate !== undefined && <span>{p.openRate}% open rate</span>}
            {p.clickRate !== undefined && <span>{p.clickRate}% click rate</span>}
            {p.created !== undefined && <span>Since {since(p.created)}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

/** One icon + value; the full label shows as a tooltip on hover or keyboard focus and is read out by screen readers. */
function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <li className="group relative">
      <span tabIndex={0} aria-label={label} className="inline-flex items-center gap-1.5 rounded outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink">
        <Icon aria-hidden className="size-4" strokeWidth={2.2} />
        {value}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-cream opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </li>
  );
}

function Avatar({ publication: p, className }: { publication: BeehiivPublication; className: string }) {
  const [failed, setFailed] = useState(false);
  if (p.logo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={sized(p.logo, 112)} alt="" width={56} height={56} onError={() => setFailed(true)} className="size-14 shrink-0 rounded-2xl bg-surface object-cover" />
    );
  }
  return (
    <span aria-hidden className={`grid size-14 shrink-0 place-items-center rounded-2xl font-display text-2xl text-ink-deep ${className}`}>
      {p.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
