import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { StepWord } from "@/components/StepWord";

export const metadata = { title: "Privacy · Pollen Picks" };

// Keep this in step with what the app really stores. When a new connection or data store lands (beehiiv API key,
// brand logo uploads, ...), add its line to the matching section below and bump UPDATED.
const UPDATED = "6 November 2026";

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
          <li>
            A simple log of the drafts Pollen Picks tried to create for you: which network, and whether it worked. Never the
            caption or the posts.
          </li>
          <li>
            History: for each draft or post Pollen Picks tried to create in Buffer for you, the channel, the newsletter and issue title, Buffer&rsquo;s id for the post, its last known status, its live link and, if it failed, Buffer&rsquo;s short error message. This is what the &ldquo;History&rdquo; page shows. The caption is kept only while a send is waiting in the queue, and is deleted as soon as the post is created. If a post fails, or its request breaks off so we can&rsquo;t tell whether it arrived, its caption is kept for 24 hours so you can retry it, then deleted. The slide images themselves are never stored: they are drawn from your design each time Buffer or your screen asks for them.
          </li>
          <li>
            Your current run: while you work (Pick, Design, Write, Send), Pollen Picks keeps one copy of where you are on its server, so you can carry on from another device. It holds
            which issue, which picks you chose, your slide design, the caption as you wrote or edited it, and the issue&rsquo;s title and newsletter name. There is one per
            account. It is saved automatically a moment after each change and replaced when you start a new run. It is deleted when you send, when you discard it, and
            when you delete your account. Images are never stored.
          </li>
          <li>
            Saved creations, only if you press <i>Save</i> on the Design, Write or Send step: the same things as the current run (picks, slide design, caption text, issue and
            newsletter name), kept for each issue you save until you delete it under <i>Saved creations</i> on the <Link href="/history#saved-creations">History</Link> page, or
            delete your account. After you save an issue, further changes to it are saved into it automatically. Images are never stored. If a saved creation uses highlights you made
            on the Manual tab, those highlights are kept with it, even when you start a new run.
          </li>
          <li>
            Links to pictures you add for your slides, only if you add any: just the web address, never a copy of the picture. Only you can use
            them. You can keep 50, and remove any at any time in Settings &gt; Photos. Deleting your account removes them all. The picture itself stays on the
            site it came from and is fetched when a slide is drawn, as are the pictures Pollen Picks finds in your issue or on the pages your picks link to.
          </li>
        </ul>
        <p>If you connect your newsletter, Pollen Picks also stores:</p>
        <ul>
          <li>
            Your beehiiv API key, encrypted and never shown again (only its last four characters). It is used to read your
            publication and posts, nothing else.
          </li>
          <li>The name, organization and basic stats of the publications that key can see, so the app can show what is connected.</li>
          <li>The text you highlight from your issues, so your later steps can use it.</li>
        </ul>
        <p>If you paste a link to a public post, Pollen Picks also stores:</p>
        <ul>
          <li>
            The link and what the page says about itself (its title, publication, author, date and preview image), so your
            next steps work. The page&rsquo;s text is read each time you open it and is not kept.
          </li>
          <li>The text you highlight from it.</li>
        </ul>
        <p>
          Pollen Picks never sees your Buffer password: you type it on Buffer&rsquo;s own page. The demo needs no account.
          What you highlight in the demo stays in your browser and is not saved on our servers (see below).
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
          creates <b>drafts</b> by default: nothing is published until you review and send it from Buffer. It publishes
          straight away only when you press &ldquo;Send now&rdquo; and confirm.
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
            <b>Signed-in marker.</b> A second cookie, for the same 30 days, only says &ldquo;someone is signed in on this
            browser&rdquo;. It lets the home page show &ldquo;Open app&rdquo; at once instead of &ldquo;Log in to create&rdquo;.
            It holds no account details. Logging out removes it.
          </li>
          <li>
            <b>Short-lived login cookie.</b> While you are on your way to Buffer and back, a second cookie (10 minutes)
            protects the login from being hijacked.
          </li>
          <li>
            <b>Saved progress.</b> Where you got to in the flow, your picks and your slide colors are kept in your
            browser&rsquo;s own storage, so a closed tab doesn&rsquo;t lose them. That stays on your device.
          </li>
          <li>
            <b>New-run marker.</b> When you choose a source and continue, a cookie lasting two minutes tells the next
            page to start with a clean slate instead of the previous run&rsquo;s picks. It holds no personal data and
            is removed as soon as that page has loaded.
          </li>
          <li>
            <b>Demo cookie.</b> In the demo, the text you highlight is kept in a cookie for a day, so the next steps and
            the slide previews can be built. We don&rsquo;t save it on our servers.
          </li>
        </ul>
        <p>There are no ads and no tracking cookies. The only analytics are the anonymous counts described next.</p>
      </>
    ),
  },
  {
    id: "feedback",
    title: "Feedback",
    body: (
      <>
        <p>
          If you send feedback, Pollen Picks stores your answers, the random tab code and the list of steps that visit reached.
          If you were logged in, it is also linked to your account. It goes to Alex only. Your words are only quoted if you
          answer &ldquo;OK to share?&rdquo; with yes. Saying yes also lets me look at what you made: Pollen Picks then stores the link to
          the issue you started from and the link to your slide design (your picks and layout; in the demo it also carries the text you
          highlighted). No images, and no slide text beyond that. If you say no, none of it is stored. Ask me to remove it any time.
        </p>
      </>
    ),
  },
  {
    id: "counts",
    title: "Usage counts",
    body: (
      <>
        <p>
          To see whether Pollen Picks is useful, it counts the steps people reach (for example &ldquo;reached the design
          step&rdquo; or &ldquo;clicked log in&rdquo;), in the demo and in the app.
        </p>
        <p>
          Each count is one row with the step, the time, whether you were logged in, and a random code made in your browser
          tab, so one visit&rsquo;s steps can be read together. There is no cookie, no IP address, no content, and the code
          is not tied to you. It is forgotten when you close the tab.
        </p>
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
          above, the usage counts and any feedback you send.
        </li>
        <li>
          <b>Netlify</b>, which hosts the site and, like any host, sees technical request data such as IP addresses in its
          logs.
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
            <b>Delete your data.</b> Press <i>Delete my data</i> under Account in <Link href="/settings">Settings</Link> and your
            account, brand settings, history, saved creations, current run, highlights and stored tokens are deleted straight away. Anything you wrote in the{" "}
            <Link href="/feedback">feedback form</Link> is kept but no longer linked to you.
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
