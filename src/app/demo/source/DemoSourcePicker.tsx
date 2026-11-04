"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { FlowBar, primaryButton } from "@/components/FlowBar";
import { IssueRow } from "@/components/IssueRow";
import { PublicLinkForm } from "@/components/PublicSource";
import { ResumeBanner } from "@/components/ResumeBanner";
import { clearProgress } from "@/lib/progress";
import { clearDemoRows } from "@/lib/pollen/demoHighlights";
import { clearDemoSource, encodeDemoSource, writeDemoSource } from "@/lib/pollen/demoSource";
import { stepUrl } from "@/lib/flow";

type Source = { id: string; title: string; tag: string; logos: ReactNode; body: ReactNode; tone: string; href?: string; link?: boolean };
type Post = { url: string; title: string; site: string | null; author: string | null; image: string | null; publishedAt: string | null };

const sourceOf = (p: Post) => ({ url: p.url, title: p.title, newsletter: p.site || hostOf(p.url) || p.title, author: p.author });
const PICK_PAGE = `${stepUrl("demo", "pick")}?picking=manual`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// Same cards as the signed-in source step (see app/source/ModePicker). The demo issue opens its parsed picker; the public
// newsletter reads one page (Manual tab only: select text, press Pick).
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

// Starting a demo erases whatever was in progress, including earlier highlights.
function startFresh() {
  clearProgress();
  clearDemoRows();
  clearDemoSource();
}

export function DemoSourcePicker({ sources, demoIssue }: { sources: Source[]; demoIssue: { title: string; publishedAt: string; thumbnail?: string; newsletter: string; author?: string | null } }) {
  const [chosen, setChosen] = useState(sources[0].id);
  const selected = sources.find((s) => s.id === chosen)!;
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

  async function getContent(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const address = url.trim();
    if (!address) return setError("Paste a link to a public post first.");
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
      setPost(found);
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Newsletter source" className="grid gap-5 md:grid-cols-2">
        {sources.map((s) => (
          <label key={s.id} className={`${cardBase} ${s.tone}`}>
            <input type="radio" name="source" value={s.id} checked={chosen === s.id} onChange={() => setChosen(s.id)} className="peer sr-only" />
            {radioDot}
            <span className="w-fit rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold">{s.tag}</span>
            <span className="font-display text-2xl">{s.title}</span>
            {s.body}
            {s.logos}
          </label>
        ))}
      </div>

      {selected.href && (
        <fieldset className="m-0 mt-8 min-w-0 border-0 p-0">
          <legend className="mb-3 p-0 text-lg font-bold">Choose an issue</legend>
          <IssueRow title={demoIssue.title} detail={[demoIssue.newsletter, demoIssue.author, date(demoIssue.publishedAt)].filter(Boolean).join(" · ")} image={demoIssue.thumbnail} badge="Latest" />
        </fieldset>
      )}

      {selected.link && (
        <>
          <PublicLinkForm
            value={url}
            onChange={(v) => {
              setUrl(v);
              setPost(null);
            }}
            onSubmit={getContent}
            busy={busy}
            error={error}
          />
          {post && (
            <fieldset className="m-0 mt-8 min-w-0 border-0 p-0">
              <legend className="mb-3 p-0 text-lg font-bold">Your post</legend>
              <IssueRow
                title={post.title}
                image={post.image}
                detail={[post.site || hostOf(post.url), post.author, post.publishedAt ? date(post.publishedAt) : null].filter(Boolean).join(" · ")}
              />
            </fieldset>
          )}
        </>
      )}

      <FlowBar
        next={selected.href ? { href: selected.href, onNavigate: startFresh } : selected.link && post ? { href: PICK_PAGE, onNavigate: enterPost } : null}
        status={<ResumeBanner inline />}
      >
        {selected.href && (
          <Link href={selected.href} onClick={startFresh} className={`inline-flex items-center gap-2 ${primaryButton}`}>
            Pick
            <Arrow />
          </Link>
        )}
        {selected.link &&
          (post ? (
            <Link href={PICK_PAGE} onClick={enterPost} className={`inline-flex items-center gap-2 ${primaryButton}`}>
              Pick
              <Arrow />
            </Link>
          ) : (
            <span aria-disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border-2 border-dashed border-cream/40 px-6 py-3 font-semibold text-cream/60">
              Get content to continue
            </span>
          ))}
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
