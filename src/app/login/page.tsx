import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BufferLogo } from "@/components/BufferLogo";
import { Logo } from "@/components/Logo";
import { PollenScatter } from "@/components/PollenScatter";
import { StepWord } from "@/components/StepWord";
import { hasLiveSession, hasSession } from "@/lib/auth";

export const metadata = { title: "Log in · Pollen Picks" };

// Context before the Buffer OAuth flow: why Buffer, with the details left to /privacy.
// Every login passes through here: /api/auth/buffer/login sends anyone without ?continue=1 to this page.
// Deliberately no "already logged in, so redirect" here: if Buffer access was revoked, the protected page sends the
// visitor to /login, and redirecting back would loop.
export default function Login(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<LoginContent next="/source" />}>
      <LoginWithNext searchParams={props.searchParams} />
    </Suspense>
  );
}

async function LoginWithNext({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const want = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  // Same-site relative paths only (no open redirect).
  const next = want && want.startsWith("/") && !want.startsWith("//") ? want : "/source";
  const [cookie, live] = await Promise.all([hasSession(), hasLiveSession()]);
  return <LoginContent next={next} loggedIn={live} expired={cookie && !live} />;
}

function LoginContent({ next, loggedIn = false, expired = false }: { next: string; loggedIn?: boolean; expired?: boolean }) {
  const go = `/api/auth/buffer/login?next=${encodeURIComponent(next)}&continue=1`;
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <PollenScatter />
      <main className="relative mx-auto w-full max-w-3xl flex-1 px-6 pb-12 pt-6">
        <header className="mb-10 flex items-center justify-between gap-6 sm:mb-14">
          <Logo height={48} href="/" />
          <Link href="/demo" className="text-sm font-semibold underline underline-offset-4">
            Try the demo
          </Link>
        </header>

        {expired && (
          <p className="mb-6 rounded-2xl bg-surface px-5 py-3 text-base">
            Your Buffer login has expired or was disconnected. Log in again to keep going.
          </p>
        )}

        {loggedIn && (
          <p className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-surface px-5 py-3 text-base">
            <span>You&rsquo;re already logged in.</span>
            <a href={next} className="font-bold underline underline-offset-4">
              Continue
            </a>
            <a href="/api/auth/buffer/logout" className="font-bold underline underline-offset-4">
              Log out
            </a>
          </p>
        )}

        <h1 className="mb-10 text-4xl sm:mb-12 sm:text-5xl">
          Log in to <StepWord>Pollen Picks</StepWord>
        </h1>

        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-4">
          <a
            href={go}
            className="inline-flex items-center gap-3 rounded-xl bg-ink px-6 py-3 text-lg font-bold text-cream hover:bg-ink-deep"
          >
            <BufferLogo markOnly className="h-6 w-auto" />
            Continue with Buffer
          </a>
        </div>
        <p className="mb-12 mt-0 max-w-xl text-lg">
          We use your Buffer identity to create your account &mdash; or log into your existing one &mdash; on Pollen Picks.{" "}
          <Link href="/privacy" className="font-semibold underline underline-offset-4">
            Read our privacy policy
          </Link>
          .
        </p>

        <p className="mb-0 max-w-xl text-sm">
          Not ready?{" "}
          <Link href="/demo" className="font-semibold underline underline-offset-4">
            Try the demo first
          </Link>
          . It uses a sample issue and sample channels, needs no account, and can&rsquo;t send anything.
        </p>

        <p className="mt-12">
          <Link href="/" className="inline-flex items-center gap-2 font-bold underline underline-offset-4">
            <ArrowLeft aria-hidden className="size-4" /> Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
