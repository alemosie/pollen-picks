import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { StepWord } from "@/components/StepWord";

export const metadata = { title: "Privacy · Pollen Picks" };

// Keep this in step with what the app really stores. When a new connection or data store lands (Beehiiv API key,
// brand logo uploads, ...), add its line to the matching section below and bump UPDATED.
const UPDATED = "3 November 2026";

type Section = { id: string; title: string; body: ReactNode };

const sections: Section[] = [
  {
    id: "stored",
    title: "What Pollen Picks stores",
    body: (
      <>
        <p>When you log in with Buffer, Pollen Picks stores:</p>
        <ul>
          <li>Your Buffer account ID and the email address on your Buffer account, to recognize you when you come back.</li>
          <li>
            Your Buffer access tokens, so Pollen Picks can see your channels and save drafts for you. These are kept
            encrypted, and never shown in the app.
          </li>
          <li>Your brand settings (name, colors and fonts), which start with defaults and are yours to change.</li>
        </ul>
        <p>If you connect your newsletter, Pollen Picks also stores:</p>
        <ul>
          <li>
            Your beehiiv API key, encrypted and never shown again (only its last four characters). It is used to read your
            publication and posts, nothing else.
          </li>
          <li>The name, organization and basic stats of the publications that key can see, so the app can show what is connected.</li>
        </ul>
        <p>
          Pollen Picks never sees your Buffer password: you type it on Buffer&rsquo;s own page. The demo needs no account
          and stores nothing about you on our servers.
        </p>
      </>
    ),
  },
  {
    id: "buffer",
    title: "What Pollen Picks does in Buffer",
    body: (
      <>
        <p>
          Pollen Picks asks Buffer for permission to read your account, channels, posts and queue, and to create posts. It
          only saves <b>drafts</b>: nothing is published until you review and send it from Buffer.
        </p>
        <p>
          To make a draft, Pollen Picks sends Buffer your caption and the web addresses of your slide images. Buffer then
          downloads those images from Pollen Picks. The addresses are not secret, but they are not listed anywhere either.
        </p>
      </>
    ),
  },
  {
    id: "browser",
    title: "Cookies and your browser",
    body: (
      <>
        <ul>
          <li>
            <b>Login cookie.</b> One cookie keeps you logged in for 30 days. It holds an encrypted reference to your
            account, nothing else. Logging out removes it.
          </li>
          <li>
            <b>Short-lived login cookie.</b> While you are on your way to Buffer and back, a second cookie (10 minutes)
            protects the login from being hijacked.
          </li>
          <li>
            <b>Saved progress.</b> Where you got to in the flow, your picks and your slide colors are kept in your
            browser&rsquo;s own storage, so a closed tab doesn&rsquo;t lose them. That stays on your device.
          </li>
        </ul>
        <p>There are no ads, no analytics and no tracking cookies.</p>
      </>
    ),
  },
  {
    id: "services",
    title: "Who else handles your data",
    body: (
      <ul>
        <li>
          <b>Buffer</b>, where you log in and where your drafts live. Its own privacy policy applies there.
        </li>
        <li>
          <b>beehiiv</b>, only if you connect your newsletter. Pollen Picks sends your key to beehiiv to read your posts.
          It never edits, sends or deletes anything there. Its own privacy policy applies to your account.
        </li>
        <li>
          <b>Supabase</b>, our database, hosted in the EU (Ireland). It holds the account, brand and encrypted token and key data
          above.
        </li>
        <li>
          <b>Netlify</b>, which hosts the site and, like any host, sees technical request data such as IP addresses in its
          logs.
        </li>
        <li>
          <b>Google Forms</b>, only if you choose to fill in the feedback form.
        </li>
      </ul>
    ),
  },
  {
    id: "control",
    title: "Your choices",
    body: (
      <>
        <ul>
          <li>
            <b>Log out</b> ends your session in this browser. It does not delete anything we hold.
          </li>
          <li>
            <b>Revoke access</b> at any time in your Buffer account settings. After that, the stored tokens stop working.
          </li>
          <li>
            <b>Remove your beehiiv key</b> in <Link href="/settings">Settings</Link>, which deletes it from our database.
            To cut off access completely, also delete the key on beehiiv&rsquo;s API page.
          </li>
          <li>
            <b>Delete your data.</b> Ask through the <Link href="/feedback">feedback form</Link> and your account, brand
            settings and stored tokens will be deleted. A self-serve button is on the way.
          </li>
        </ul>
        <p>Pollen Picks does not sell your data or use it for advertising.</p>
      </>
    ),
  },
  {
    id: "who",
    title: "Who is behind this",
    body: (
      <p>
        Pollen Picks is a small project built by Alex of Amsterdam Parent Project for Buffer Commit 2026. Questions go
        through the <Link href="/feedback">feedback form</Link> and land straight with me.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
      <header className="mb-10 flex items-center justify-between gap-6 sm:mb-14">
        <Logo height={48} href="/" />
        <Link href="/login" className="text-sm font-semibold underline underline-offset-4">
          Log in
        </Link>
      </header>

      <h1 className="mb-3 text-4xl sm:text-5xl">
        Your <StepWord>privacy</StepWord>
      </h1>
      <p className="mb-10 max-w-2xl text-lg">
        What Pollen Picks keeps, why, and how to take it back. Plain language, no small print. Last updated {UPDATED}.
      </p>

      <div className="space-y-5">
        {sections.map((s) => (
          <section key={s.id} aria-labelledby={`p-${s.id}`} className="rounded-2xl bg-surface p-6">
            <h2 id={`p-${s.id}`} className="mb-3 text-2xl">
              {s.title}
            </h2>
            <div className="space-y-3 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-3 [&_ul]:p-0">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12">
        <Link href="/" className="inline-flex items-center gap-2 font-bold underline underline-offset-4">
          <ArrowLeft aria-hidden className="size-4" /> Back to home
        </Link>
      </p>
    </main>
  );
}
