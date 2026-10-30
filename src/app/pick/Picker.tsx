"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Chunk = {
  id: number;
  section: string;
  group?: string;
  kind: "bullet" | "paragraph";
  title: string;
  body: string;
  text: string;
  rank: number | null;
  score: number | null;
};

const MAX = 20;
type View = "top" | "section" | "all";

export function Picker({ mode, chunks, hasClicks }: { mode: string; chunks: Chunk[]; hasClicks: boolean }) {
  const [view, setView] = useState<View>(hasClicks ? "top" : "section");
  const sections = useMemo(() => [...new Set(chunks.map((c) => c.section))], [chunks]);
  // Default to the section with the most ranked items (the activity list).
  const [section, setSection] = useState(() => {
    const counts = new Map<string, number>();
    for (const c of chunks) if (c.rank) counts.set(c.section, (counts.get(c.section) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? sections[0];
  });
  const [picked, setPicked] = useState<number[]>([]);

  const visible = useMemo(() => {
    if (view === "top") return chunks.filter((c) => c.rank).sort((a, b) => a.rank! - b.rank!);
    if (view === "section") return chunks.filter((c) => c.section === section);
    return chunks;
  }, [view, section, chunks]);

  const full = picked.length >= MAX;
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id]));
  const selectTop = (n: number) => setPicked(chunks.filter((c) => c.rank && c.rank <= n).sort((a, b) => a.rank! - b.rank!).map((c) => c.id));

  const tabs: { id: View; label: string; hint: string; disabled?: boolean }[] = [
    { id: "top", label: "Top clicks", hint: "Ranked by reader clicks", disabled: !hasClicks },
    { id: "section", label: "Section", hint: "One part of the issue" },
    { id: "all", label: "All content", hint: "Every paragraph and bullet" },
  ];

  // Section / group labels are shown where they change from the previous visible item.
  const labels = useMemo(
    () =>
      visible.map((c, i) => {
        const prev = visible[i - 1];
        return {
          heading: view === "all" && c.section !== prev?.section ? c.section : null,
          group: view !== "top" && c.group && c.group !== prev?.group ? c.group : null,
        };
      }),
    [visible, view],
  );

  return (
    <>
      <div role="tablist" aria-label="How to choose" className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface p-1.5 ring-1 ring-ink/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={view === t.id}
            disabled={t.disabled}
            onClick={() => setView(t.id)}
            title={t.disabled ? "Needs the newsletter's Beehiiv key" : t.hint}
            className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              view === t.id ? "bg-accent text-ink-deep shadow-sm" : "hover:bg-card disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "section" && (
        <label className="mb-4 flex flex-wrap items-center gap-3 text-sm font-semibold">
          Section
          <select value={section} onChange={(e) => setSection(e.target.value)} className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2 ring-1 ring-ink/20">
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}

      {view === "top" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Quick select:</span>
          {[3, 5, 10].map((n) => (
            <button key={n} onClick={() => selectTop(n)} className="rounded-full bg-card px-3 py-1 font-bold hover:brightness-95">
              Top {n}
            </button>
          ))}
          <span className="ml-auto text-xs">Upcoming events only</span>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {visible.map((c, i) => {
          const idx = picked.indexOf(c.id);
          const on = idx >= 0;
          const disabled = !on && full;
          const { heading, group: grp } = labels[i];
          return (
            <li key={c.id} className="contents">
              {heading && <p className="mt-4 text-xs font-bold uppercase tracking-wide text-ink/70">{heading}</p>}
              {grp && <p className="mt-2 w-fit rounded-full bg-chip px-2.5 py-0.5 text-xs font-bold text-ink-deep">{grp}</p>}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 transition ${
                  on ? "bg-accent/40 ring-2 ring-ink" : "bg-surface ring-ink/10 hover:ring-ink/30"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(c.id)} className="sr-only" />
                <span
                  aria-hidden
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${on ? "bg-ink text-cream" : "border-2 border-ink/30"}`}
                >
                  {on ? idx + 1 : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-x-2">
                    {view === "top" && c.rank && <span className="shrink-0 font-display text-ink/60">#{c.rank}</span>}
                    <span className="font-bold">{c.kind === "paragraph" && !c.body ? clamp(c.text, 160) : c.title}</span>
                  </span>
                  {c.body && <span className="mt-0.5 block text-sm leading-relaxed">{clamp(c.body, 140)}</span>}
                  {view === "top" && c.score != null && <span className="mt-1 block text-xs font-semibold text-ink/70">{c.score} unique clicks</span>}
                </span>
              </label>
            </li>
          );
        })}
        {visible.length === 0 && <li className="rounded-2xl bg-surface p-6 text-center">Nothing to show here.</li>}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
          <p className="flex-1 text-sm font-semibold" aria-live="polite">
            {picked.length === 0 ? "Select 1 to 20 items" : `${picked.length} of ${MAX} selected`}
            {full && <span className="ml-2 font-normal">Maximum reached</span>}
          </p>
          {picked.length > 0 && (
            <button onClick={() => setPicked([])} className="text-sm font-semibold underline underline-offset-4">
              Clear
            </button>
          )}
          {picked.length === 0 ? (
            <span aria-disabled className="rounded-xl bg-ink/15 px-5 py-3 font-bold text-ink/50">
              Create posts
            </span>
          ) : (
            <Link href={`/create?mode=${mode}&picks=${picked.join(",")}`} className="rounded-xl bg-ink px-5 py-3 font-bold text-cream hover:bg-ink-deep">
              Create {picked.length} {picked.length === 1 ? "pick" : "picks"}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
