import { AuthLink } from "@/components/AuthLink";
import { Logo } from "@/components/Logo";
import { BRAND_NAME } from "@/lib/brand";
import { loadDemoIssue } from "@/lib/demo";

const STEPS = [
  { n: "1", title: "Pick", body: "Choose what to share: your top-clicked picks, a whole section, or any paragraph or bullet from the issue." },
  { n: "2", title: "Create", body: "Get a ready carousel for Instagram and LinkedIn with captions, tags and alt text. Tweak the template once, reuse it forever." },
  { n: "3", title: "Review in Buffer", body: "Everything lands as a draft in your Buffer. You review, schedule, or toss it. Nothing is ever published for you." },
];

export default function Home() {
  // Real click data from the demo issue (read at build time).
  const top = loadDemoIssue()
    .chunks.filter((c) => c.rank && c.score != null)
    .sort((a, b) => a.rank! - b.rank!)
    .slice(0, 6);
  const max = Math.max(...top.map((c) => c.score!));
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo height={56} />
        <AuthLink className="rounded-xl px-4 py-2 text-sm font-semibold underline-offset-4 hover:underline" loggedOut="Log in" loggedIn="Open app" />
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div className="flex flex-col gap-6">
          <p className="w-fit rounded-full bg-chip px-3 py-1 text-sm font-semibold text-ink-deep">Newsletter to Buffer drafts</p>
          <h1 className="text-5xl leading-[1.05] sm:text-6xl">
            From picks to posts<span className="text-coral">.</span>
          </h1>
          <p className="max-w-xl text-xl leading-relaxed">
            Pollen Picks reads your Beehiiv issue, finds what your readers actually clicked, and turns the best bits into carousels and captions, saved as
            drafts in Buffer. You review. You schedule.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <AuthLink className="rounded-xl bg-accent px-7 py-3.5 text-lg font-bold text-ink-deep shadow-sm transition hover:brightness-95 focus-visible:outline-offset-4" loggedOut="Log in with Buffer" loggedIn="Continue to the app" />
            <span className="text-sm">Free to try. Includes a demo, no Beehiiv needed.</span>
          </div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <span aria-hidden className="size-2.5 rounded-full bg-sage" />
            Drafts only. We never publish to your channels.
          </p>
        </div>

        <Preview />
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="mb-10 text-3xl sm:text-4xl">Three steps. Zero copy-paste.</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl bg-card p-6">
                <span className="mb-4 grid size-10 place-items-center rounded-full bg-accent font-display text-lg text-ink-deep">{s.n}</span>
                <h3 className="mb-2 text-2xl">{s.title}</h3>
                <p className="leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-4">
          <p className="w-fit rounded-full bg-accent px-3 py-1 text-sm font-bold text-ink-deep">The click-data approach</p>
          <h2 className="text-3xl sm:text-4xl">Your readers already told you what to post.</h2>
          <p className="text-lg leading-relaxed">
            Pollen Picks reads your Beehiiv click data and ranks every link by how many readers actually clicked it. Because it&rsquo;s what your audience
            has already said they&rsquo;re most interested in, it&rsquo;s the content with the highest chance of extending your reach.
          </p>
          <p className="text-lg leading-relaxed">No guessing, no gut feel on a Sunday night. The readers vote with their thumbs, and the top picks become your posts.</p>
        </div>
        <figure className="rounded-3xl bg-surface p-5 ring-1 ring-ink/10 sm:p-7">
          <figcaption className="mb-4 flex items-baseline justify-between gap-4">
            <span className="font-display text-xl">Most clicked in the issue</span>
            <span className="text-xs font-semibold">Real data from a demo issue</span>
          </figcaption>
          <ol className="flex flex-col gap-3">
            {top.map((c, i) => (
              <li key={c.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm font-semibold">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 font-display text-ink/60">#{c.rank}</span>
                    {c.title}
                  </span>
                  <span className="shrink-0">{c.score} clicks</span>
                </div>
                <div className="h-3 rounded-full bg-cream">
                  <div className={`h-full rounded-full ${i < 4 ? "bg-accent" : "bg-card"}`} style={{ width: `${Math.round((c.score! / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs font-semibold text-ink/70">The top picks go into your carousel.</p>
        </figure>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="mb-10 text-3xl sm:text-4xl">What people use it for</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <article className="rounded-2xl bg-card p-7">
              <p className="mb-3 font-display text-lg text-ink/60">Use case 1</p>
              <h3 className="mb-3 text-2xl">Activities digest</h3>
              <p className="leading-relaxed">
                Tag the event organizers in your posts so their reach is amplified too. A win-win for your audience and for the organizers who support them.
              </p>
            </article>
            <article className="rounded-2xl bg-accent p-7">
              <p className="mb-3 font-display text-lg text-ink/60">Use case 2</p>
              <h3 className="mb-3 text-2xl">Public newsletter summarizer</h3>
              <p className="leading-relaxed">
                Want to share something someone else wrote with your channels? Use the public newsletter mode to generate posts from any public Beehiiv
                newsletter, with credit to its author.
              </p>
            </article>
            <article className="rounded-2xl bg-chip p-7">
              <p className="mb-3 font-display text-lg text-ink-deep">Use case 3</p>
              <h3 className="mb-3 text-2xl">Best-of recap</h3>
              <p className="leading-relaxed">
                Resurface what your readers loved most. Pull the top-clicked items from past issues into a &ldquo;readers&rsquo; favorites&rdquo; post, so great
                content keeps working long after the send.
              </p>
            </article>
            <article className="rounded-2xl bg-cream p-7 ring-1 ring-ink/15">
              <p className="mb-3 font-display text-lg text-ink/60">Use case 4</p>
              <h3 className="mb-3 text-2xl">Curated link roundups</h3>
              <p className="leading-relaxed">
                Share a &ldquo;worth reading this week&rdquo; list? Turn the most-clicked links in your issue into slides that send people straight to the good
                stuff.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-[320px_1fr] md:gap-16">
        <div className="relative mx-auto w-full max-w-[320px]">
          <span aria-hidden className="absolute -left-3 -top-3 size-full rotate-[-4deg] rounded-[2rem] bg-accent" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/alex.jpg"
            alt="Alex, founder of Amsterdam Parent Project, smiling at home"
            width={720}
            height={720}
            className="relative aspect-square w-full rounded-[2rem] object-cover"
          />
          <span aria-hidden className="absolute -bottom-2 -right-2 size-8 rounded-full bg-coral" />
        </div>
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-wide">The person behind it</p>
          <h2 className="mb-4 text-3xl sm:text-4xl">Built by a fellow newsletter creator desperate to spend more time writing, less time posting</h2>
          <p className="text-lg leading-relaxed">
            Hi, I&rsquo;m Alex 👋 I&rsquo;m a toddler mom in Amsterdam, a tech industry veteran, and the founder of{" "}
            <a href="https://amsterdamparentproject.nl" className="font-semibold underline underline-offset-4">
              Amsterdam Parent Project
            </a>
            , a nonprofit building community infrastructure for new parents. For two years I&rsquo;ve published a local, new parent activities digest, and every issue used to
            cost me 6 hours in my newsletter editor and 2 more hours to cross-post that content to Instagram. I built Pollen Picks so that the best newsletter
            content cross-pollinates to socials, without more work from me.{" "}
            <strong>No AI — just delivering more value to more places using the words I&rsquo;ve already written.</strong>
          </p>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm">
        <span>
          {BRAND_NAME}, built for Buffer Commit 2026.
        </span>
        <AuthLink className="font-semibold underline underline-offset-4" loggedOut="Log in with Buffer" loggedIn="Continue to the app" />
      </footer>
    </main>
  );
}

/** A decorative carousel mock: the first slides of a "This week's picks" post. */
function Preview() {
  return (
    <div aria-hidden className="relative mx-auto h-[420px] w-full max-w-md sm:h-[480px]">
      <div className="absolute right-0 top-8 h-[340px] w-[270px] rotate-6 rounded-3xl bg-card p-6 shadow-lg sm:h-[400px] sm:w-[310px]">
        <p className="mb-2 w-fit rounded-full bg-chip px-2.5 py-0.5 text-xs font-bold text-ink-deep">Rivieren</p>
        <p className="font-display text-2xl leading-tight">Halloween at Robbeburg</p>
        <p className="mt-3 text-sm font-semibold">Sat 31 Oct, 9:30-16:15</p>
      </div>
      <div className="absolute left-4 top-16 h-[340px] w-[270px] -rotate-3 rounded-3xl bg-surface p-6 shadow-lg ring-1 ring-ink/10 sm:h-[400px] sm:w-[310px]">
        <p className="mb-2 w-fit rounded-full bg-chip px-2.5 py-0.5 text-xs font-bold text-ink-deep">De Pijp</p>
        <p className="font-display text-2xl leading-tight">Mama+ Club Halloween Meetup</p>
        <p className="mt-3 text-sm font-semibold">Mon 26 Oct, 9:30-12:30</p>
      </div>
      <div className="absolute bottom-0 left-0 h-[340px] w-[270px] rounded-3xl bg-accent p-6 shadow-xl sm:h-[400px] sm:w-[310px]">
        <p className="text-sm font-bold uppercase tracking-wide">Just a Phase</p>
        <p className="mt-4 font-display text-4xl leading-none">This week&rsquo;s top picks</p>
        <p className="mt-4 text-sm font-semibold">Swipe for 5 things to do with your little one</p>
        <span className="absolute bottom-6 right-6 size-5 rounded-full bg-coral" />
      </div>
    </div>
  );
}
