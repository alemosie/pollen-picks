"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { IssueRow } from "@/components/IssueRow";
import { SquiggleIfOneLine } from "@/components/SquiggleIfOneLine";
import { PublicationSummary } from "@/components/PublicationSummary";
import type { BeehiivPublication } from "@/lib/beehiiv";
import { PollenDots } from "@/components/PollenDots";
import { PublicLinkForm, SourceLogos } from "@/components/PublicSource";
import { ResumeBanner } from "@/components/ResumeBanner";
import { clearProgress } from "@/lib/progress";
import { clearDemoRows } from "@/lib/pollen/demoHighlights";
import { clearDemoSource, encodeDemoSource, writeDemoSource } from "@/lib/pollen/demoSource";
import { stepUrl } from "@/lib/flow";

type Post = { url: string; title: string; site: string | null; author: string | null; image: string | null; publishedAt: string | null };

const sourceOf = (p: Post) => ({ url: p.url, title: p.title, newsletter: p.site || hostOf(p.url) || p.title, author: p.author });
// The demo issue's publication, as beehiiv reports it (shown the way the signed-in step shows a connected one).
const DEMO_PUBLICATION: BeehiivPublication = { id: "demo", name: "Just a Phase", organization: "Amsterdam Parent Project", subscribers: 1026, openRate: 70.7, clickRate: 19.3, created: 1730419200 };
const PICK_PAGE = `${stepUrl("demo", "pick")}?picking=manual`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// Starting a demo erases whatever was in progress, including earlier highlights.
function startFresh() {
  clearProgress();
  clearDemoRows();
  clearDemoSource();
}

type DemoIssue = { title: string; publishedAt: string; thumbnail?: string; newsletter: string; author?: string | null };

/**
 * Same list as the signed-in step (app/source/ModePicker): paste a link, or use the demo issue, which starts chosen. The demo issue opens its
 * parsed picker; a pasted post reads one page (Manual tab only: select text, press Pick).
 */
export function DemoSourcePicker({ demoIssue }: { demoIssue: DemoIssue }) {
  const [choice, setChoice] = useState<"demo" | "post">("demo");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  // The progress indicator keeps the first "next" callback it was given, so it reads the current post from a ref.
  const postRef = useRef<Post | null>(null);
  useEffect(() => {
    postRef.current = post;
  }, [post]);
  const enterPost = useCallback(() => {
    const p = postRef.current;
    if (!p) return;
    startFresh();
    writeDemoSource(sourceOf(p));
  }, []);

  // The last link that resolved, so pressing the button again with the same text just chooses that post instead of asking again.
  const resolved = useRef<{ address: string; post: Post } | null>(null);

  async function getContent(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const address = url.trim();
    if (!address) return setError("Paste a link to a public post first.");
    if (resolved.current?.address === address) {
      setError(null);
      setPost(resolved.current.post);
      setChoice("post");
      return;
    }
    setBusy(true);
    setError(null);
    setPost(null);
    try {
      const res = await fetch(`/api/demo/source?url=${encodeURIComponent(address)}`);
      const data = (await res.json().catch(() => ({}))) as Partial<Post> & { error?: string };
      if (!res.ok) return setError(data.error ?? "Couldn't read that page.");
      const found: Post = {
        url: data.url ?? address,
        title: data.title || "A public post",
        site: data.site ?? null,
        author: data.author ?? null,
        image: data.image ?? null,
        publishedAt: data.publishedAt ?? null,
      };
      // The link is kept in a cookie, so say now if it can't fit rather than after Pick.
      if (encodeDemoSource(sourceOf(found)).length > 3000) return setError("That link is too long for the demo. Try a shorter one.");
      resolved.current = { address, post: found };
      setPost(found);
      setChoice("post");
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const useDemo = !(choice === "post" && post);
  const href = useDemo ? stepUrl("demo", "pick") : PICK_PAGE;
  const onNavigate = useDemo ? startFresh : enterPost;

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
          busy={busy}
          error={error}
        />
        <div className="mt-4">
          <SourceLogos substack more="and any public blog" />
        </div>
        {post && (
          <div className="mt-4">
            <IssueRow
              value="pasted"
              title={post.title}
              image={post.image}
              detail={[post.site || hostOf(post.url), post.author, post.publishedAt ? date(post.publishedAt) : null].filter(Boolean).join(" · ")}
              checked={!useDemo}
              onChange={() => setChoice("post")}
            />
          </div>
        )}
      </section>

      <section aria-label="Demo issue">
        <h2 className="mb-3 mt-0 font-display text-2xl">Or choose the demo from <SquiggleIfOneLine text={demoIssue.newsletter} /></h2>
        <div className="mb-4">
          <PublicationSummary publication={DEMO_PUBLICATION} avatar="bg-honey" compact hideName />
        </div>
        <IssueRow
          value="demo"
          title={demoIssue.title}
          detail={[demoIssue.newsletter, demoIssue.author, date(demoIssue.publishedAt)].filter(Boolean).join(" · ")}
          image={demoIssue.thumbnail}
          badge="Latest"
          checked={useDemo}
          onChange={() => setChoice("demo")}
        />
        <p className="mb-0 mt-3 text-sm leading-relaxed italic">A real issue of a beehiiv newsletter, with real click data. No account needed.</p>
      </section>

      <FlowBar next={{ href, onNavigate }} status={<ResumeBanner inline />}>
        <Link href={href} onClick={onNavigate} className={`inline-flex items-center gap-2 ${primaryButton}`}>
          Pick
          <Arrow />
        </Link>
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
