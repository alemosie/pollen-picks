import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { AccountLinks } from "@/components/AccountLinks";
import { hasSession } from "@/lib/auth";
import { HINT_COOKIE } from "@/lib/session";

const TRY_DEMO =
  "hidden rounded-xl px-3 py-2 text-sm font-semibold underline decoration-[3px] decoration-transparent underline-offset-[7px] transition hover:decoration-coral sm:inline-block sm:px-4";
const LOG_IN = "rounded-xl bg-ink px-3.5 py-2 text-sm font-bold text-cream transition hover:bg-ink-deep sm:px-4";
const NAV = "flex items-center gap-2 sm:gap-3";

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
 * The splash page's header links: "Try demo" and "Log in to create" for visitors; History, Settings and Log out for people who are signed in
 * (the same links as the app's own header). Built like AuthLink, whose reasoning applies: the page is built once, so the first paint can't know who is
 * looking. Visitors see no change. For someone signed in, a tiny script right after the markup reads the "signed in" marker cookie and flips the
 * header before the first paint; the server then confirms from the real session cookie.
 */
export function HomeNav() {
  // Runs while the page loads, straight after the links. Only touches its own nav; fails silently.
  const swap = `(function(){try{var s=document.currentScript,n=s&&s.parentElement;if(n&&/(^|; )${HINT_COOKIE}=1/.test(document.cookie))n.setAttribute("data-in","")}catch(e){}})()`;
  return (
    <Suspense
      fallback={
        <nav aria-label="Account" className={`group ${NAV}`} suppressHydrationWarning>
          <div className="contents group-data-[in]:hidden">
            <LoggedOut />
          </div>
          <div className="hidden group-data-[in]:block">
            <AccountLinks />
          </div>
          <script dangerouslySetInnerHTML={{ __html: swap }} />
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
      {yes ? <AccountLinks /> : <LoggedOut />}
    </nav>
  );
}
