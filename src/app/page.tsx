import Link from "next/link";
import { AuthLink } from "@/components/AuthLink";
import { BeehiivLogo } from "@/components/BeehiivLogo";
import { BufferLogo } from "@/components/BufferLogo";
import { StepWord } from "@/components/StepWord";
import { Logo } from "@/components/Logo";
import { ResumeBanner } from "@/components/ResumeBanner";
import { PopularList } from "@/components/path/PopularList";
import { BuilderDemo } from "@/components/path/BuilderDemo";
import { PickMe } from "@/components/path/PickMe";
import { TagDemo } from "@/components/path/TagDemo";
import { PollenBurst } from "@/components/path/PollenBurst";
import {
  PathRail,
  PollenCursor,
  Reveal,
  Stop,
} from "@/components/path/PollenPath";
import { BRAND_NAME } from "@/lib/brand";
import { loadDemoIssue } from "@/lib/demo";

/** The first sentences of a description, up to about `max` characters, so a hero card stays small without cutting mid-sentence. */
function brief(text: string, max = 150): string {
  let out = "";
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if (out && (out + " " + s).length > max) break;
    out = out ? `${out} ${s}` : s;
  }
  return out;
}
/** "ADE babywearing dance workshop (8 weeks-18 months)" -> without the age range, which is too fine print for a hero card. */
const plainTitle = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, "");

export default function Home() {
  // Real click data from the demo issue (read at build time).
  const issue = loadDemoIssue();
  const top = issue.chunks
    .filter((c) => c.rank && c.score != null)
    .sort((a, b) => a.rank! - b.rank!)
    .slice(0, 6);
  const max = Math.max(...top.map((c) => c.score!));
  const pickCards = [
    ["Halloween brunch", /halloween brunch/i],
    ["Wait, is this the right date??", /ade babywearing/i],
    ["Where\u2019s that link?", /sleep survey/i],
    ["Copy link, paste, write caption, repeat", /monti/i],
    ["Which Mama+ Club was it again?", /mama\+ club/i],
  ].flatMap(([note, re]) => {
    const c = issue.chunks.find((x) => (re as RegExp).test(x.title));
    return c
      ? [
          {
            note: note as string,
            title: plainTitle(c.title),
            when: c.when?.replace(" @ ", ", ") ?? null,
            place: c.place,
            blurb: brief(c.blurb),
          },
        ]
      : [];
  });
  const ade = issue.chunks.find((x) => /ade babywearing/i.test(x.title));
  const demoEvent = {
    title: ade ? plainTitle(ade.title) : "ADE babywearing dance workshop",
    when: ade?.when?.replace(" @ ", ", ") ?? null,
    place: ade?.place ?? null,
    blurb: brief(ade?.blurb ?? ""),
  };
  const cta =
    "inline-block rounded-2xl bg-accent px-7 py-3.5 text-lg font-bold text-ink-deep shadow-sm transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-offset-4";
  const ctaAlt =
    "inline-block rounded-2xl px-7 py-3.5 text-lg font-bold text-ink-deep ring-2 ring-ink transition hover:-translate-y-0.5 hover:bg-ink/5 focus-visible:outline-offset-4";

  return (
    <main className="relative min-h-dvh overflow-x-clip">
      <PollenCursor />
      <div
        role="region"
        aria-label="Project status"
        className="bg-ink px-6 py-3 text-center text-sm font-semibold text-cream"
      >
        In build mode 🏗️ for Buffer Commit.{" "}
        <Link
          href="/feedback"
          className="underline decoration-honey decoration-[3px] underline-offset-4 hover:decoration-coral"
        >
          Leave us feedback before 12 Nov
        </Link>{" "}
        — help our self-funded nonprofit win up to $25,000!
      </div>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo height={56} />
        <nav aria-label="Get started" className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/demo/source"
            className="rounded-xl px-3 py-2 text-sm font-semibold underline decoration-[3px] decoration-transparent underline-offset-[7px] transition hover:decoration-coral sm:px-4"
          >
            Try demo
          </Link>
          <AuthLink
            className="rounded-xl bg-ink px-3.5 py-2 text-sm font-bold text-cream transition hover:bg-ink-deep sm:px-4"
            loggedOut="Log in to create"
            loggedIn="Open app"
          />
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-6 pb-14 pt-0 text-center md:pt-4">
        <PollenBurst size="size-40 sm:size-48" />
        <h1 className="text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
          Let your words{" "}
          <span className="relative inline-block">
            travel
            <svg
              aria-hidden
              viewBox="0 0 220 24"
              preserveAspectRatio="none"
              className="pp-wipe absolute -bottom-3 left-0 h-4 w-full overflow-visible"
            >
              <path
                d="M3 14 C 40 3 70 22 110 12 S 180 4 217 13"
                fill="none"
                stroke="#f28482"
                strokeWidth="6"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </span>
          .
        </h1>
        <p className="mx-auto max-w-2xl text-xl leading-relaxed">
          <strong>From picks to posts:</strong> Pollen Picks turns the
          most-clicked parts of your Beehiiv newsletter — or any public blog —
          into socials posts, tagging creators along the way. No AI, just your
          words in more places.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/demo/source" className={cta}>
            Try demo
          </Link>
          <AuthLink
            className={ctaAlt}
            loggedOut="Log in to create"
            loggedIn="Continue to the app"
          />
        </div>
        <p className="text-sm italic">
          The demo needs no account. Log in with Buffer to use your own content.
        </p>
      </section>

      <div className="mx-auto max-w-3xl px-6 mt-12">
        <PathRail className="md:-mx-6">
          {/* 1 */}
          <Stop>
            <Reveal>
              <h2 className="mb-4 max-w-2xl text-3xl leading-tight sm:text-5xl">
                The newsletter is out. Now, how to{" "}
                <Squiggle>spread the word?</Squiggle>
              </h2>
              <p className="max-w-2xl text-lg leading-relaxed">
                It took hours to write your newsletter. The last thing
                you want is for your words to be stuck there, for only some subscribers to see. 
                What about your socials followers? You don&rsquo;t have the time or energy
                to cross-post newsletter content to other channels, so{" "}
                <b>your best work never reaches socials</b>.
              </p>
            </Reveal>
          </Stop>

          {/* 2 */}
          <Stop>
            <Reveal>
              <h2 className="mb-4 max-w-2xl text-3xl leading-tight sm:text-5xl">
                <StepWord>Pick</StepWord> what to post
              </h2>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed">
                Before Pollen Picks, creating a socials post from a newsletter
                meant: Create the post design, open the issue, copy the pull quote, copy the link, 
                look up the details, adjust the template, retype the caption. Over and over again. 
                Now, Pollen Picks fills in the blanks — without AI.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <PickMe cards={pickCards} />
            </Reveal>
          </Stop>

          {/* 3 */}
          <Stop>
            <Reveal>
              <h2 className="mb-4 max-w-2xl text-3xl leading-tight sm:text-5xl">
                Start with what they <StepWord>loved</StepWord>
              </h2>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed">
                Connect to Beehiiv to rank your newsletter content by what your
                readers clicked the most. What they clicked is what they found most valuable — and worth sharing across all of your channels.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <figure className="max-w-2xl -rotate-1 rounded-[2rem] bg-surface p-5 ring-1 ring-ink/10 sm:p-7">
                <figcaption className="mb-4 flex items-baseline justify-between gap-4">
                  <span className="font-display text-xl">
                    Most clicked this issue
                  </span>
                  <span className="text-xs font-semibold">
                    Real data, demo issue
                  </span>
                </figcaption>
                <PopularList
                  rows={top.map((c) => ({
                    id: c.id,
                    rank: c.rank,
                    title: c.title,
                    pct: Math.round((c.score! / max) * 100),
                  }))}
                />
              </figure>
            </Reveal>
          </Stop>

          {/* 4: tagging */}
          <Stop>
            <Reveal>
              <h2 className="mb-4 max-w-2xl text-3xl leading-tight sm:text-5xl">
                Tag them <Squiggle>in</Squiggle>
              </h2>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed">
                Pollen Picks extracts social handles from link content to add to your captions, to extend your reach even further and bring the community along. Sharing across channels helps your whole network grow &mdash; a win-win-win for{" "}
                <b>your audience</b>, <b>organizers</b>, and your own{" "}
                <b>newsletter</b>.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <TagDemo event={demoEvent} />
            </Reveal>
          </Stop>

          {/* 5 */}
          <Stop>
            <Reveal>
              <h2 className="mb-4 max-w-2xl text-3xl leading-tight sm:text-5xl">
                One click to <Squiggle>all your socials</Squiggle>
              </h2>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed">
                No repeating posts for multiple channels — Pollen Picks uses
                Buffer to send your creations to all of your social networks at
                once. Instagram, LinkedIn, Facebook, and more; see the full list
                of supported platforms{" "}
                <a
                  href="https://support.buffer.com/article/567-supported-channels"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline decoration-[3px] underline-offset-[7px] hover:decoration-coral"
                >
                  here
                </a>
                .
              </p>
            </Reveal>
            <div
              aria-hidden
              className="flex max-w-2xl items-center gap-1.5 sm:gap-4"
            >
              <span className="flex h-10 shrink-0 items-center rounded-2xl bg-surface px-2 ring-1 ring-ink/10 sm:h-12 sm:px-3.5">
                <BeehiivLogo className="h-3.5 w-auto sm:h-5" />
              </span>
              <span className="font-display text-ink/50">→</span>
              <span className="flex h-10 shrink-0 items-center rounded-2xl bg-accent px-2 sm:h-12 sm:px-3.5">
                {/* max-w-none: the global img max-width of 100% lets a shrinking flex item squeeze the logo to nothing. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/pollen-picks-lockup-light.svg"
                  alt=""
                  className="h-7 w-auto max-w-none sm:h-9"
                />
              </span>
              <span className="font-display text-ink/50">→</span>
              <span className="flex h-10 shrink-0 items-center rounded-2xl bg-surface px-2 ring-1 ring-ink/10 sm:h-12 sm:px-3.5">
                <BufferLogo className="h-4 w-auto sm:h-6" />
              </span>
            </div>
          </Stop>

          {/* 6 */}
          <Stop>
            <Reveal>
              <div className="relative max-w-2xl rotate-1 rounded-[2rem] bg-blush p-7 sm:p-9">
                <span
                  aria-hidden
                  className="absolute -top-3 right-12 h-6 w-24 -rotate-3 rounded-sm bg-honey/80"
                />
                <h2 className="mb-4 text-3xl leading-tight sm:text-4xl">
                  Now, later, or draft — you choose
                </h2>
                <p className="mb-4 text-lg leading-relaxed">
                  Humans are at the core of Pollen Picks. From <b>auto mode</b>, to {" "}
                  pre-made <b>templates</b> to a fully customizable{" "}
                  <b>slide builder</b>, you decide how much review you want to
                  do, in Pollen Picks or Buffer.
                </p>
                <p className="text-lg leading-relaxed">
                  And there&rsquo;s <b>no AI inventing things</b>: it only uses
                  the words you already wrote. Which is the point, because those
                  are the words your readers loved.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <BuilderDemo event={demoEvent} />
            </Reveal>
          </Stop>

          {/* 7 */}
          <Stop>
            <Reveal>
              <h2 className="mb-8 max-w-2xl text-3xl leading-tight sm:text-4xl">
                Built by a fellow newsletter creator desperate to spend more
                time writing, less time posting
              </h2>
              <div className="grid max-w-4xl items-center gap-8 md:grid-cols-[250px_1fr]">
                <div className="relative mx-auto w-full max-w-[250px]">
                  <span
                    aria-hidden
                    className="absolute -left-3 -top-3 size-full -rotate-6 bg-accent [border-radius:58%_42%_55%_45%/45%_55%_45%_55%]"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/alex.jpg"
                    alt="Alex, founder of Amsterdam Parent Project, smiling at home"
                    width={720}
                    height={720}
                    className="relative aspect-square w-full object-cover [border-radius:45%_55%_42%_58%/55%_45%_55%_45%]"
                  />
                  <span
                    aria-hidden
                    className="absolute -bottom-2 -right-2 size-8 rounded-full bg-coral"
                  />
                </div>
                <div>
                  <p className="text-lg leading-relaxed">
                    Hi, I&rsquo;m Alex 👋 I&rsquo;m a toddler mom in Amsterdam,
                    a tech industry veteran, and the founder of{" "}
                    <a
                      href="https://amsterdamparentproject.nl"
                      className="font-semibold underline decoration-[3px] underline-offset-[7px] hover:decoration-coral"
                    >
                      Amsterdam Parent Project
                    </a>
                    , a nonprofit building community infrastructure for new
                    parents. For two years I&rsquo;ve published a local, new
                    parent activities digest, and every issue used to cost me 6
                    hours in my newsletter editor and 2 more hours to cross-post
                    that content to Instagram. I built Pollen Picks so that the
                    best newsletter content cross-pollinates to socials, without
                    more work from me.{" "}
                    <strong>
                      No AI — just delivering more value to more places using
                      the words I&rsquo;ve already written.
                    </strong>
                  </p>
                </div>
              </div>
            </Reveal>
          </Stop>

          {/* 8: the bloom */}
          <Stop className="pb-12">
            <Reveal>
              <div className="relative max-w-2xl">
                <Bloom />
                <h2 className="mb-4 text-3xl leading-tight sm:max-w-[calc(100%-8rem)] sm:text-5xl">
                  Let the best of your newsletter <Squiggle>travel.</Squiggle>
                </h2>
                <p className="mb-6 text-lg leading-relaxed">
                  Try the demo, or log in and bring your own issue.
                </p>
                <div className="flex flex-col items-start gap-3 sm:flex-row">
                  <Link href="/demo/source" className={cta}>
                    Try demo
                  </Link>
                  <AuthLink
                    className={ctaAlt}
                    loggedOut="Log in to create"
                    loggedIn="Continue to the app"
                  />
                </div>
                <p className="mt-8 mb-2 text-sm font-semibold">
                  People use it for
                </p>
                <ul className="flex flex-wrap gap-2">
                  {[
                    "Activities digests",
                    "Public newsletter summaries",
                    "Best-of recaps",
                    "Curated link roundups",
                  ].map((u, i) => (
                    <li
                      key={u}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${["bg-accent", "bg-card", "bg-chip/70", "bg-surface ring-1 ring-ink/10"][i]}`}
                    >
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </Stop>
        </PathRail>
      </div>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 pb-28 pt-10 text-sm">
        <span>{BRAND_NAME}, built for Buffer Commit 2026.</span>
        <span className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/privacy" className="font-semibold underline underline-offset-4">
            Privacy
          </Link>
          <AuthLink
            className="font-semibold underline decoration-[3px] underline-offset-[7px] hover:decoration-coral"
            loggedOut="Log in with Buffer"
            loggedIn="Continue to the app"
          />
        </span>
      </footer>
      <ResumeBanner bar />
    </main>
  );
}

/** A little dandelion head that pops open when you arrive. */
function Bloom() {
  const dots = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return { x: Math.cos(a) * 34, y: Math.sin(a) * 34, i };
  });
  return (
    <div
      aria-hidden
      className="absolute -top-2 right-0 hidden size-28 sm:block"
    >
      <svg viewBox="-50 -50 100 100" className="size-full overflow-visible">
        {dots.map(({ x, y, i }) => (
          <g key={i}>
            <line
              x1="0"
              y1="0"
              x2={x}
              y2={y}
              stroke="#2b3a36"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle
              className="pp-bloom-dot"
              cx={x}
              cy={y}
              r={i === 2 ? 7 : 6}
              fill={i === 2 ? "#f28482" : "#f6bd60"}
              style={
                {
                  "--d": `${0.3 + i * 0.05}s`,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                } as React.CSSProperties
              }
            />
          </g>
        ))}
        <circle r="6" fill="#2b3a36" />
      </svg>
    </div>
  );
}

/** The coral hand-drawn underline from the headline, reused for emphasis. It draws itself in when its section scrolls into view. */
function Squiggle({ children }: { children: React.ReactNode }) {
  return <span className="pp-squig">{children}</span>;
}
