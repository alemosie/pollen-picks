import { Suspense } from "react";
import { connection } from "next/server";
import { hasLiveSession } from "@/lib/auth";

const LOGIN = "/login";

/** "Log in with Buffer" for visitors, "Continue" for people who are already in (the splash page stays static around it). */
export function AuthLink({ className, loggedOut, loggedIn }: { className: string; loggedOut: string; loggedIn: string }) {
  return (
    <Suspense
      fallback={
        <a href={LOGIN} className={className}>
          {loggedOut}
        </a>
      }
    >
      <Inner className={className} loggedOut={loggedOut} loggedIn={loggedIn} />
    </Suspense>
  );
}

async function Inner({ className, loggedOut, loggedIn }: { className: string; loggedOut: string; loggedIn: string }) {
  await connection();
  const yes = await hasLiveSession();
  return (
    <a href={yes ? "/source" : LOGIN} className={className}>
      {yes ? loggedIn : loggedOut}
    </a>
  );
}
