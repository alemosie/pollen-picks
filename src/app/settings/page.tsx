import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { SavedFlash } from "@/components/SavedFlash";
import { StepWord } from "@/components/StepWord";
import { requireSession } from "@/lib/auth";
import { PaletteEditor } from "./PaletteEditor";

export const metadata = { title: "Settings · Pollen Picks" };

export default function Settings() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  await connection();
  await requireSession("/settings");
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
      <header className="mb-10 flex items-center justify-between gap-6 sm:mb-14">
        <Logo height={48} href="/source" />
        <a href="/api/auth/buffer/logout" className="text-sm font-semibold underline underline-offset-4">
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
        <p className="mb-0 max-w-2xl text-lg">Choose the colors you can use for slide backgrounds. In Customize, open any slide to pick one.</p>
      </div>
      <PaletteEditor />
      <p className="mt-10">
        <Link href="/create?mode=demo" className="inline-flex items-center gap-2 font-bold underline underline-offset-4">
          <ArrowLeft aria-hidden className="size-4" /> Back to your carousel
        </Link>
      </p>
    </main>
  );
}
