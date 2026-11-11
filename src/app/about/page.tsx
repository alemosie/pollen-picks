import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { StepWord } from "@/components/StepWord";

export const metadata = {
  title: "About · Pollen Picks",
  description: "Why Pollen Picks exists, what it does, how it is built, and how it uses the Buffer API.",
};

// Keep the Buffer section in step with the code. The numbers come from: SCOPES (lib/buffer.ts), BACKOFF_SECONDS and PARALLEL
// (lib/sendQueue.ts), IMAGE_LIMITS and IMAGE_BYTE_LIMITS (lib/channels.ts), ALT_MAX (lib/slides/alt.ts) and SLIDE_RETENTION_DAYS
// (lib/slideStore.ts). When one changes, change it here and bump UPDATED. Nothing in that section is claimed unless it has been tried
// against real Buffer. Copy style: "beehiiv" is always lowercase.
const UPDATED = "10 November 2026";

const prose =
  "space-y-3 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-cream [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-3 [&_ul]:pl-0";

type Section = { id: string; title: string; body: ReactNode };

const sections: Section[] = [
  {
    id: "does",
    title: "What it does",
    body: (
      <>
        <p>
          Pollen Picks turns a newsletter issue, a blog post or any public page into a carousel for your social channels, and saves it in
          Buffer as a draft. Five steps:
        </p>
        <ul>
          <li>
            <b>Choose a post.</b> Connect your beehiiv newsletter, or paste a link to a public post (beehiiv, Substack or any blog) and
            highlight what you want to share.
          </li>
          <li>
            <b>Pick.</b> For a connected beehiiv issue, the links readers actually clicked are ranked first, from beehiiv&rsquo;s own click data.
          </li>
          <li>
            <b>Design.</b> Your picks become slides, in your colors, fonts and logo. Use the standard layout or build your own slides.
          </li>
          <li>
            <b>Write.</b> One caption per network, with the limits of each one shown, and Instagram accounts credited.
          </li>
          <li>
            <b>Send.</b> Choose your channels, preview each one, and create drafts in Buffer (or send now).
          </li>
        </ul>
        <p>
          There is no AI. The words on the slides and in the captions are the ones already written in the post. It is built for activities
          digests, link roundups, best-of recaps, blog posts and weekly newsletters.
        </p>
      </>
    ),
  },
  {
    id: "why",
    title: "Why I built it",
    body: (
      <>
        <p>
          I&rsquo;m Alex, a toddler mom in Amsterdam, a tech industry veteran, and the founder of{" "}
          <a href="https://amsterdamparentproject.nl">Amsterdam Parent Project</a>, a nonprofit building community infrastructure for new
          parents. For 2 years I&rsquo;ve published a local, new parent activities digest, <i>Just a Phase</i>, and every issue used to cost me
          6 hours in my newsletter editor and 2 more hours to cross-post that content to Instagram.
        </p>
        <p>
          I built Pollen Picks so that the best newsletter content cross-pollinates to socials, without more work from me. No AI: just
          delivering more value to more places using the words I&rsquo;ve already written.
        </p>
        <p>
          It is free, and it will stay free for other newsletter creators. I will use it for my own newsletter-to-social workflow after the
          contest too.
        </p>
      </>
    ),
  },
  {
    id: "built",
    title: "How it is built",
    body: (
      <ul>
        <li>
          <b>The app:</b> Next.js on Netlify, with Supabase (hosted in the EU) for accounts, history and encrypted tokens. Your Buffer account
          is your login.
        </li>
        <li>
          <b>Slides:</b> drawn by the app&rsquo;s own renderer, so there is no design tool behind it. Each slide is drawn once per send.
        </li>
        <li>
          <b>Your newsletter:</b> connected with a beehiiv API key (stored encrypted, only its last four characters are ever shown again). The
          app only reads your publication and posts.
        </li>
        <li>
          <b>Public links:</b> a pasted page is rendered and you highlight what to share, so it works for any blog without a parser.
        </li>
        <li>
          <b>Credit:</b> when a pick links to an Instagram post, the account is looked up and credited on the slide and in the caption, by
          default. Credit where it is due.
        </li>
        <li>
          <b>The demo:</b> open to everyone, no account needed. It uses a real issue of <i>Just a Phase</i> with its real click data, and it
          never sends anything.
        </li>
      </ul>
    ),
  },
  {
    id: "asks",
    title: "What it asks Buffer for",
    body: (
      <>
        <p>
          You log in with Buffer through OAuth. Pollen Picks asks for four permissions: <code>account:read</code>, <code>posts:read</code>,{" "}
          <code>posts:write</code> and <code>offline_access</code>. The last one gives a refresh token, so you stay logged in without going back
          to Buffer every time. Tokens are stored encrypted.
        </p>
        <p>It uses Buffer&rsquo;s GraphQL API for three things:</p>
        <ul>
          <li>
            <b>Your channels.</b> Which channels you have. Locked and disconnected ones are left out of the picker, because they can&rsquo;t take a
            post.
          </li>
          <li>
            <b>Creating posts.</b> One <code>createPost</code> per channel. By default it is saved as a <b>draft</b> (<code>saveToDraft</code>); it
            goes out straight away only when you choose &ldquo;Send now&rdquo; and confirm.
          </li>
          <li>
            <b>Checking on them.</b> The status of what you sent, up to 25 posts in one request, so History doesn&rsquo;t spend Buffer&rsquo;s rate
            limit one post at a time.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "failures",
    title: "What happens when something goes wrong",
    body: (
      <ul>
        <li>
          <b>Rate limits.</b> Buffer limits requests per app, and every Pollen Picks user shares that limit. When Buffer says &ldquo;too many
          requests&rdquo; (HTTP 429 or <code>RATE_LIMIT_EXCEEDED</code>), nothing was created, so waiting is safe. The post is put back and tried
          again after 20, 40, 80, 160 and then 300 seconds, six tries in all. The rest of that batch stops asking straight away, so one busy moment
          doesn&rsquo;t make it worse.
        </li>
        <li>
          <b>Never twice.</b> If a request to publish times out, or Buffer answers with a server error, there is no way to know whether the post
          exists. Pollen Picks marks it <i>unknown</i> and does <b>not</b> retry it, because a retry could post it twice. You check in Buffer and
          send again yourself if it isn&rsquo;t there.
        </li>
        <li>
          <b>One row per channel.</b> Every channel of a send is its own row in a queue. A worker claims it with a short lease, so two workers can
          never pick up the same post.
        </li>
        <li>
          <b>Plain refusals are shown as they come.</b> If Buffer refuses a post, you see Buffer&rsquo;s own reason on that channel&rsquo;s row, and
          the other channels carry on.
        </li>
      </ul>
    ),
  },
  {
    id: "networks",
    title: "What it does differently for each network",
    body: (
      <>
        <ul>
          <li>
            <b>Number of images.</b> Instagram, Facebook and Threads take up to 10, LinkedIn up to 20, and X, Bluesky and Mastodon up to 4. A
            carousel with more slides is cut for the networks that take fewer, and the Design step shows which slides each network gets. Networks
            that need video or a board (TikTok, YouTube, Pinterest) are left out, with the reason.
          </li>
          <li>
            <b>Image size.</b> Bluesky refuses an image over 1 MB, and Buffer can&rsquo;t shrink one for it, so Bluesky gets smaller JPEG versions
            of the slides. The others get the full-size images.
          </li>
          <li>
            <b>Caption length.</b> Buffer saves a draft that is over its network&rsquo;s limit, but won&rsquo;t schedule or publish it. Pollen Picks
            shows which networks are over while you write, and leaves a note on the draft if it still went.
          </li>
          <li>
            <b>LinkedIn as a PDF.</b> LinkedIn shows several images as a cropped grid. If you tick &ldquo;Send LinkedIn a PDF carousel&rdquo;, the
            slides go as one PDF document, one page per slide, which LinkedIn shows as a swipeable carousel. If Buffer refuses the PDF, that post
            is sent as images instead and the row says so. For a post that goes out right away, a PDF that timed out is never retried as images,
            for the same never-twice reason.
          </li>
          <li>
            <b>Alt text.</b> Every slide image goes with alt text taken from the words on the slide (no AI, nothing rewritten), trimmed to 100
            characters. If a network refuses the alt text, that post is tried once more without it, which is safe because a refusal means nothing
            was created, and the row says so.
          </li>
        </ul>
        <p>
          The limits come from Buffer&rsquo;s help pages and from the refusals Buffer sends back. They are in one place in the code and are checked
          against those pages when Buffer changes them.
        </p>
      </>
    ),
  },
  {
    id: "gaps",
    title: "What it doesn’t do yet",
    body: (
      <ul>
        <li>
          <b>No background jobs.</b> The send queue is worked while the page is open and when you open History, so a send that is waiting out a
          rate limit moves again when you come back. Nothing runs while the site is closed.
        </li>
        <li>
          <b>One slide shape.</b> Every network gets the same slide shape. Networks that prefer a landscape or square image are not given their
          own.
        </li>
      </ul>
    ),
  },
  {
    id: "stored",
    title: "What it keeps while it sends",
    body: (
      <p>
        Buffer fetches the images (and the PDF) from a web address, so Pollen Picks stores them for the send. They have unlisted addresses, and are
        removed 30 days after the post is over. The caption is erased once the post exists in Buffer; if a post failed or was unclear, it is kept
        for 24 hours so you can retry. The <Link href="/privacy">privacy page</Link> has the rest.
      </p>
    ),
  },
  {
    id: "contest",
    title: "Built for Buffer Commit 2026",
    body: (
      <p>
        Pollen Picks was built between 28 October and 13 November 2026 for Buffer Commit, Buffer&rsquo;s build contest for apps on its API. Try
        the <Link href="/demo/source">demo</Link>, or tell me what you think on the <Link href="/feedback">feedback form</Link>. It lands straight
        with me.
      </p>
    ),
  },
];

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
      <header className="mb-10 flex items-center justify-between gap-6 sm:mb-14">
        <Logo height={48} href="/" />
        <Link href="/login" className="text-sm font-semibold underline underline-offset-4">
          Log in
        </Link>
      </header>

      <h1 className="mb-3 text-4xl sm:text-5xl">
        About <StepWord>Pollen Picks</StepWord>
      </h1>
      <p className="mb-10 max-w-2xl text-lg">
        From picks to posts: why it exists, what it does, how it is built, and how it uses Buffer. Everything about Buffer here has been tried
        against real Buffer. Last updated {UPDATED}.
      </p>

      <div className="space-y-5">
        {sections.map((s) => (
          <section key={s.id} aria-labelledby={`a-${s.id}`} className="rounded-2xl bg-surface p-6">
            <h2 id={`a-${s.id}`} className="mb-3 text-2xl">
              {s.title}
            </h2>
            {s.id === "why" ? (
              <div className="grid items-center gap-6 sm:grid-cols-[160px_1fr]">
                <div className="relative mx-auto w-full max-w-[160px]">
                  <span aria-hidden className="absolute -left-2 -top-2 size-full -rotate-6 bg-accent [border-radius:58%_42%_55%_45%/45%_55%_45%_55%]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/alex.jpg"
                    alt="Alex, founder of Amsterdam Parent Project, smiling at home"
                    width={720}
                    height={720}
                    className="relative aspect-square w-full object-cover [border-radius:45%_55%_42%_58%/55%_45%_55%_45%]"
                  />
                </div>
                <div className={prose}>{s.body}</div>
              </div>
            ) : (
              <div className={prose}>{s.body}</div>
            )}
          </section>
        ))}
      </div>

      <p className="mt-12">
        <Link href="/" className="inline-flex items-center gap-2 font-bold underline underline-offset-4">
          <ArrowLeft aria-hidden className="size-4" /> Back to home
        </Link>
      </p>
    </main>
  );
}
