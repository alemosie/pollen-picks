import { cookies } from "next/headers";
import { Suspense } from "react";
import { connection } from "next/server";
import { hasSession } from "@/lib/auth";
import { HINT_COOKIE } from "@/lib/session";

const LOGIN = "/login";

/**
 * "Log in to create" for visitors, "Open app" for people who are already in (the splash page stays static around it).
 *
 * The page is built once, so the first paint can't know who is looking. The placeholder holds both links, and CSS shows one of them from the "signed in" marker the
 * root layout's script sets before the first paint (see lib/signedInHint, and .pp-in / .pp-out in globals.css): visitors see no change at all, and someone signed in
 * never sees the wrong label. The server then confirms from the real session cookie. That check only looks for the cookie (instant); whether the Buffer session is
 * still usable isn't needed here, because a lapsed one lands on /login, which says so and never bounces back. A person who signed in before the marker existed has no
 * marker yet: they get the settle-in fade below instead, and the marker on their next login.
 */
export function AuthLink({ className, loggedOut, loggedIn }: { className: string; loggedOut: string; loggedIn: string }) {
  return (
    <Suspense
      fallback={
        <>
          <a href={LOGIN} className={`pp-out ${className}`}>
            {loggedOut}
          </a>
          <a href="/source" className={`pp-in ${className}`}>
            {loggedIn}
          </a>
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
  // With the marker the placeholder has already shown this label; fading again would make it blink.
  const settled = (await cookies()).has(HINT_COOKIE);
  return (
    <a href={yes ? "/source" : LOGIN} className={className}>
      {yes ? <span className={settled ? undefined : "pp-fade-in"}>{loggedIn}</span> : loggedOut}
    </a>
  );
}
