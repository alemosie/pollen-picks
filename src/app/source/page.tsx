import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StepAside } from "@/components/StepTree";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Choose your setup · Pollen Picks" };

export default function Start() {
  return (
    <Suspense fallback={null}>
      <StartContent />
    </Suspense>
  );
}

async function StartContent() {
  await connection();
  await requireSession("/source");

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-12 flex items-center justify-between">
        <Logo height={52} />
        <a href="/api/auth/buffer/logout" className="text-sm font-semibold underline underline-offset-4">
          Log out
        </a>
      </header>

      <StepAside current={2} hrefs={{ 1: "/" }} />
      <div className="mb-10">
      <h1 className="mb-3 text-4xl sm:text-5xl">Choose your newsletter source</h1>
      <p className="mb-0 max-w-2xl text-lg">Buffer is connected. Now choose where the content comes from. You can switch any time.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card
          tone="bg-accent"
          title="Demo"
          tag="Fastest"
          body="A real newsletter issue with real click data. No Beehiiv needed. Drafts still go to your Buffer, labeled as demo."
          cta={
            <Link href="/pick?mode=demo" className="block rounded-xl bg-ink px-5 py-3 text-center font-bold text-cream hover:bg-ink-deep">
              Start the demo
            </Link>
          }
        />
        <Card
          tone="bg-card"
          title="Public newsletter"
          tag="Next up"
          body="Paste any Beehiiv newsletter URL and pick from its latest issue. Click ranking is unavailable without the owner's key."
          cta={<Disabled label="Coming soon" />}
        />
        <Card
          tone="bg-surface ring-1 ring-ink/15"
          title="Your newsletter"
          tag="Next up"
          body="Connect your own Beehiiv API key to unlock top-click ranking and every issue in your archive."
          cta={<Disabled label="Coming soon" />}
        />
      </div>
    </main>
  );
}

function Card({ tone, title, tag, body, cta }: { tone: string; title: string; tag: string; body: string; cta: React.ReactNode }) {
  return (
    <section className={`flex flex-col gap-4 rounded-2xl p-6 ${tone}`}>
      <p className="w-fit rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold">{tag}</p>
      <h2 className="text-2xl">{title}</h2>
      <p className="flex-1 leading-relaxed">{body}</p>
      {cta}
    </section>
  );
}

function Disabled({ label }: { label: string }) {
  return (
    <span aria-disabled className="block cursor-not-allowed rounded-xl border-2 border-dashed border-ink/30 px-5 py-3 text-center font-semibold text-ink/60">
      {label}
    </span>
  );
}
