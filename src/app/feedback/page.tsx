import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StepWord } from "@/components/StepWord";

const FORM_PAGE =
  "https://docs.google.com/forms/d/e/1FAIpQLSfLwdKrhxmvs_HYoOWfh-2GJXzcJyMi-YpcPJ2Kc7X6VaJwtg/viewform";
const FORM = `${FORM_PAGE}?embedded=true`;

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
        Pollen Picks is a work in progress! I&rsquo;d love to hear your thoughts
        to guide its build. It goes straight to me, Alex 👋🏻
      </p>
      <iframe
        title="Pollen Picks feedback form"
        src={FORM}
        className="block h-[1500px] w-full rounded-2xl border-0 bg-surface sm:h-[1250px]"
      >
        Loading…
      </iframe>
      <p className="mt-4 mb-0 text-sm">
        Form not showing?{" "}
        <a
          href={FORM_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline underline-offset-4"
        >
          Open it in a new tab
        </a>
        .
      </p>
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
