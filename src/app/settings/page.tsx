import { ArrowLeft, Newspaper, Palette, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApifyConnect } from "@/components/ApifyConnect";
import { BeehiivConnect } from "@/components/BeehiivConnect";
import { BeehiivLogo } from "@/components/BeehiivLogo";
import { ChannelIcon } from "@/components/ChannelIcon";
import { FlowLoader } from "@/components/FlowLoader";
import { Logo } from "@/components/Logo";
import { SavedFlash } from "@/components/SavedFlash";
import { StepWord } from "@/components/StepWord";
import { requireSession } from "@/lib/auth";
import { getApifyConnection, getBeehiivConnection } from "@/lib/connections";
import { lookupAllowance } from "@/lib/instagramHandles";
import { PaletteEditor } from "./PaletteEditor";

export const metadata = { title: "Settings · Pollen Picks" };

/** The sections, in the order the navigator lists them. The first is the default; `?section=` picks another, so each is linkable. */
const SECTIONS: { id: string; label: string; hint: string; icon?: LucideIcon }[] = [
  { id: "newsletter", label: "Newsletter", hint: "Connect beehiiv", icon: Newspaper },
  { id: "instagram", label: "Instagram tagging", hint: "Account lookups" },
  { id: "colors", label: "Slide colors", hint: "Your palette", icon: Palette },
];
const parseSection = (v: string | string[] | undefined) => SECTIONS.find((s) => s.id === (Array.isArray(v) ? v[0] : v))?.id ?? SECTIONS[0].id;

export default function Settings(props: PageProps<"/settings">) {
  return (
    <Suspense fallback={<FlowLoader label="Opening settings…" />}>
      <SettingsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SettingsContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const section = parseSection((await searchParams).section);
  const session = await requireSession(section === SECTIONS[0].id ? "/settings" : `/settings?section=${section}`);
  const current = SECTIONS.find((s) => s.id === section)!;
  return (
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-6">
      <header className="mb-10 flex items-center justify-between gap-6 sm:mb-14">
        <Logo height={48} href="/" />
        <a href="/api/auth/buffer/logout" className="text-sm font-semibold underline underline-offset-4">
          Log out
        </a>
      </header>
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h1 className="mb-3 text-4xl sm:text-5xl">
            <StepWord>Settings</StepWord>
          </h1>
          <div className="flex shrink-0 items-center gap-3 sm:mt-2">
            <SavedFlash />
            <Link
              href="/source"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-surface px-4 py-2.5 font-bold ring-1 ring-ink/15 transition hover:ring-ink/40"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Back to the app
            </Link>
          </div>
        </div>
        <p className="mb-0 max-w-2xl text-lg">Connect your newsletter, set up Instagram tagging and choose your slide colors.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
        {/* A row of tabs on phones, a column on wider screens. Plain links, so each section has its own address and back works. */}
        <nav aria-label="Settings sections" className="min-w-0">
          <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1 md:sticky md:top-6 md:flex-col md:overflow-visible md:pb-0">
            {SECTIONS.map((s) => {
              const on = s.id === section;
              return (
                <li key={s.id} className="shrink-0 md:shrink">
                  <Link
                    href={s.id === SECTIONS[0].id ? "/settings" : `/settings?section=${s.id}`}
                    aria-current={on ? "page" : undefined}
                    scroll={false}
                    className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 font-bold transition md:whitespace-normal ${
                      on ? "bg-ink text-cream" : "bg-surface ring-1 ring-ink/15 hover:ring-ink/40"
                    }`}
                  >
                    {s.icon ? <s.icon aria-hidden className="size-4 shrink-0" strokeWidth={2.25} /> : <ChannelIcon service="instagram" className="size-4 shrink-0" />}
                    <span className="min-w-0">
                      {s.label}
                      <span className={`hidden text-xs font-normal md:block ${on ? "text-cream/80" : "text-ink/70"}`}>{s.hint}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0" aria-label={current.label} role="region">
          {section === "newsletter" && <NewsletterSection userId={session.userId} />}
          {section === "instagram" && <InstagramSection userId={session.userId} />}
          {section === "colors" && <PaletteEditor />}
        </div>
      </div>

    </main>
  );
}

async function NewsletterSection({ userId }: { userId: string }) {
  const beehiiv = await getBeehiivConnection(userId);
  return (
    <section aria-labelledby="beehiiv" className="rounded-2xl bg-card p-6">
      <h2 id="beehiiv" className="mb-1 flex items-center gap-3 text-2xl">
        Connect to <BeehiivLogo title="beehiiv" className="h-6 w-auto" />
      </h2>
      <p className="mb-5 mt-0 text-sm">
        Use your beehiiv API key to pick from your own newsletter.{" "}
        <Link href="/beehiiv/setup" className="font-bold underline underline-offset-4">
          Step-by-step: how to get your key
        </Link>
      </p>
      <BeehiivConnect initial={beehiiv} />
    </section>
  );
}

async function InstagramSection({ userId }: { userId: string }) {
  const [apify, allowance] = await Promise.all([getApifyConnection(userId), lookupAllowance(userId)]);
  const { free, used, unlimited, buffer } = allowance;
  const left = Math.max(0, free - used);
  const plural = (n: number) => `${n} ${n === 1 ? "lookup" : "lookups"}`;
  return (
    <section aria-labelledby="apify" className="rounded-2xl bg-card p-6">
      <h2 id="apify" className="mb-1 text-2xl">
        Instagram tagging
      </h2>
      <p className="mb-4 mt-0 text-sm">
        When a pick links to an Instagram post, Pollen Picks looks up which account owns it, so it can tag them. Each post is looked up once, and a post that
        has been looked up before is free for everyone.
      </p>
      <p role="status" className={`mb-5 mt-0 rounded-xl p-4 text-sm ${unlimited && !apify ? "bg-sage/30" : "bg-surface"}`}>
        {apify ? (
          <>
            <span className="font-bold">Your own Apify token is saved,</span> so new lookups run on it and don&rsquo;t use any of your free ones.
          </>
        ) : unlimited && buffer ? (
          <>
            <span aria-hidden>👋🏻</span> <span className="font-bold">Hi, Buffer friend!</span> Your account has unlimited free lookups, so adding your own token
            is optional.
          </>
        ) : unlimited ? (
          <>
            <span className="font-bold">Your account has unlimited free lookups.</span> Adding your own token is optional.
          </>
        ) : free === 0 ? (
          <>
            <span className="font-bold">There are no free lookups right now.</span> Add your own Apify token to tag Instagram posts.
          </>
        ) : left > 0 ? (
          <>
            <span className="font-bold">
              You get {plural(free)} free. {used === 0 ? "You haven\u2019t used any yet." : `You\u2019ve used ${used}, so ${plural(left)} left.`}
            </span>{" "}
            After that, add your own Apify token to keep tagging.
          </>
        ) : (
          <>
            <span className="font-bold">You&rsquo;ve used all {plural(free)} free.</span> Add your own Apify token to keep tagging new posts. Posts that have
            already been looked up still work.
          </>
        )}
      </p>
      <ApifyConnect initial={apify} />
    </section>
  );
}
