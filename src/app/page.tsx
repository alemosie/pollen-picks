import { AuthLink } from "@/components/AuthLink";
import { BeehiivMark } from "@/components/BeehiivLogo";
import { BufferLogo } from "@/components/BufferLogo";
import { Logo } from "@/components/Logo";
import { PollenBurst } from "@/components/path/PollenBurst";
import { PathRail, PollenCursor, Reveal, Stop } from "@/components/path/PollenPath";
import { BRAND_NAME } from "@/lib/brand";
import { loadDemoIssue } from "@/lib/demo";

const NAP = [
  { t: "Halloween at Robbeburg, Sat 31 Oct", c: "bg-honey", r: "-rotate-3", x: "left-0 top-0 sm:top-2" },
  { t: "which Mama+ Club was it again?", c: "bg-surface ring-1 ring-ink/10", r: "rotate-2", x: "right-0 top-6 sm:right-auto sm:left-[34%] sm:top-0" },
  { t: "copy link. paste. resize photo.", c: "bg-blush", r: "rotate-[5deg]", x: "left-[3%] top-[7.5rem] sm:left-auto sm:right-0 sm:top-6" },
  { t: "caption… caption… alt text (again)", c: "bg-chip/70", r: "rotate-[-5deg]", x: "right-0 top-[9.5rem] sm:right-auto sm:left-[6%] sm:top-[46%]" },
  { t: "wait, is this the right date??", c: "bg-surface ring-1 ring-ink/10", r: "rotate-3", x: "left-0 top-[15.5rem] sm:left-[38%] sm:top-[42%]" },
  { t: "Nap ends in 0:12", c: "bg-coral !w-[9.5rem]", r: "-rotate-6", x: "right-0 top-[17rem] sm:top-[62%]" },
];

export default function Home() {
  // Real click data from the demo issue (read at build time).
  const top = loadDemoIssue()
    .chunks.filter((c) => c.rank && c.score != null)
    .sort((a, b) => a.rank! - b.rank!)
    .slice(0, 6);
  const max = Math.max(...top.map((c) => c.score!));
  const cta =
    "inline-block rounded-2xl bg-accent px-7 py-3.5 text-lg font-bold text-ink-deep shadow-sm transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-offset-4";

  return (
    <main className="relative min-h-dvh overflow-x-clip">
      <PollenCursor />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo height={56} />
        <AuthLink className="rounded-xl px-4 py-2 text-sm font-semibold underline decoration-[3px] decoration-transparent underline-offset-[7px] transition hover:decoration-coral" loggedOut="Log in" loggedIn="Open app" />
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-6 pb-14 pt-0 text-center md:pt-4">
        <PollenBurst size="size-40 sm:size-48" />
        <p className="text-lg font-semibold">Let your words travel from newsletter to socials</p>
          <h1 className="text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            From picks to{" "}
            <span className="relative inline-block">
              posts
              <svg aria-hidden viewBox="0 0 220 24" preserveAspectRatio="none" className="absolute -bottom-3 left-0 h-4 w-full overflow-visible">
                <path
                  d="M3 14 C 40 3 70 22 110 12 S 180 4 217 13"
                  fill="none"
                  stroke="#f28482"
                  strokeWidth="6"
                  strokeLinecap="round"
                  pathLength={1}
                  className="pp-scribble"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </span>
            .
          </h1>
          <p className="mx-auto max-w-2xl text-xl leading-relaxed">
            You already wrote the newsletter issue. Now Instagram wants all of it again. Pollen Picks turns what your readers loved into carousels and captions,
            waiting as drafts in Buffer for you to cross-pollinate to all of your social channels.
          </p>
          <div className="flex flex-col items-center gap-3">
            <AuthLink className={cta} loggedOut="Log in with Buffer" loggedIn="Continue to the app" />
            <span className="text-sm italic">Free, plus a demo for you to try it out.</span>
          </div>
      </section>

      <p aria-hidden className="mx-auto mb-6 flex max-w-3xl items-center gap-2 px-6 pl-16 text-sm font-semibold text-ink/70 md:pl-12">
        <span className="pp-bob inline-block">↓</span> follow the branch
      </p>

      <div className="mx-auto max-w-3xl px-6">
        <PathRail className="md:-mx-6">
          {/* 1 */}
          <Stop label="Sunday, 9pm">
            <Reveal>
              <h2 className="mb-4 max-w-2xl text-3xl leading-tight sm:text-5xl">
                The issue is out. <Squiggle>You did it.</Squiggle>
              </h2>
              <p className="max-w-2xl text-lg leading-relaxed">
                For two years I&rsquo;ve sent a local activities digest for new parents in Amsterdam, and every issue costs about six hours in the editor. Then
                it needs to exist on Instagram too.
              </p>
            </Reveal>
          </Stop>

          {/* 2 */}
          <Stop label="Monday, nap time">
            <Reveal>
              <h2 className="mb-4 max-w-2xl text-3xl leading-tight sm:text-5xl">The copy-paste pile.</h2>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed">
                Two more hours. Open the issue, copy a link, find the photo, resize it, retype the caption, wonder if that was Saturday or Sunday. Repeat.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <div aria-hidden className="relative mb-2 h-[22rem] max-w-3xl sm:h-[16rem]">
                {NAP.map((n) => (
                  <span
                    key={n.t}
                    className={`pp-tile absolute w-[9.5rem] rounded-2xl p-3.5 font-display text-base leading-snug shadow-md sm:w-[13rem] sm:text-lg ${n.c} ${n.r} ${n.x}`}
                  >
                    {n.t}
                  </span>
                ))}
              </div>
            </Reveal>
          </Stop>

          {/* 3 */}
          <Stop label="But wait">
            <Reveal>
              <h2 className="mb-4 max-w-2xl text-3xl leading-tight sm:text-5xl">
                Your readers <Squiggle>already voted.</Squiggle>
              </h2>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed">
                Pollen Picks reads your Beehiiv click data and ranks every link by how many people actually tapped it. No guessing, no gut feel on a Sunday
                night. What they clicked is what they want to see again.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <figure className="max-w-2xl -rotate-1 rounded-[2rem] bg-surface p-5 ring-1 ring-ink/10 sm:p-7">
                <figcaption className="mb-4 flex items-baseline justify-between gap-4">
                  <span className="font-display text-xl">Most clicked this issue</span>
                  <span className="text-xs font-semibold">Real data, demo issue</span>
                </figcaption>
                <ol className="flex flex-col gap-3">
                  {top.map((c, i) => (
                    <li key={c.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm font-semibold">
                        <span className="min-w-0 truncate">
                          <span className="mr-2 font-display text-ink/60">#{c.rank}</span>
                          {c.title}
                        </span>
                        <span className="shrink-0">{c.score}</span>
                      </div>
                      <div className="h-3 rounded-full bg-cream">
                        <div className={`pp-bar h-full rounded-full ${i < 4 ? "bg-accent" : "bg-card"}`} style={{ "--w": `${Math.round((c.score! / max) * 100)}%`, "--d": `${i * 0.08}s` } as React.CSSProperties} />
                      </div>
                    </li>
                  ))}
                </ol>
              </figure>
            </Reveal>
          </Stop>

          {/* 4 */}
          <Stop label="Now it's easy">
            <Reveal>
              <h2 className="mb-4 max-w-2xl text-3xl leading-tight sm:text-5xl">
                Pick it. Make it. <Squiggle>Check it.</Squiggle>
              </h2>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed">
                <strong>Pick</strong> your top clicks, a whole section, or any bullet from the issue. <strong>Make</strong> a carousel with captions, tags
                and alt text, using a template you tweak once and reuse forever. <strong>Check</strong> it in your Buffer drafts, then schedule it or toss it.
              </p>
            </Reveal>
            <div aria-hidden className="mb-8 flex max-w-2xl items-center gap-3 sm:gap-4">
              <span className="flex h-12 w-14 items-center justify-center rounded-2xl bg-surface p-2.5 ring-1 ring-ink/10">
                <BeehiivMark className="h-full w-auto" />
              </span>
              <span className="font-display text-ink/50">→</span>
              <span className="rounded-2xl bg-accent px-4 py-3 font-display text-lg">{BRAND_NAME}</span>
              <span className="font-display text-ink/50">→</span>
              <span className="flex h-12 items-center rounded-2xl bg-surface px-3.5 ring-1 ring-ink/10">
                <BufferLogo className="h-6 w-auto" />
              </span>
            </div>
            <div aria-hidden className="relative flex max-w-3xl gap-3 sm:gap-4">
              <Reveal className="w-1/3">
                <div className="pp-slide aspect-[4/5] -rotate-2 rounded-3xl bg-accent p-3 shadow-lg sm:p-5" style={{ "--d": "0s" } as React.CSSProperties}>
                  <p className="text-[10px] font-bold uppercase tracking-wide sm:text-xs">Just a Phase</p>
                  <p className="mt-3 font-display text-xl leading-none sm:text-3xl">This week&rsquo;s top picks</p>
                  <span className="mt-3 block size-3 rounded-full bg-coral" />
                </div>
              </Reveal>
              <Reveal className="w-1/3" delay={0.12}>
                <div className="pp-slide aspect-[4/5] rotate-1 rounded-3xl bg-card p-3 shadow-lg sm:p-5" style={{ "--d": "0.12s" } as React.CSSProperties}>
                  <p className="mb-2 w-fit rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold sm:text-xs">Rivieren</p>
                  <p className="font-display text-base leading-tight sm:text-2xl">Halloween at Robbeburg</p>
                  <p className="mt-2 text-[11px] font-semibold sm:text-sm">Sat 31 Oct, 9:30–16:15</p>
                </div>
              </Reveal>
              <Reveal className="w-1/3" delay={0.24}>
                <div className="pp-slide aspect-[4/5] -rotate-1 rounded-3xl bg-surface p-3 shadow-lg ring-1 ring-ink/10 sm:p-5" style={{ "--d": "0.24s" } as React.CSSProperties}>
                  <p className="mb-2 w-fit rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold sm:text-xs">De Pijp</p>
                  <p className="font-display text-base leading-tight sm:text-2xl">Mama+ Club Halloween Meetup</p>
                  <p className="mt-2 text-[11px] font-semibold sm:text-sm">Mon 26 Oct, 9:30–12:30</p>
                </div>
              </Reveal>
            </div>
          </Stop>

          {/* 5 */}
          <Stop label="What it won't do">
            <Reveal>
              <div className="relative max-w-2xl rotate-1 rounded-[2rem] bg-blush p-7 sm:p-9">
                <span aria-hidden className="absolute -top-3 right-12 h-6 w-24 -rotate-3 rounded-sm bg-honey/80" />
                <h2 className="mb-4 text-3xl leading-tight sm:text-4xl">Drafts only. Always.</h2>
                <p className="text-lg leading-relaxed">
                  Nothing goes out unless <em>you</em> press the button in Buffer. And there&rsquo;s no AI inventing things: it only uses the words you already
                  wrote. Which is the point, because those are the words your readers clicked.
                </p>
              </div>
            </Reveal>
          </Stop>

          {/* 6 */}
          <Stop label="The person behind it">
            <Reveal>
              <h2 className="mb-8 max-w-2xl text-3xl leading-tight sm:text-4xl">Built by a fellow newsletter creator desperate to spend more time writing, less time posting</h2>
              <div className="grid max-w-4xl items-center gap-8 md:grid-cols-[250px_1fr]">
                <div className="relative mx-auto w-full max-w-[250px]">
                  <span aria-hidden className="absolute -left-3 -top-3 size-full -rotate-6 bg-accent [border-radius:58%_42%_55%_45%/45%_55%_45%_55%]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/alex.jpg"
                    alt="Alex, founder of Amsterdam Parent Project, smiling at home"
                    width={720}
                    height={720}
                    className="relative aspect-square w-full object-cover [border-radius:45%_55%_42%_58%/55%_45%_55%_45%]"
                  />
                  <span aria-hidden className="absolute -bottom-2 -right-2 size-8 rounded-full bg-coral" />
                </div>
                <div>
                  <p className="text-lg leading-relaxed">
                    Hi, I&rsquo;m Alex 👋 I&rsquo;m a toddler mom in Amsterdam, a tech industry veteran, and the founder of{" "}
                    <a href="https://amsterdamparentproject.nl" className="font-semibold underline decoration-[3px] underline-offset-[7px] hover:decoration-coral">
                      Amsterdam Parent Project
                    </a>
                    , a nonprofit building community infrastructure for new parents. For two years I&rsquo;ve published a local, new parent activities digest, and every issue used to
                    cost me 6 hours in my newsletter editor and 2 more hours to cross-post that content to Instagram. I built Pollen Picks so that the best newsletter
                    content cross-pollinates to socials, without more work from me.{" "}
                    <strong>No AI — just delivering more value to more places using the words I&rsquo;ve already written.</strong>
                  </p>
                </div>
              </div>
            </Reveal>
          </Stop>

          {/* 7: the bloom */}
          <Stop label="And then" className="pb-12">
            <Reveal>
              <div className="relative max-w-2xl">
                <Bloom />
                <h2 className="mb-4 text-3xl leading-tight sm:text-5xl">
                  Let the best of your newsletter <Squiggle>travel.</Squiggle>
                </h2>
                <p className="mb-6 text-lg leading-relaxed">Try the demo, or log in and bring your own issue.</p>
                <AuthLink className={cta} loggedOut="Log in with Buffer" loggedIn="Continue to the app" />
                <p className="mt-8 mb-2 text-sm font-semibold">People use it for</p>
                <ul className="flex flex-wrap gap-2">
                  {["Activities digests", "Public newsletter summaries", "Best-of recaps", "Curated link roundups"].map((u, i) => (
                    <li key={u} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${["bg-accent", "bg-card", "bg-chip/70", "bg-surface ring-1 ring-ink/10"][i]}`}>
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </Stop>
        </PathRail>
      </div>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm">
        <span>{BRAND_NAME}, built for Buffer Commit 2026.</span>
        <AuthLink className="font-semibold underline decoration-[3px] underline-offset-[7px] hover:decoration-coral" loggedOut="Log in with Buffer" loggedIn="Continue to the app" />
      </footer>
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
    <div aria-hidden className="absolute -top-2 right-0 hidden size-28 sm:block">
      <svg viewBox="-50 -50 100 100" className="size-full overflow-visible">
        {dots.map(({ x, y, i }) => (
          <g key={i}>
            <line x1="0" y1="0" x2={x} y2={y} stroke="#2b3a36" strokeWidth="1.5" strokeLinecap="round" />
            <circle className="pp-bloom-dot" cx={x} cy={y} r={i === 2 ? 7 : 6} fill={i === 2 ? "#f28482" : "#f6bd60"} style={{ "--d": `${0.3 + i * 0.05}s`, transformBox: "fill-box", transformOrigin: "center" } as React.CSSProperties} />
          </g>
        ))}
        <circle r="6" fill="#2b3a36" />
      </svg>
    </div>
  );
}

/** The coral hand-drawn underline from the headline, reused for emphasis. It draws itself in when its section scrolls into view. */
function Squiggle({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <svg aria-hidden viewBox="0 0 220 24" preserveAspectRatio="none" className="pp-squig absolute -bottom-3 left-0 h-4 w-full overflow-visible">
        <path d="M3 14 C 40 3 70 22 110 12 S 180 4 217 13" fill="none" stroke="#f28482" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  );
}
