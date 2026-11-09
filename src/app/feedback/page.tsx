import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StepWord } from "@/components/StepWord";
import { FeedbackForm } from "./FeedbackForm";

export const metadata = { title: "Feedback · Pollen Picks" };

export default function Feedback() {
  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-6">
      <header className="mb-10 flex items-center justify-between gap-6 sm:mb-14">
        <Logo height={48} href="/" />
        <Link
          href="/source"
          className="text-sm font-semibold underline underline-offset-4"
        >
          Open the app
        </Link>
      </header>
      <h1 className="mb-3 text-4xl sm:text-5xl">
        Leave us <StepWord>feedback</StepWord>
      </h1>
      <p className="mb-10 max-w-xl text-lg">
        All Pollen Picks feedback goes straight to the builder, Alex 👋🏻
      </p>
      <FeedbackForm />
      <p className="mt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-bold underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="size-4" /> Back to home
        </Link>
      </p>
    </main>
  );
}
