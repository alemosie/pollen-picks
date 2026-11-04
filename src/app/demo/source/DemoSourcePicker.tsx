"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { ResumeBanner } from "@/components/ResumeBanner";
import { clearProgress } from "@/lib/progress";
import { clearDemoRows } from "@/lib/pollen/demoHighlights";
import { clearDemoSource, writeDemoSource } from "@/lib/pollen/demoSource";
import { stepUrl } from "@/lib/flow";

type Source = { id: string; title: string; tag: string; badge?: string; body: ReactNode; tone: string; href?: string; link?: string };

// Same cards as the signed-in source step (see app/source/ModePicker). The demo issue opens its parsed picker; the link
// cards read one public page (Manual tab only: select text, press Pick).
const radioDot = (
  <span
    aria-hidden
    className="absolute right-5 top-5 grid size-6 place-items-center rounded-full border-2 border-ink/40 peer-checked:border-ink peer-checked:bg-ink peer-checked:[&>span]:opacity-100"
  >
    <span className="size-2 rounded-full bg-cream opacity-0" />
  </span>
);
const cardBase =
  "relative flex flex-col gap-4 rounded-2xl p-6 outline-offset-4 transition-shadow has-[:checked]:shadow-[0_0_0_3px_var(--color-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink";

// Starting a demo erases whatever was in progress, including earlier highlights.
function startFresh() {
  clearProgress();
  clearDemoRows();
  clearDemoSource();
}

export function DemoSourcePicker({ sources }: { sources: Source[] }) {
  const [chosen, setChosen] = useState(sources[0].id);
  const selected = sources.find((s) => s.id === chosen)!;
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openLink(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const address = url.trim();
    if (!address) return setError("Paste a link to a public post first.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/demo/source?url=${encodeURIComponent(address)}`);
      const data = (await res.json().catch(() => ({}))) as { error?: string; title?: string; site?: string | null; url?: string };
      if (!res.ok) return setError(data.error ?? "Couldn't read that page.");
      startFresh();
      const title = data.title || "A newsletter post";
      const host = (() => { try { return new URL(data.url ?? address).hostname.replace(/^www\./, ""); } catch { return ""; } })();
      if (!writeDemoSource({ url: data.url ?? address, title, newsletter: data.site || host || title }))
        return setError("That link is too long for the demo. Try a shorter one.");
      router.push(`${stepUrl("demo", "pick")}?picking=manual`);
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Newsletter source" className="grid gap-5 md:grid-cols-2">
        {sources.map((s) => {
          const ready = Boolean(s.href || s.link);
          return (
            <label key={s.id} className={`${cardBase} ${s.tone} ${ready ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}>
              <input
                type="radio"
                name="source"
                value={s.id}
                checked={chosen === s.id}
                disabled={!ready}
                onChange={() => setChosen(s.id)}
                className="peer sr-only"
              />
              {ready && radioDot}
              <span className="flex flex-wrap items-center gap-2 pr-8">
                <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold">{s.tag}</span>
                {s.badge && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-cream">{s.badge}</span>}
                {!ready && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-cream">Coming soon</span>}
              </span>
              <span className="font-display text-2xl">{s.title}</span>
              <span className="leading-relaxed">{s.body}</span>
            </label>
          );
        })}
      </div>

      {selected.link && (
        <form onSubmit={openLink} noValidate className="mt-6 max-w-2xl">
          <label htmlFor="source-url" className="mb-2 block font-bold">
            Link to the post
          </label>
          <div className="flex flex-wrap gap-3">
            <input
              id="source-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={selected.link}
              className="min-w-0 flex-1 rounded-xl border-2 border-ink/30 bg-card px-4 py-3 text-base"
            />
          </div>
          {error && (
            <p role="alert" className="mb-0 mt-3 border-l-4 border-coral pl-3 text-sm font-semibold">
              {error}
            </p>
          )}
          <p className="mb-0 mt-3 text-sm">
            Only public posts work. Nothing is stored: the page is read once and shown here for you to highlight.
          </p>
        </form>
      )}

      <FlowBar
        next={selected.href ? { href: selected.href, onNavigate: startFresh } : null}
        status={<ResumeBanner inline />}
      >
        {selected.link && (
          <button type="button" onClick={openLink} disabled={busy} className={`inline-flex items-center gap-2 ${primaryButton} disabled:opacity-60`}>
            {busy ? "Reading…" : "Open"}
          </button>
        )}
        {selected.href && (
          <Link
            href={selected.href}
            onClick={startFresh}
            className={`inline-flex items-center gap-2 ${primaryButton}`}>
            Pick
            <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10h13M11 4l6 6-6 6" />
            </svg>
          </Link>
        )}
      </FlowBar>
    </div>
  );
}
