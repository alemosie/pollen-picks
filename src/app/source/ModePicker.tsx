"use client";

import Link from "next/link";
import { BeehiivConnect, type BeehiivState } from "@/components/BeehiivConnect";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { IssueRow } from "@/components/IssueRow";
import { PublicLinkForm, SourceLogos } from "@/components/PublicSource";
import { PublicationSummary } from "@/components/PublicationSummary";
import { ResumeBanner } from "@/components/ResumeBanner";
import type { BeehiivIssue } from "@/lib/beehiiv";
import { ownMode, stepUrl } from "@/lib/flow";
import { startFreshRun } from "@/lib/progress";
import { Check } from "lucide-react";
import { Select } from "@/components/Select";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { IssueList } from "./IssueList";

type Mode = { id: "public" | "own"; title: string; tone: string; href?: string; cta: string };

const MODES: Mode[] = [
  {
    id: "own",
    title: "Your newsletter",
    tone: "bg-accent",
    cta: "Coming soon",
  },
  {
    id: "public",
    title: "Public link",
    tone: "bg-card",
    cta: "Coming soon",
  },
];

type LinkedPost = { mode: string; url: string; title: string; site: string | null; author: string | null; publishedAt: string | null; image: string | null };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

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
  "relative flex cursor-pointer flex-col gap-4 rounded-2xl p-6 outline-none transition-shadow has-[:checked]:shadow-[0_0_0_2px_var(--color-ink)] has-[input[type=radio]:focus-visible]:shadow-[0_0_0_2px_var(--color-ink)]";

/**
 * Pick where the content comes from. With a beehiiv key on record, "Your newsletter" shows the connected publication
 * and, once chosen, a list of its sent issues (five a page). Without one, it asks for the key.
 */
export function ModePicker({ beehiiv: initialBeehiiv, initialIssues, initialIssuesError }: { beehiiv: BeehiivState; initialIssues: InitialIssues; initialIssuesError: string | null }) {
  // Nothing is chosen until the person chooses: a preselected card hides that there is a choice at all.
  const [mode, setMode] = useState<Mode["id"] | null>(null);
  const [beehiiv, setBeehiiv] = useState<BeehiivState>(initialBeehiiv);
  const [publicationId, setPublicationId] = useState<string | null>(initialIssues?.publicationId ?? initialBeehiiv?.publications[0]?.id ?? null);
  const [issues, setIssues] = useState<BeehiivIssue[] | null>(initialIssues?.issues ?? null);
  const [page, setPage] = useState(initialIssues?.page ?? 1);
  const [totalPages, setTotalPages] = useState(initialIssues?.totalPages ?? 1);
  const [issuesError, setIssuesError] = useState<string | null>(initialIssuesError);
  // With a key on record and no issues passed in, the list is fetched as soon as the picker is on screen, so it starts out loading.
  const [loading, setLoading] = useState(Boolean(initialBeehiiv && !initialIssues && !initialIssuesError));
  // The newest issue is chosen until the user picks another. It stays chosen while they page through older ones.
  const [chosen, setChosen] = useState<BeehiivIssue | null>(initialIssues?.issues[0] ?? null);

  // Public newsletter: the pasted link, and the post it resolved to (saved on the server as the user's source).
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [post, setPost] = useState<LinkedPost | null>(null);

  async function getContent(e: FormEvent) {
    e.preventDefault();
    if (fetching) return;
    if (!url.trim()) return setLinkError("Paste a link to a public post first.");
    setFetching(true);
    setLinkError(null);
    setPost(null);
    try {
      const res = await fetch("/api/source/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = (await res.json().catch(() => ({}))) as Partial<LinkedPost> & { error?: string };
      if (!res.ok || !data.mode) return setLinkError(res.status === 401 ? "Your login has expired. Log in again to continue." : (data.error ?? "Couldn't read that page."));
      setPost(data as LinkedPost);
    } catch {
      setLinkError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setFetching(false);
    }
  }

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

  const firstLoad = useRef(false);
  useEffect(() => {
    if (firstLoad.current || !initialBeehiiv || initialIssues || initialIssuesError || !publicationId) return;
    const t = setTimeout(() => {
      firstLoad.current = true; // set inside the timer: React's development double-run of effects clears the first one
      void loadIssues(publicationId);
    }, 0);
    return () => clearTimeout(t);
    // Once, when the picker appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // What is shown under the cards (the issue list, or the post that was found). When it first appears and is below the fold, bring it
  // into view, so choosing a source or connecting never looks like nothing happened.
  const below = useRef<HTMLElement | HTMLFieldSetElement>(null);
  const shownKey = mode === "own" && beehiiv ? "own" : mode === "public" && post ? `public:${post.mode}` : null;
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!shownKey) {
      scrolledFor.current = null;
      return;
    }
    if (scrolledFor.current === shownKey) return;
    const t = setTimeout(() => {
      scrolledFor.current = shownKey; // set inside the timer: React's development double-run of effects clears the first one
      const el = below.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.5 || top < 0)
        el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }, 0);
    return () => clearTimeout(t);
  }, [shownKey]);

  let selected: Mode = { ...MODES[0], cta: "Choose a source to continue" };
  if (mode === "own") {
    const base = MODES[0];
    if (!beehiiv) selected = { ...base, cta: "Connect beehiiv to continue" };
    else if (publicationId && chosen) selected = { ...base, href: stepUrl(ownMode(publicationId, chosen.id), "pick"), cta: "Pick" };
    else selected = { ...base, cta: loading ? "Loading your issues…" : "Choose an issue to continue" };
  } else if (mode === "public") {
    const base = MODES[1];
    selected = post ? { ...base, href: stepUrl(post.mode, "pick", "picking=manual"), cta: "Pick" } : { ...base, cta: "Get content to continue" };
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Newsletter source" className="grid gap-5 md:grid-cols-2">
        {publication ? (
          // A publication is on record: the mode itself shows it.
          <label className={`${cardBase} bg-accent`}>
            <input type="radio" name="mode" value="own" checked={mode === "own"} onChange={() => setMode("own")} className="peer sr-only" />
            {radioDot}
            <span className="font-display text-2xl">Your newsletter</span>
            <PublicationSummary publication={publication} avatar="bg-surface" compact />
            <span className="text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-cream">
                <Check aria-hidden className="size-3" strokeWidth={3} /> Connected to beehiiv
              </span>
              <Link href="/settings" className="ml-2 font-bold underline underline-offset-4">
                Manage in Settings
              </Link>
            </span>
            <SourceLogos />
          </label>
        ) : (
          <div className={`${cardBase} ${MODES[0].tone}`} onClick={() => setMode("own")}>
            <input id="mode-own" type="radio" name="mode" value="own" checked={mode === "own"} onChange={() => setMode("own")} className="peer sr-only" />
            {radioDot}
            <label htmlFor="mode-own" className="flex cursor-pointer flex-col items-start gap-4">
              <span className="font-display text-2xl">{MODES[0].title}</span>
            </label>
            <BeehiivConnect initial={null} onChange={onBeehiivChange} inCard />
            <SourceLogos />
          </div>
        )}
        <div className={`${cardBase} ${MODES[1].tone}`} onClick={() => setMode("public")}>
          <input id="mode-public" type="radio" name="mode" value="public" checked={mode === "public"} onChange={() => setMode("public")} className="peer sr-only" />
          {radioDot}
          <label htmlFor="mode-public" className="flex cursor-pointer flex-col items-start gap-4">
            <span className="font-display text-2xl">{MODES[1].title}</span>
          </label>
          <PublicLinkForm
            inCard
            value={url}
            onChange={(v) => {
              setUrl(v);
              setPost(null);
            }}
            onSubmit={getContent}
            busy={fetching}
            error={linkError}
            hint="Paste a link to a public newsletter issue, article, or blog, then highlight the parts you want to share."
          />
          <SourceLogos substack more="and any public post" />
        </div>
      </div>

      {mode === "own" && beehiiv && (
        <section ref={below as React.RefObject<HTMLElement>} aria-label="Your issues" className="mt-8 scroll-mt-4">
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

      {mode === "public" && (
        <>
          {post && (
            <fieldset ref={below as React.RefObject<HTMLFieldSetElement>} className="m-0 mt-8 min-w-0 scroll-mt-4 border-0 p-0">
              <legend className="mb-3 p-0 text-lg font-bold">Your post</legend>
              <IssueRow
                title={post.title}
                image={post.image}
                detail={[post.site || hostOf(post.url), post.author, post.publishedAt ? fmtDate(post.publishedAt) : null].filter(Boolean).join(" · ")}
              />
            </fieldset>
          )}
        </>
      )}

      <FlowBar next={selected.href ? { href: selected.href, onNavigate: startFreshRun } : null} status={<ResumeBanner inline />}>
        {selected.href ? (
          <Link href={selected.href} onClick={startFreshRun} className={`inline-flex items-center gap-2 ${primaryButton}`}>
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
