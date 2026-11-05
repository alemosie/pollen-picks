import { cookies } from "next/headers";
import { Suspense } from "react";
import { connection } from "next/server";
import { hasSession } from "@/lib/auth";
import { HINT_COOKIE } from "@/lib/session";

const LOGIN = "/login";

/**
 * "Log in to create" for visitors, "Open app" for people who are already in (the splash page stays static around it).
 *
 * The page is built once, so the first paint can't know who is looking. Visitors see no change at all: the placeholder is their final label. For
 * someone signed in, a tiny script right after the placeholder reads the "signed in" marker cookie (see HINT_COOKIE) and swaps the label before
 * the first paint, so there is no wrong label to see. The server then confirms from the real session cookie. That check only looks for the cookie
 * (instant); whether the Buffer session is still usable isn't needed here, because a lapsed one lands on /login, which says so and never bounces back.
 * A person who signed in before the marker existed has no marker yet: they get the settle-in fade below instead, and the marker on their next login.
 */
export function AuthLink({ className, loggedOut, loggedIn }: { className: string; loggedOut: string; loggedIn: string }) {
  // Runs while the page loads, straight after the link above it. Only touches that link; fails silently.
  const swap = `(function(){try{var s=document.currentScript,a=s&&s.previousElementSibling;if(a&&/(^|; )${HINT_COOKIE}=1/.test(document.cookie)){a.setAttribute("href","/source");a.firstChild.textContent=${JSON.stringify(loggedIn)};a.firstChild.className="pp-fade-in"}}catch(e){}})()`;
  return (
    <Suspense
      fallback={
        <>
          <a href={LOGIN} className={className} suppressHydrationWarning>
            <span suppressHydrationWarning>{loggedOut}</span>
          </a>
          <script dangerouslySetInnerHTML={{ __html: swap }} />
        </>
      }
    >
      <Inner className={className} loggedOut={loggedOut} loggedIn={loggedIn} />
    </Suspense>
  );
}

async function Inner({ className, loggedOut, loggedIn }: { className: string; loggedOut: string; loggedIn: string }) {
  await connection();
  const yes = await hasSession();
  // With the marker the script has already shown the label (and faded it in); fading again would make it blink.
  const settled = (await cookies()).has(HINT_COOKIE);
  return (
    <a href={yes ? "/source" : LOGIN} className={className}>
      {yes ? <span className={settled ? undefined : "pp-fade-in"}>{loggedIn}</span> : loggedOut}
    </a>
  );
}
