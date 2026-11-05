"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useTransition, type ReactNode } from "react";
import { PollenSpinner } from "@/components/PollenSpinner";
import { STATUS_GROUPS, filtersToQuery, hasFilters, parseFilters, type HistoryFacets, type HistoryFilters } from "@/lib/historyFilters";

const label = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const NETWORK_NAMES: Record<string, string> = { linkedin: "LinkedIn", twitter: "X", x: "X", tiktok: "TikTok", youtube: "YouTube", googlebusiness: "Google Business" };
const network = (s: string) => NETWORK_NAMES[s] ?? label(s);

// appearance-none plus our own caret, so there is room to the right of the arrow (the native one sits hard against the edge).
const SELECT = "w-full min-w-0 appearance-none rounded-xl bg-surface py-2 pl-4 pr-10 text-sm font-semibold ring-1 ring-ink/15 hover:ring-ink/40 focus-visible:ring-2";

function Caret({ children }: { children: ReactNode }) {
  return (
    <span className="relative block">
      {children}
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2" strokeWidth={2.5} />
    </span>
  );
}

/** Filters for the History page: network, channel, status and draft/now. They live in the URL, so the server does the narrowing. */
export function HistoryFilterBar({ facets }: { facets: HistoryFacets }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const f = parseFilters((k) => params.get(k));

  const go = (next: HistoryFilters) => {
    // A channel belongs to one network: drop it if the network changes to another.
    if (next.channelId && next.service) {
      const c = facets.channels.find((x) => x.id === next.channelId);
      if (c && c.service !== next.service) delete next.channelId;
    }
    const q = filtersToQuery(next);
    start(() => router.replace(q ? `${path}?${q}` : path, { scroll: false }));
  };
  const set = <K extends keyof HistoryFilters>(key: K, value: string) => go({ ...f, [key]: value === "" ? undefined : value });

  const channels = facets.channels.filter((c) => !f.service || c.service === f.service);

  return (
    <div role="group" aria-label="Filter history" className="mb-4 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs font-bold">
        Network
        <Caret>
        <select value={f.service ?? ""} onChange={(e) => set("service", e.target.value)} className={SELECT}>
          <option value="">All networks</option>
          {facets.services.map((s) => (
            <option key={s} value={s}>
              {network(s)}
            </option>
          ))}
        </select>
        </Caret>
      </label>
      <label className="grid gap-1 text-xs font-bold">
        Channel
        <Caret>
        <select value={f.channelId ?? ""} onChange={(e) => set("channelId", e.target.value)} className={`${SELECT} max-w-[14rem]`}>
          <option value="">All channels</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        </Caret>
      </label>
      <label className="grid gap-1 text-xs font-bold">
        Status
        <Caret>
        <select value={f.status ?? ""} onChange={(e) => set("status", e.target.value)} className={SELECT}>
          <option value="">Any status</option>
          {Object.entries(STATUS_GROUPS).map(([k, g]) => (
            <option key={k} value={k}>
              {g.label}
            </option>
          ))}
        </select>
        </Caret>
      </label>
      <label className="grid gap-1 text-xs font-bold">
        Type
        <Caret>
        <select value={f.mode ?? ""} onChange={(e) => set("mode", e.target.value)} className={SELECT}>
          <option value="">Drafts and posts</option>
          <option value="draft">Drafts</option>
          <option value="now">Posted now</option>
        </select>
        </Caret>
      </label>
      {hasFilters(f) && (
        <button type="button" onClick={() => go({})} className="rounded-xl px-3 py-2 text-sm font-bold underline underline-offset-4">
          Clear filters
        </button>
      )}
      {pending && (
        <span role="status" className="flex items-center gap-2 pb-2 text-xs font-semibold">
          <PollenSpinner className="size-4" />
          Filtering…
        </span>
      )}
    </div>
  );
}
