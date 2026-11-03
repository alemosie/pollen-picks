import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { Logo } from "@/components/Logo";
import { SavedFlash } from "@/components/SavedFlash";
import { StepWord } from "@/components/StepWord";
import { BeehiivConnect } from "@/components/BeehiivConnect";
import { BeehiivLogo } from "@/components/BeehiivLogo";
import { requireSession } from "@/lib/auth";
import { getBeehiivConnection } from "@/lib/connections";
import { PaletteEditor } from "./PaletteEditor";

export const metadata = { title: "Settings · Pollen Picks" };

export default function Settings() {
  return (
    <Suspense fallback={<FlowLoader label="Opening settings…" />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  await connection();
  const session = await requireSession("/settings");
  const beehiiv = await getBeehiivConnection(session.userId);
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
      <header className="mb-10 flex items-center justify-between gap-6 sm:mb-14">
        <Logo height={48} href="/" />
        <a
          href="/api/auth/buffer/logout"
          className="text-sm font-semibold underline underline-offset-4"
        >
          Log out
        </a>
      </header>
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="mb-3 text-4xl sm:text-5xl">
            <StepWord>Settings</StepWord>
          </h1>
          <div className="mt-2 shrink-0 sm:mt-4">
            <SavedFlash />
          </div>
        </div>
        <p className="mb-0 max-w-2xl text-lg">
          Connect your newsletter and choose the colors you can use for slide
          backgrounds. In Customize, open any slide to pick one.
        </p>
      </div>
      <section aria-labelledby="beehiiv" className="mb-8 rounded-2xl bg-card p-6">
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
      <PaletteEditor />
      <p className="mt-10">
        <Link
          href="/source"
          className="inline-flex items-center gap-2 font-bold underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="size-4" /> Back to the app
        </Link>
      </p>
    </main>
  );
}
