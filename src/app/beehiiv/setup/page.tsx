import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { StepWord } from "@/components/StepWord";

export const metadata = { title: "Get your beehiiv API key · Pollen Picks" };

// Public on purpose: it is linked from Settings and from the source step, and needs no login to read.
// Menu names follow beehiiv's own guide: https://developers.beehiiv.com/docs/v2/bktd9a7mxo67n-create-an-api-key
const steps: { title: string; body: ReactNode }[] = [
  {
    title: "Open your beehiiv API page",
    body: (
      <p>
        Log in at{" "}
        <a href="https://app.beehiiv.com" target="_blank" rel="noopener noreferrer">
          app.beehiiv.com
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        , click <b>Settings</b>, then <b>API</b> under <b>Workspace Settings</b>.
      </p>
    ),
  },
  {
    title: "Create a new key",
    body: <p>Click <b>Create New API Key</b>. beehiiv may ask you to verify your identity first.</p>,
  },
  {
    title: "Limit it to one publication (recommended)",
    body: (
      <p>
        By default a key can reach every publication in your workspace. If you run more than one, limit the key to the
        newsletter you want to share from. Pollen Picks then only sees that one.
      </p>
    ),
  },
  {
    title: "Copy the key right away",
    body: (
      <p>
        beehiiv shows the key once. If you leave the page without copying it, create a new key and delete the old one.
      </p>
    ),
  },
  {
    title: "Paste it into Pollen Picks",
    body: (
      <p>
        Paste it in <Link href="/settings">Settings</Link> or on the <Link href="/source">source step</Link> and press{" "}
        <b>Save key</b>. Pollen Picks checks it with beehiiv, then shows your publication so you can see it worked.
      </p>
    ),
  },
];

export default function BeehiivSetup() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
      <header className="mb-10 flex items-center justify-between gap-6 sm:mb-14">
        <Logo height={48} href="/" />
        <Link href="/settings" className="text-sm font-semibold underline underline-offset-4">
          Settings
        </Link>
      </header>

      <h1 className="mb-3 text-4xl sm:text-5xl">
        Get your beehiiv <StepWord>API key</StepWord>
      </h1>
      <p className="mb-10 max-w-2xl text-lg">
        Five quick steps. The key lets Pollen Picks read your newsletter posts, so you can pick what to share.
      </p>

      <ol className="m-0 list-none space-y-5 p-0">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-2xl bg-surface p-6">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-honey font-display text-lg text-ink-deep">
              {i + 1}
            </span>
            <div className="min-w-0 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_p]:m-0">
              <h2 className="mb-2 text-2xl">{s.title}</h2>
              {s.body}
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="safe" className="mt-10 rounded-2xl bg-card p-6">
        <h2 id="safe" className="mb-3 text-2xl">
          What happens to your key
        </h2>
        <ul className="m-0 space-y-2 pl-5">
          <li>It is stored encrypted and never shown in the app again, only its last four characters.</li>
          <li>Pollen Picks only reads your publication and posts. It never edits, sends or deletes anything in beehiiv.</li>
          <li>
            Remove it any time in <Link href="/settings" className="font-semibold underline underline-offset-4">Settings</Link>. To cut off access
            completely, also delete the key on beehiiv&rsquo;s API page.
          </li>
          <li>
            More in the{" "}
            <Link href="/privacy" className="font-semibold underline underline-offset-4">
              privacy page
            </Link>
            .
          </li>
        </ul>
      </section>

      <p className="mt-10">
        <Link href="/source" className="inline-flex items-center gap-2 font-bold underline underline-offset-4">
          <ArrowLeft aria-hidden className="size-4" /> Back to the app
        </Link>
      </p>
    </main>
  );
}
