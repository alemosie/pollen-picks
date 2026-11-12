import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { StepWord } from "@/components/StepWord";
import { WhatItDoes } from "@/components/WhatItDoes";
import { Reveal } from "@/components/path/PollenPath";

export const metadata = {
  title: "About · Pollen Picks",
  description: "Pollen Picks turns a newsletter or blog post into a carousel for your social channels, saved in Buffer. Why I built it, how it works, and what I'm proudest of.",
};

// Copy style: "beehiiv" is always lowercase. Nothing about Buffer is claimed unless it has been tried against real Buffer.
// Look: the same chunky mats, stickers and coral squiggles as the "Words in, posts out" carousel (components/WhatItDoes.tsx).

const narrow = "mx-auto max-w-3xl px-6";
const wide = "mx-auto max-w-5xl px-6";
const prose =
  "space-y-3 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-cream [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-3 [&_ul]:pl-0";
const cta =
  "inline-block rounded-2xl bg-accent px-5 py-3 text-base font-bold text-ink-deep shadow-sm transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-offset-4 sm:px-7 sm:py-3.5 sm:text-lg";
const ctaAlt =
  "inline-block rounded-2xl px-5 py-3 text-base font-bold text-ink-deep ring-2 ring-ink transition hover:-translate-y-0.5 hover:bg-ink/5 focus-visible:outline-offset-4 sm:px-7 sm:py-3.5 sm:text-lg";
const h2 = "mb-10 text-center text-3xl leading-tight sm:text-5xl";

type Tone = "honey" | "blush" | "sage" | "coral";
/** Brand colours as a thick mat with a half-strength hard shadow. Literal class names, so Tailwind finds them. */
const TONES: Record<Tone, { mat: string; sticker: string; blob: string }> = {
  honey: { mat: "bg-honey shadow-[7px_7px_0_0_#f6bd6080]", sticker: "border-honey", blob: "bg-honey" },
  blush: { mat: "bg-blush shadow-[7px_7px_0_0_#f5cac380]", sticker: "border-blush", blob: "bg-blush" },
  sage: { mat: "bg-sage shadow-[7px_7px_0_0_#84a59d80]", sticker: "border-sage", blob: "bg-sage" },
  coral: { mat: "bg-coral shadow-[7px_7px_0_0_#f2848280]", sticker: "border-coral", blob: "bg-coral" },
};

/** A card in the carousel's style: a thick coloured mat around a cream panel, with a label stuck on its top edge like a sticker. */
function Mat({ tone, label, tilt = "", className = "", children }: { tone: Tone; label: string; tilt?: string; className?: string; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <div className={`relative min-w-0 rounded-[2rem] p-3 sm:p-4 ${t.mat} ${tilt} ${className}`}>
      <span className={`absolute -top-5 left-6 -rotate-3 rounded-full border-[3px] ${t.sticker} bg-surface px-5 py-1 font-display text-lg leading-tight`}>
        {label}
      </span>
      <div className="h-full rounded-2xl bg-surface p-5 pt-8 sm:p-6 sm:pt-9">{children}</div>
    </div>
  );
}

const STEPS = [
  {
    title: "Choose a post",
    body: "Connect your beehiiv newsletter, or paste a link to any public post (beehiiv, Substack or a blog) and highlight what you want to share.",
  },
  {
    title: "Pick",
    body: "For a connected beehiiv issue, the links your readers actually clicked are ranked first, from beehiiv’s own click data.",
  },
  {
    title: "Design",
    body: "Your picks become slides, in your colors, fonts and logo. Use the standard layout or build your own slides.",
  },
  {
    title: "Write",
    body: "Edit the caption with each network’s limit shown as you type. Instagram accounts get credited.",
  },
  {
    title: "Send",
    body: "Preview each channel, then save drafts in Buffer, or send now.",
  },
];
const STEP_TONES: Tone[] = ["honey", "blush", "sage", "coral", "honey"];
const BLOBS = [
  "[border-radius:58%_42%_55%_45%/45%_55%_45%_55%]",
  "[border-radius:45%_55%_42%_58%/55%_45%_55%_45%]",
];

/** The Behind the Desk notes about this build. They live on the APP site (data/stories/behind-the-desk). */
const NOTES = [
  {
    n: "03",
    tone: "honey" as Tone,
    date: "30 October 2026",
    title: "Celebrating 1000 subscribers by throwing my hat into a $25,000 ring",
    summary:
      "Two years of every-other-Monday newsletters, a Halloween Instagram carousel that showed me what I’m missing, and why I’m building a tool for Buffer’s build contest.",
  },
  {
    n: "04",
    tone: "blush" as Tone,
    date: "9 November 2026",
    title: "Where did it go? Why Send now changed my whole Pollen Picks build plan",
    summary:
      "I only planned to save drafts in Buffer. Then I hit Send now, panicked, and ended up building my first queue.",
  },
  {
    n: "05",
    tone: "sage" as Tone,
    date: "10 November 2026",
    title: "I need it to be free: Building Pollen Picks the nonprofit way",
    summary:
      "It costs me nothing to run and costs you nothing to use. Three trades kept it free (no AI, almost no storage, no cron), and each one has a cost.",
  },
  {
    n: "06",
    tone: "coral" as Tone,
    date: "12 November 2026",
    title: "A health psychologist, toy store owner, and podcaster try out a newsletter-to-social tool…",
    summary:
      "I asked 12 people with very different backgrounds to try Pollen Picks. Here\u2019s what I learned from them, and how I made the product better.",
  },
];

const NOTES_URL = "https://amsterdamparentproject.nl/stories/behind-the-desk";

/** "Parts of the build I'm proud of": one card each. Numbers: BACKOFF_SECONDS (lib/sendQueue.ts), ALT_MAX (lib/slides/alt.ts), IMAGE_LIMITS and IMAGE_BYTE_LIMITS (lib/channels.ts). */
const PROUD: { tag: string; tone: Tone; wide?: boolean; title: string; body: ReactNode }[] = [
  {
    tag: "Free",
    tone: "honey",
    title: "Free to run, free to use",
    body: (
      <p>
        Everything runs on free tiers, and the words are parsed with plain rules instead of AI, so it costs me nothing to run and costs you nothing to
        use. It turns out you don't need AI to create carousels and captions made from your own words. Every trade I made to keep it free is in{" "}
        <a href={`${NOTES_URL}/05`} target="_blank" rel="noopener noreferrer">
          Behind the Desk #5
        </a>
        .
      </p>
    ),
  },
  {
    tag: "Any text",
    tone: "blush",
    title: "It reads any text, not just beehiiv",
    body: (
      <p>
        This started out as a beehiiv to Buffer tool, and quickly became way more powerful — a reverse scope creep. A connected beehiiv issue gets its links ranked by what your readers clicked. For everything else (Substack, a blog, any public page) you
        highlight what you want to share, or tap + to take a whole paragraph. The parser was tested on four real newsletter layouts as well as mine.
      </p>
    ),
  },
  {
    tag: "Buffer",
    tone: "sage",
    wide: true,
    title: "Talking to Buffer, so you know where your work went",
    body: (
      <>
        <p>
          Every channel of a send is its own row in a queue, and each row ends in a status you can read. I built it after I hit Send now on my real
          LinkedIn and couldn&rsquo;t tell whether it had gone out (
          <a href={`${NOTES_URL}/04`} target="_blank" rel="noopener noreferrer">
            the full story
          </a>
          ).
        </p>
        <ul className="!space-y-2 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1">
          <li>
            <b>Rate limits wait.</b> On &ldquo;too many requests&rdquo;, nothing was created, so the post is tried again after 20, 40, 80, 160 and
            then 300 seconds.
          </li>
          <li>
            <b>Unclear means unknown, never a retry.</b> After a timeout or server error the post may exist, so it is marked <i>unknown</i> and you
            check in Buffer. That is how nothing goes out twice.
          </li>
          <li>
            <b>Refusals in Buffer&rsquo;s own words,</b> on that channel&rsquo;s row. It doesn't block the other channels from posting.
          </li>
        </ul>
      </>
    ),
  },
  {
    tag: "Fake mode",
    tone: "coral",
    title: "Buffer on a bad day",
    body: (
      <p>
        I only have Instagram and LinkedIn, so I built a fake Buffer that behaves like a very busy social media manager on a bad day: it rejects a
        post, lets a request die so you can&rsquo;t tell if the post exists, accepts a post and then can&rsquo;t publish it, and rate limits. It also
        serves long channel lists, locked and disconnected channels, and every network&rsquo;s caption and image limits. It tested the resilience, and it
        showed me the experience for people whose setup is nothing like mine.
      </p>
    ),
  },
  {
    tag: "Alt text",
    tone: "blush",
    title: "Accessibility",
    body: (
      <p>
        Every slide image goes to Buffer with alt text taken from the words on the slide (no AI, nothing rewritten), trimmed to 200 characters — plus a surfaced fallback if the network rejects the post because of alt text. The
        carousels work with the arrow keys and I respect reduced-motion settings. I audited the pages with Lighthouse on desktop and mobile, and every one scored
        96 to 100 for accessibility.
      </p>
    ),
  },
  {
    tag: "Slides",
    tone: "honey",
    title: "Slides you can make your own",
    body: (
      <p>
        A slide builder that is a delight to use and powerful enough to build your own slides. Bring your colors, fonts, organization name and logo, and
        pull images in from the links you pick.
      </p>
    ),
  },
  {
    tag: "Networks",
    tone: "sage",
    title: "Different networks, within a hackathon’s time",
    body: (
      <p>
        Instagram takes 10 images, X takes 4 and Bluesky wants each under 1 MB, so the Design step shows which slides each network gets and Bluesky
        gets smaller JPEGs. LinkedIn can take a swipeable PDF. The trade I made: every network gets the same slide shape for now.
      </p>
    ),
  },
];

export default function About() {
  return (
    <main className="overflow-x-clip pb-24 pt-6">
      <header className={`${narrow} mb-10 flex items-center justify-between gap-6 sm:mb-14`}>
        <Logo height={48} href="/" />
        <Link href="/login" className="text-sm font-semibold underline underline-offset-4">
          Log in
        </Link>
      </header>

      {/* About Pollen Picks */}
      <section aria-labelledby="a-about" className={`${narrow} mb-20 sm:mb-28`}>
        <h1 id="a-about" className="mb-6 text-center text-4xl sm:text-6xl">
          About <StepWord>Pollen Picks</StepWord>
        </h1>
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
          {/* Like the demo banner: a flat coloured box with a small badge, here the Pollen Picks logo. */}
          <div className="mb-5 flex flex-col items-center gap-4 rounded-2xl bg-blush px-6 py-5 sm:flex-row sm:gap-6 sm:px-8 sm:py-6 sm:text-left">
            <span className="shrink-0 rounded-2xl bg-cream px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/pollen-picks-logo-light.svg" alt="Pollen Picks" width={404} height={608} className="h-16 w-auto sm:h-20" />
            </span>
            <p className="m-0 text-balance font-display text-2xl leading-snug sm:text-3xl">
              Pollen Picks transforms a newsletter or blog into a ready-made post for social media.
            </p>
          </div>
          <p className="m-0 text-balance text-lg leading-relaxed sm:text-xl">
            Cross-pollinate your content from newsletters to socials. What gets posted is what you already wrote — what your subscribers love and your socials followers will love.{" "}
            <span className="pp-mark font-bold">There is no AI under the hood</span> &mdash; it&rsquo;s free to run and free to use.
          </p>
        </div>
        {/* The photo floats, so the text wraps around it and then runs the full width, with no empty column below. */}
        <div className="flow-root">
          <div className="relative mx-auto mb-8 ml-2 w-44 sm:float-left sm:mb-3 sm:mr-8 sm:mt-1">
            <span aria-hidden className="absolute -left-2 -top-2 size-full -rotate-6 bg-accent [border-radius:58%_42%_55%_45%/45%_55%_45%_55%]" />
            <span aria-hidden className="absolute -bottom-2 -right-2 size-8 rounded-full bg-coral" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/alex.jpg"
              alt="Alex, founder of Amsterdam Parent Project, smiling at home"
              width={720}
              height={720}
              className="relative aspect-square w-full object-cover [border-radius:45%_55%_42%_58%/55%_45%_55%_45%]"
            />
          </div>
          <div className={`${prose} text-lg leading-relaxed`}>
            <p>
              It started out with a pain point. I&rsquo;m the solo founder of <a href="https://amsterdamparentproject.nl/">Amsterdam Parent Project</a>,
              a nonprofit building community infrastructure for new parents. Every other Monday I publish <i>Just a Phase</i>, a local activities
              digest. An issue used to take me 6+ hours to write, and the cross-post to Instagram (another 1.5 hours) rarely happened because I just
              didn&rsquo;t have the time. When it did, it was to amazing results — one carousel alone brought{" "}
              <span className="pp-mark font-bold">95 new subscribers</span> (almost a 10% lift), a ton of new Instagram followers, new local
              organizations to partner with, and about 3 times the reach of my other posts.
            </p>
            <p>
              Pollen Picks is the way that the community work I do gets more visibility &mdash; benefitting not only my organization, but also the local
              organizations we feature and the new parents we serve. I&rsquo;ll keep using it for my own workflow after the contest &mdash; but
              I&rsquo;ve built it so that any newsletter or longform content creator can cross-pollinate from their newsletter to socials, too.
            </p>
            <p className="flex flex-wrap gap-3 pt-2 [&_a]:!no-underline">
              <Link href="/demo/source" className={cta}>
                Try the demo
              </Link>
              <Link href="/feedback" className={ctaAlt}>
                Tell me what you think
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="a-how" className={`${narrow} mb-20 sm:mb-28`}>
        <Reveal>
          <h2 id="a-how" className={`${h2} !mb-3`}>
            How it <span className="pp-squig">works</span>
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-balance text-center text-lg">
            Five steps from a post to your channels. Built for activities digests, link roundups, best-of recaps, blog posts and weekly newsletters.
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          {/* The dotted twig runs behind the numbers, like the branch on the home page. */}
          <ol className="relative space-y-7 before:absolute before:bottom-6 before:left-7 before:top-6 before:border-l-4 before:border-dotted before:border-coral/70">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex items-start gap-5">
                <span
                  aria-hidden
                  className={`relative grid size-14 shrink-0 place-items-center font-display text-2xl text-ink-deep shadow-[4px_4px_0_0_#2b3a3626] ${TONES[STEP_TONES[i]].blob} ${BLOBS[i % 2]}`}
                >
                  {i + 1}
                </span>
                <div className="pt-1">
                  <h3 className="mb-1 text-2xl">{s.title}</h3>
                  <p className="m-0 text-lg">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* Built for Buffer Commit */}
      <section aria-labelledby="a-contest" className={`${narrow} mb-20 sm:mb-28`}>
        <Reveal>
          <h2 id="a-contest" className={h2}>
            Built for <span className="pp-squig">Buffer Commit</span>
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <Mat tone="sage" label="28 Oct – 13 Nov 2026" tilt="md:-rotate-1">
            <div className={`${prose} text-lg`}>
              <p>
                Pollen Picks was built between 28 October and 13 November 2026 for <a href="https://buffer.com/api/commit" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Buffer Commit</a>, Buffer&rsquo;s build contest for apps on its API.
              </p>
            </div>
          </Mat>
        </Reveal>
      </section>

      {/* Parts of the build I'm proud of */}
      <section aria-labelledby="a-proud" className={`${wide} mb-20 sm:mb-28`}>
        <Reveal>
          <h2 id="a-proud" className={h2}>
            Parts of the build <span className="pp-squig">I&rsquo;m proud of</span>
          </h2>
        </Reveal>
        <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
          {PROUD.map((p, i) => (
            <li key={p.title} className={p.wide ? "sm:col-span-2" : ""}>
              <Reveal delay={0.04} className="h-full">
                <Mat tone={p.tone} label={p.tag} tilt={i % 2 ? "md:rotate-1" : "md:-rotate-1"} className="h-full">
                  <h3 className="mb-2 text-xl leading-snug sm:text-2xl">{p.title}</h3>
                  <div className={`${prose} text-base sm:text-lg`}>{p.body}</div>
                </Mat>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* Read more */}
      <section aria-labelledby="a-more" className={`${wide} mb-16`}>
        <Reveal>
          <h2 id="a-more" className={`${h2} !mb-3`}>
            Read <span className="pp-squig">more</span>
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-balance text-center text-lg">
            Behind the Desk is where I write founder&rsquo;s notes about running Amsterdam Parent Project: what worked, what broke and what I got
            wrong. These four are about this build.
          </p>
        </Reveal>
        <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
          {NOTES.map((n, i) => (
            <li key={n.n} className="flex">
              <a
                href={`${NOTES_URL}/${n.n}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full transition hover:-translate-y-1 focus-visible:outline-offset-4"
              >
                <Mat tone={n.tone} label={`Behind the Desk #${Number(n.n)}`} tilt={i % 2 ? "md:rotate-1" : "md:-rotate-1"} className="h-full">
                  <span className="mb-2 block text-sm font-semibold">{n.date}</span>
                  <span className="mb-3 block font-display text-xl leading-snug">{n.title}</span>
                  <span className="mb-4 block text-base">{n.summary}</span>
                  <span className="inline-flex items-center gap-1 font-bold underline underline-offset-4">
                    Read the note <ArrowUpRight aria-hidden className="size-4" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </Mat>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center">
          <a
            href="https://amsterdamparentproject.nl/stories?series=founder-notes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-bold underline decoration-[3px] underline-offset-[7px] hover:decoration-coral"
          >
            All Behind the Desk notes<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </section>

      <p className={narrow}>
        <Link href="/" className="inline-flex items-center gap-2 font-bold underline underline-offset-4">
          <ArrowLeft aria-hidden className="size-4" /> Back to home
        </Link>
      </p>
    </main>
  );
}
