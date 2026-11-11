import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { AccountLinks } from "@/components/AccountLinks";
import { hasSession } from "@/lib/auth";

const TRY_DEMO = "hidden whitespace-nowrap text-sm font-semibold underline underline-offset-4 sm:inline";
// The same underlined link as History and Settings (AccountLinks). Hidden on the narrowest phones, where the header has no room; the footer links to About too.
const ABOUT = "hidden whitespace-nowrap text-sm font-semibold underline underline-offset-4 min-[380px]:inline";
const LOG_IN = "rounded-xl bg-ink px-3.5 py-2 text-sm font-bold text-cream transition hover:bg-ink-deep sm:px-4";
// The same spacing as the app's own header links (AccountLinks), so About sits beside History and Settings like one of them.
const NAV = "flex items-center gap-3 min-[360px]:gap-4 sm:gap-5";

function About() {
  return (
    <Link href="/about" className={ABOUT}>
      About
    </Link>
  );
}

function LoggedOut() {
  return (
    <>
      <Link href="/demo/source" className={TRY_DEMO}>
        Try demo
      </Link>
      <a href="/login" className={LOG_IN}>
        Log in to create
      </a>
    </>
  );
}

/**
 * The splash page's header links: "About" for everyone, then "Try demo" and "Log in to create" for visitors; History, Settings and Log out for people who are signed in
 * (the same links as the app's own header). Built like AuthLink, whose reasoning applies: the page is built once, so the first paint can't know who is
 * looking. Visitors see no change. The placeholder holds both versions (pp-out, pp-in) and CSS shows one from the "signed in" marker the root layout's script
 * sets before the first paint (see lib/signedInHint); the server then confirms from the real session cookie.
 */
export function HomeNav() {
  return (
    <Suspense
      fallback={
        <nav aria-label="Account" className={NAV}>
          <About />
          <div className="pp-out contents">
            <LoggedOut />
          </div>
          <div className="pp-in">
            <AccountLinks />
          </div>
        </nav>
      }
    >
      <Inner />
    </Suspense>
  );
}

async function Inner() {
  await connection();
  const yes = await hasSession();
  return (
    <nav aria-label="Account" className={NAV}>
      <About />
      {yes ? <AccountLinks /> : <LoggedOut />}
    </nav>
  );
}
