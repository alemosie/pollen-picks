"use client";

import Link from "next/link";
import { BeehiivConnect, type BeehiivState } from "@/components/BeehiivConnect";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { IssueRow } from "@/components/IssueRow";
import { PollenDots } from "@/components/PollenDots";
import { PublicLinkForm, SourceLogos } from "@/components/PublicSource";
import { SquiggleIfOneLine } from "@/components/SquiggleIfOneLine";
import { ResumeBanner } from "@/components/ResumeBanner";
import type { BeehiivIssue } from "@/lib/beehiiv";
import { ownMode, stepUrl } from "@/lib/flow";
import { startFreshRun } from "@/lib/progress";
import { ArrowLeftRight } from "lucide-react";
import { PublicationSummary } from "@/components/PublicationSummary";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { IssueList } from "./IssueList";
import { PublicationSwitchModal } from "./PublicationSwitchModal";

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

/**
 * Choose the post to pick from: one radio list. A pasted link becomes the top row ("Your post"); below it, the sent issues of the connected
 * publication (five a page, newest chosen to begin with). Without a beehiiv key, the issue half asks for one. The chosen row decides the
 * picker: an issue opens the parsed one, a pasted post the manual one.
 */
export function ModePicker({ beehiiv: initialBeehiiv, initialIssues, initialIssuesError }: { beehiiv: BeehiivState; initialIssues: InitialIssues; initialIssuesError: string | null }) {
  // Which kind of row is chosen. A pasted post takes over when it is found; editing the link hands the choice back to the newest issue.
  const [switching, setSwitching] = useState(false);
  const [choice, setChoice] = useState<"post" | "issue">("issue");
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

  // The last link that resolved, so pressing the button again with the same text just chooses that post instead of asking again.
  const resolved = useRef<{ address: string; post: LinkedPost } | null>(null);

  async function getContent(e: FormEvent) {
    e.preventDefault();
    if (fetching) return;
    if (!url.trim()) return setLinkError("Paste a link to a public post first.");
    if (resolved.current?.address === url.trim()) {
      setLinkError(null);
      setPost(resolved.current.post);
      setChoice("post");
      return;
    }
    setFetching(true);
    setLinkError(null);
    setPost(null);
    try {
      const res = await fetch("/api/source/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = (await res.json().catch(() => ({}))) as Partial<LinkedPost> & { error?: string };
      if (!res.ok || !data.mode) return setLinkError(res.status === 401 ? "Your login has expired. Log in again to continue." : (data.error ?? "Couldn't read that page."));
      resolved.current = { address: url.trim(), post: data as LinkedPost };
      setPost(data as LinkedPost);
      setChoice("post");
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
    setChoice("issue");
    setPage(1);
    setTotalPages(1);
    if (first) void loadIssues(first);
  }

  const publication = beehiiv ? (beehiiv.publications.find((p) => p.id === publicationId) ?? beehiiv.publications[0]) : undefined;

  const useIssue = !(choice === "post" && post);
  let cta = "Paste a link or connect beehiiv";
  let href: string | undefined;
  if (!useIssue && post) {
    href = stepUrl(post.mode, "pick", "picking=manual");
    cta = "Pick";
  } else if (beehiiv && publicationId && chosen) {
    href = stepUrl(ownMode(publicationId, chosen.id), "pick");
    cta = "Pick";
  } else if (beehiiv) {
    cta = loading ? "Loading your issues…" : "Choose a post to continue";
  }

  return (
    <div className="space-y-8">
      <section aria-label="Paste a link" className="relative rounded-2xl bg-sage/50 p-5 sm:p-6">
        <PollenDots found={post?.url ?? null} />
        <h2 className="mb-3 mt-0 font-display text-2xl">Paste a link</h2>
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
        />
        <div className="mt-4">
          <SourceLogos substack more="and any public blog" />
        </div>
        {post && (
          <div className="mt-4">
            <IssueRow
              value="pasted"
              puff
              title={post.title}
              image={post.image}
              detail={[post.site || hostOf(post.url), post.author, post.publishedAt ? fmtDate(post.publishedAt) : null].filter(Boolean).join(" · ")}
              checked={!useIssue}
              onChange={() => setChoice("post")}
            />
          </div>
        )}
      </section>

      <section aria-label="Your newsletter">
        {beehiiv && publication ? (
          <>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="m-0 min-w-0 font-display text-2xl">Or choose from: <SquiggleIfOneLine text={publication.name} /></h2>
              {beehiiv.publications.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSwitching(true)}
                  aria-label="Switch publication"
                  title="Switch publication"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-ink/20 hover:ring-ink/50"
                >
                  <ArrowLeftRight aria-hidden className="size-4" strokeWidth={2.2} />
                </button>
              )}
            </div>
            <div className="mb-4">
              <PublicationSummary publication={publication} avatar="bg-honey" compact hideName />
            </div>
            {switching && (
              <PublicationSwitchModal
                publications={beehiiv.publications}
                currentId={publicationId}
                onClose={() => setSwitching(false)}
                onSelect={(id) => {
                  setChoice("issue");
                  setPublicationId(id);
                  void loadIssues(id);
                }}
              />
            )}
            <IssueList
              issues={issues}
              page={page}
              totalPages={totalPages}
              chosen={chosen}
              active={useIssue}
              onSelect={(i) => {
                setChoice("issue");
                setChosen(i);
              }}
              onPage={(n) => publicationId && void loadIssues(publicationId, n, false)}
              loading={loading}
              error={issuesError}
              onRetry={() => publicationId && void loadIssues(publicationId, page, chosen === null)}
            />
            <div className="mt-4">
              <SourceLogos
                after={
                  <Link href="/settings" className="ml-1 text-sm font-bold underline underline-offset-4">
                    Manage in Settings
                  </Link>
                }
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-3 mt-0 font-display text-2xl">Or choose from your newsletter</h2>
          <div className="rounded-2xl bg-honey/30 p-5 sm:p-6">
            <BeehiivConnect initial={null} onChange={onBeehiivChange} inCard />
            <div className="mt-4">
              <SourceLogos />
            </div>
          </div>
          </>
        )}
      </section>

      <FlowBar next={href ? { href, onNavigate: startFreshRun } : null} status={<ResumeBanner inline />}>
        {href ? (
          <Link href={href} onClick={startFreshRun} className={`inline-flex items-center gap-2 ${primaryButton}`}>
            {cta}
            <Arrow />
          </Link>
        ) : (
          <span aria-disabled className="inline-flex min-w-0 cursor-not-allowed items-center gap-2 rounded-xl border-2 border-dashed border-cream/40 px-4 py-2 text-center text-sm font-semibold leading-tight text-cream/60 sm:px-6 sm:py-3 sm:text-base">
            {cta}
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
