import { Images, LogOut, Newspaper, Palette, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackToApp } from "@/components/BackToApp";
import { ApifyConnect } from "@/components/ApifyConnect";
import { BeehiivConnect } from "@/components/BeehiivConnect";
import { BeehiivLogo } from "@/components/BeehiivLogo";
import { AccountLinks } from "@/components/AccountLinks";
import { ChannelIcon } from "@/components/ChannelIcon";
import { FlowLoader } from "@/components/FlowLoader";
import { Logo } from "@/components/Logo";
import { SavedFlash } from "@/components/SavedFlash";
import { StepWord } from "@/components/StepWord";
import { requireSession } from "@/lib/auth";
import { gql } from "@/lib/buffer";
import { db } from "@/lib/db";
import { getApifyConnection, getBeehiivConnection, withOrganization } from "@/lib/connections";
import { lookupAllowance } from "@/lib/instagramHandles";
import { PaletteSync } from "@/components/PaletteSync";
import { currentSlideSettings, loadLinkedinFormat, loadSlideStyle } from "@/lib/slideStyleStore";
import { resolveSection } from "@/lib/settingsSections";
import { settingsPreviews } from "@/lib/slides/settingsPreview";
import { DEFAULT_STYLE } from "@/lib/slides/style";
import { listPhotoLinks, MAX_PHOTO_LINKS } from "@/lib/userPhotoLinks";
import { DeleteMyData } from "./DeleteMyData";
import { LinkedinFormatEditor } from "./LinkedinFormatEditor";
import { OrganizationEditor } from "./OrganizationEditor";
import { PaletteEditor } from "./PaletteEditor";
import { PhotosManager } from "./PhotosManager";
import { SlideStyleEditor } from "./SlideStyleEditor";

export const metadata = { title: "Settings · Pollen Picks" };

/** The sections, in the order the navigator lists them. The first is the default; `?section=` picks another, so each is linkable. */
const SECTIONS: { id: string; label: string; hint: string; icon?: LucideIcon; /** A network's mark instead of an icon. */ service?: string }[] = [
  { id: "newsletter", label: "Newsletter", hint: "Connect beehiiv", icon: Newspaper },
  { id: "brand", label: "Brand", hint: "Name, logo, colors, slide style", icon: Palette },
  { id: "instagram", label: "Instagram tagging", hint: "Account lookups", service: "instagram" },
  { id: "linkedin", label: "LinkedIn format", hint: "Carousel or images", service: "linkedin" },
  { id: "photos", label: "Photos", hint: "Your saved picture links", icon: Images },
  { id: "account", label: "Account", hint: "Log out", icon: LogOut },
];
// The old names (organization, style, colors) open Brand, where those three now are.
const parseSection = (v: string | string[] | undefined) =>
  resolveSection(
    v,
    SECTIONS.map((s) => s.id),
  );

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
  const { palette } = await currentSlideSettings();
  return (
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-6">
      <PaletteSync palette={palette} />
      <header className="mb-10 flex items-center justify-between gap-6 sm:mb-14">
        <Logo height={48} href="/" />
        <AccountLinks current="settings" />
      </header>
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h1 className="mb-3 text-4xl sm:text-5xl">
            <StepWord>Settings</StepWord>
          </h1>
          <div className="relative flex shrink-0 items-center gap-3 max-sm:mb-4 sm:mt-2">
            <span className="max-sm:absolute max-sm:bottom-full max-sm:right-0 max-sm:mb-1">
              <SavedFlash />
            </span>
            <BackToApp />
          </div>
        </div>
        <p className="mb-0 max-w-2xl text-lg">Connect your newsletter, set up your brand, set up Instagram tagging and choose how LinkedIn gets your slides.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
        {/* A row of tabs on phones, a column on wider screens. Plain links, so each section has its own address and back works. */}
        <nav aria-label="Settings sections" className="min-w-0">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0 md:sticky md:top-6 md:flex-col md:flex-nowrap">
            {SECTIONS.map((s) => {
              const on = s.id === section;
              return (
                <li key={s.id}>
                  <Link
                    href={s.id === SECTIONS[0].id ? "/settings" : `/settings?section=${s.id}`}
                    aria-current={on ? "page" : undefined}
                    scroll={false}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition md:gap-3 md:whitespace-normal md:px-4 md:py-2.5 md:text-base ${
                      on ? "bg-ink text-cream" : "bg-surface ring-1 ring-ink/15 hover:ring-ink/40"
                    }`}
                  >
                    {s.icon ? <s.icon aria-hidden className="size-4 shrink-0" strokeWidth={2.25} /> : <ChannelIcon service={s.service ?? "instagram"} className="size-4 shrink-0" />}
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
          {section === "linkedin" && <LinkedinSection userId={session.userId} />}
          {section === "brand" && <BrandSection userId={session.userId} />}
          {section === "photos" && <PhotosSection userId={session.userId} />}
          {section === "account" && <AccountSection userId={session.userId} token={session.accessToken} />}
        </div>
      </div>

    </main>
  );
}

async function NewsletterSection({ userId }: { userId: string }) {
  const beehiiv = await getBeehiivConnection(userId);
  return (
    <section aria-labelledby="beehiiv" className="rounded-2xl bg-card p-4 sm:p-6">
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
    <section aria-labelledby="apify" className="rounded-2xl bg-card p-4 sm:p-6">
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

async function LinkedinSection({ userId }: { userId: string }) {
  return <LinkedinFormatEditor initial={await loadLinkedinFormat(userId)} />;
}

/** The Buffer account behind this login: asked from Buffer now, with the email saved at login as the fallback. */
async function AccountSection({ userId, token }: { userId: string; token: string }) {
  // The name is asked on its own: Buffer's docs don't list a name on the account, so if it isn't there, only this request fails and the email still shows.
  const [live, named] = await Promise.all([
    gql<{ account: { email?: string | null; organizations?: { id: string; name: string }[] } | null }>(
      token,
      "{ account { email organizations { id name } } }",
      { timeoutMs: 8_000 },
    ).catch(() => null),
    gql<{ account: { name?: string | null } | null }>(token, "{ account { name } }", { timeoutMs: 8_000 }).catch(() => null),
  ]);
  const name = typeof named?.data?.account?.name === "string" ? named.data.account.name.trim() : "";
  const saved = live?.data?.account?.email
    ? null
    : await db().from("users").select("email").eq("id", userId).maybeSingle().then((r) => (typeof r.data?.email === "string" ? r.data.email : null), () => null);
  const email = live?.data?.account?.email ?? saved;
  const orgs = (live?.data?.account?.organizations ?? []).map((o) => o.name).filter(Boolean);
  return (
    <section aria-labelledby="account" className="rounded-2xl bg-card p-4 sm:p-6">
      <h2 id="account" className="mb-1 text-2xl">
        Account
      </h2>
      <dl className="mb-5 mt-4 grid max-w-xl grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
        {name && (
          <>
            <dt className="font-bold">Name</dt>
            <dd className="m-0 min-w-0 break-words">{name}</dd>
          </>
        )}
        <dt className="font-bold">Buffer email</dt>
        <dd className="m-0 min-w-0 break-words">{email ?? "Not available"}</dd>
        {orgs.length > 0 && (
          <>
            <dt className="font-bold">{orgs.length === 1 ? "Organization" : "Organizations"}</dt>
            <dd className="m-0 min-w-0 break-words">{orgs.join(", ")}</dd>
          </>
        )}
      </dl>
      <p className="mb-5 mt-0 text-sm">
        You&rsquo;re logged in through Buffer. Logging out ends your session in this browser. It doesn&rsquo;t delete anything: your settings, your beehiiv key and
        your history are still here when you log back in.
      </p>
      <a
        href="/api/auth/buffer/logout"
        className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 font-bold text-cream hover:brightness-110"
      >
        <LogOut aria-hidden className="size-4" strokeWidth={2.25} />
        Log out
      </a>
      <h3 className="mb-1 mt-8 text-lg">Delete your data</h3>
      <p className="mb-4 mt-0 text-sm">Remove your account and everything stored for it. Anything already in Buffer or beehiiv is left alone.</p>
      <DeleteMyData />
    </section>
  );
}

/** The picture links this user saved for slides, to remove some (they can keep MAX_PHOTO_LINKS). */
async function PhotosSection({ userId }: { userId: string }) {
  const links = await listPhotoLinks(userId).catch(() => null);
  if (!links)
    return (
      <section aria-labelledby="photos" className="rounded-2xl bg-card p-4 sm:p-6">
        <h2 id="photos" className="mb-1 text-2xl">
          Photos
        </h2>
        <p role="alert" className="m-0 text-sm font-semibold">
          Couldn&rsquo;t load your saved links. Try again in a moment.
        </p>
      </section>
    );
  return <PhotosManager initial={links} max={MAX_PHOTO_LINKS} />;
}

/**
 * Brand: what makes the slides yours, in one place. The organization (name and logo), the palette and the slide style used to be three sections; they are
 * its three parts now, and the Design step's "Your brand" strip links here. The organization and the style share the beehiiv lookup, so it is done once.
 */
async function BrandSection({ userId }: { userId: string }) {
  const [saved, conn] = await Promise.all([loadSlideStyle(userId), getBeehiivConnection(userId).then((c) => withOrganization(userId, c)).catch(() => null)]);
  const orgFallback = conn?.publications[0]?.organization;
  return (
    <section aria-labelledby="brand" className="grid gap-8">
      <div>
        <h2 id="brand" className="mb-1 text-2xl">
          Brand
        </h2>
        <p className="m-0 max-w-2xl text-sm">Your name, logo, colors and slide style, in one place. Changes save as you make them and show on every carousel you make.</p>
      </div>
      <OrganizationEditor initialName={saved?.style.orgName ?? ""} initialLogo={saved?.style.orgLogo ?? null} orgFallback={orgFallback} />
      <PaletteEditor />
      <SlideStyleEditor initial={saved?.style ?? DEFAULT_STYLE} previews={settingsPreviews(userId, saved?.version, saved?.palette?.[0])} orgFallback={orgFallback} />
    </section>
  );
}
