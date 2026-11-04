"use client";

import Link from "next/link";
import { BeehiivConnect, type BeehiivState } from "@/components/BeehiivConnect";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { PublicationSummary } from "@/components/PublicationSummary";
import { ResumeBanner } from "@/components/ResumeBanner";
import type { BeehiivIssue } from "@/lib/beehiiv";
import { ownMode, stepUrl } from "@/lib/flow";
import { clearProgress } from "@/lib/progress";
import { Check } from "lucide-react";
import { Select } from "@/components/Select";
import { useState } from "react";
import { IssueList } from "./IssueList";

type Mode = { id: "public" | "own"; title: string; tag: string; body: string; tone: string; href?: string; cta: string };

const MODES: Mode[] = [
  {
    id: "own",
    title: "Your newsletter",
    tag: "Pick your own content",
    body: "Connect your Beehiiv API key to share your own content. Unlock top-click ranking and every issue in your archive.",
    tone: "bg-accent",
    cta: "Coming soon",
  },
  {
    id: "public",
    title: "Public newsletter",
    tag: "Pick any content",
    body: "Paste any beehiiv newsletter URL and pick content and links from its latest issue.",
    tone: "bg-card",
    cta: "Coming soon",
  },
];

export type InitialIssues = { publicationId: string; issues: BeehiivIssue[]; page: number; totalPages: number } | null;

const radioDot = (
  <span
    aria-hidden
    className="absolute right-5 top-5 grid size-6 place-items-center rounded-full border-2 border-ink/40 peer-checked:border-ink peer-checked:bg-ink peer-checked:[&>span]:opacity-100"
  >
    <span className="size-2 rounded-full bg-cream opacity-0" />
  </span>
);
const cardBase =
  "relative flex cursor-pointer flex-col gap-4 rounded-2xl p-6 outline-offset-4 transition-shadow has-[:checked]:shadow-[0_0_0_3px_var(--color-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink";

/**
 * Pick where the content comes from. With a beehiiv key on record, "Your newsletter" shows the connected publication
 * and, once chosen, a list of its sent issues (five a page). Without one, it asks for the key.
 */
export function ModePicker({ beehiiv: initialBeehiiv, initialIssues, initialIssuesError }: { beehiiv: BeehiivState; initialIssues: InitialIssues; initialIssuesError: string | null }) {
  const [mode, setMode] = useState<Mode["id"]>("own");
  const [beehiiv, setBeehiiv] = useState<BeehiivState>(initialBeehiiv);
  const [publicationId, setPublicationId] = useState<string | null>(initialIssues?.publicationId ?? initialBeehiiv?.publications[0]?.id ?? null);
  const [issues, setIssues] = useState<BeehiivIssue[] | null>(initialIssues?.issues ?? null);
  const [page, setPage] = useState(initialIssues?.page ?? 1);
  const [totalPages, setTotalPages] = useState(initialIssues?.totalPages ?? 1);
  const [issuesError, setIssuesError] = useState<string | null>(initialIssuesError);
  const [loading, setLoading] = useState(false);
  // The newest issue is chosen until the user picks another. It stays chosen while they page through older ones.
  const [chosen, setChosen] = useState<BeehiivIssue | null>(initialIssues?.issues[0] ?? null);

  /** `resetChoice`: choose the newest issue of what loads (first load, new publication). Paging keeps the choice. */
  async function loadIssues(pub: string, nextPage = 1, resetChoice = true) {
    setLoading(true);
    setIssuesError(null);
    setPage(nextPage);
    try {
      const res = await fetch(`/api/beehiiv/issues?publication=${encodeURIComponent(pub)}&page=${nextPage}`);
      const data = (await res.json().catch(() => ({}))) as { error?: string; publicationId?: string; issues?: BeehiivIssue[]; page?: number; totalPages?: number };
      if (!res.ok || !data.issues) {
        setIssues(null);
        setIssuesError(res.status === 401 ? "Your login has expired. Log in again to see your issues." : (data.error ?? "Couldn't load your issues. Try again in a moment."));
      } else {
        setPublicationId(data.publicationId ?? pub);
        setIssues(data.issues);
        setPage(data.page ?? nextPage);
        setTotalPages(data.totalPages ?? 1);
        if (resetChoice) setChosen(data.issues[0] ?? null);
      }
    } catch {
      setIssues(null);
      setIssuesError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function onBeehiivChange(next: BeehiivState) {
    setBeehiiv(next);
    const first = next?.publications[0]?.id ?? null;
    setPublicationId(first);
    setIssues(null);
    setIssuesError(null);
    setChosen(null);
    setPage(1);
    setTotalPages(1);
    if (first) void loadIssues(first);
  }

  const publication = beehiiv ? (beehiiv.publications.find((p) => p.id === publicationId) ?? beehiiv.publications[0]) : undefined;

  // "Your newsletter" is ready once a key is saved and an issue is chosen; until then the button says what is missing.
  const base = MODES.find((m) => m.id === mode)!;
  let selected: Mode = base;
  if (mode === "own") {
    if (!beehiiv) selected = { ...base, cta: "Connect beehiiv to continue" };
    else if (publicationId && chosen) selected = { ...base, href: stepUrl(ownMode(publicationId, chosen.id), "pick"), cta: "Pick" };
    else selected = { ...base, cta: loading ? "Loading your issues…" : "Choose an issue to continue" };
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Newsletter source" className="grid gap-5 md:grid-cols-2">
        {publication ? (
          // A publication is on record: the mode itself shows it.
          <label className={`${cardBase} bg-accent`}>
            <input type="radio" name="mode" value="own" checked={mode === "own"} onChange={() => setMode("own")} className="peer sr-only" />
            {radioDot}
            <span className="flex flex-wrap items-center gap-2 pr-8">
              <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold">Your newsletter</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-cream">
                <Check aria-hidden className="size-3" strokeWidth={3} /> Connected to beehiiv
              </span>
            </span>
            <PublicationSummary publication={publication} avatar="bg-surface" compact />
            <span className="text-sm">
              Key ending <span className="font-mono font-bold">{beehiiv?.last4}</span> is saved.{" "}
              <Link href="/settings" className="font-bold underline underline-offset-4">
                Manage in Settings
              </Link>
            </span>
          </label>
        ) : (
          <label className={`${cardBase} ${MODES[0].tone}`}>
            <input type="radio" name="mode" value="own" checked={mode === "own"} onChange={() => setMode("own")} className="peer sr-only" />
            {radioDot}
            <span className="w-fit rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold">{MODES[0].tag}</span>
            <span className="font-display text-2xl">{MODES[0].title}</span>
            <span className="leading-relaxed">{MODES[0].body}</span>
          </label>
        )}
        <label className={`${cardBase} ${MODES[1].tone}`}>
          <input type="radio" name="mode" value="public" checked={mode === "public"} onChange={() => setMode("public")} className="peer sr-only" />
          {radioDot}
          <span className="w-fit rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold">{MODES[1].tag}</span>
          <span className="font-display text-2xl">{MODES[1].title}</span>
          <span className="leading-relaxed">{MODES[1].body}</span>
        </label>
      </div>

      {mode === "own" && !beehiiv && (
        <section aria-labelledby="own-setup" className="mt-6 rounded-2xl bg-card p-6">
          <h2 id="own-setup" className="mb-4 text-2xl">
            Connect your newsletter
          </h2>
          <BeehiivConnect initial={null} onChange={onBeehiivChange} settingsLink />
        </section>
      )}

      {mode === "own" && beehiiv && (
        <section aria-label="Your issues" className="mt-8">
          {beehiiv.publications.length > 1 && (
            <div className="mb-5">
              <label htmlFor="publication" className="mb-2 block font-bold">
                Publication
              </label>
              <Select
                id="publication"
                value={publicationId ?? ""}
                onChange={(e) => {
                  setPublicationId(e.target.value);
                  void loadIssues(e.target.value);
                }}
                className="py-3 pl-4"
              >
                {beehiiv.publications.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <IssueList
            issues={issues}
            page={page}
            totalPages={totalPages}
            chosen={chosen}
            onSelect={setChosen}
            onPage={(n) => publicationId && void loadIssues(publicationId, n, false)}
            loading={loading}
            error={issuesError}
            onRetry={() => publicationId && void loadIssues(publicationId, page, chosen === null)}
          />
        </section>
      )}

      <FlowBar next={selected.href ? { href: selected.href, onNavigate: clearProgress } : null} status={<ResumeBanner inline />}>
        {selected.href ? (
          <Link href={selected.href} onClick={clearProgress} className={`inline-flex items-center gap-2 ${primaryButton}`}>
            {selected.cta}
            <Arrow />
          </Link>
        ) : (
          <span aria-disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border-2 border-dashed border-cream/40 px-6 py-3 font-semibold text-cream/60">
            {selected.cta}
          </span>
        )}
      </FlowBar>
    </div>
  );
}

function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h13M11 4l6 6-6 6" />
    </svg>
  );
}
