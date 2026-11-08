import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { FreshRunDone } from "@/components/FreshRunDone";
import { clearCustomChunks } from "@/lib/customPicks";
import { FRESH_COOKIE } from "@/lib/progress";
import { ServerTimings } from "@/components/ServerTimings";
import { timer } from "@/lib/timing";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { Track } from "@/components/Track";
import { requireSession } from "@/lib/auth";
import { demoUrlFrom, parseLinkMode } from "@/lib/flow";
import { knownHandles } from "@/lib/instagramHandles";
import { loadAppIssueResult } from "@/lib/sources";
import { Picker } from "./Picker";
import { parsePicking, pickerKey } from "./picking";

export const metadata = { title: "Pick content · Pollen Picks" };

export default function Pick(props: PageProps<"/pick">) {
  return (
    <Suspense fallback={<FlowLoader label="Gathering your picks…" />}>
      <PickContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PickContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;
  const { mode, picking, picks } = sp;
  // The sample issue is the public demo now: old /pick?mode=demo links go there, and need no login.
  if (mode === "demo") redirect(demoUrlFrom("pick", sp));
  // filter(Boolean) first: Number("") is 0, so an empty ?picks= would otherwise count as pick #0.
  const initialPicks = String(Array.isArray(picks) ? picks[0] : (picks ?? ""))
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0);
  const t = timer("/pick");
  const session = await t.step("session", requireSession(`/pick?mode=${encodeURIComponent(String(mode ?? ""))}`));
  // Coming from the source step: a new run. The last run's highlights go before this one's issue is loaded.
  const fresh = (await cookies()).get(FRESH_COOKIE)?.value === "1";
  if (fresh) {
    try {
      await t.step("fresh start", clearCustomChunks(session.userId));
    } catch (e) {
      console.error("clearing the last run's highlights failed:", (e as Error).message);
    }
  }
  const result = await t.step("issue", loadAppIssueResult(String(mode ?? "")));
  if (!result) redirect("/source"); // public newsletters arrive later
  // Say what went wrong instead of bouncing back to the source step, which just looks like a refresh.
  if ("error" in result) return <LoadError message={result.error} />;
  const issue = result.issue;
  const known = await t.step("handles", knownHandles(issue.chunks.map((c) => c.url)));
  const report = t.report();
  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <ServerTimings report={report} />
      <SaveStep step={2} />
      {fresh && <FreshRunDone />}
      <Track event="pick_reached" />
      <PageHeader current={2} hrefs={{ 1: "/source" }} />
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:gap-x-4">
          <h1 className="mb-3 col-start-1 row-start-1 min-w-0 text-3xl sm:text-5xl">
            <StepWord>Pick</StepWord> what to post
          </h1>
          <p className="col-span-2 row-start-2 mb-0 max-w-2xl text-lg sm:col-span-1 sm:col-start-1">
          Picking from{" "}
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group font-semibold underline decoration-[3px] underline-offset-[7px] transition-colors hover:decoration-coral"
          >
            {issue.title}
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="ml-1.5 inline-block size-4 align-[-0.1em] transition-colors group-hover:text-coral"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 14 14 6M7 6h7v7" />
            </svg>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
          <div className="col-start-2 row-start-1 self-start sm:row-span-2 sm:mt-2">
            <ShareLinkButton kind="pick" mode={String(mode ?? "")} />
          </div>
      </div>
      {/* A fresh run gets its own Picker. With cacheComponents the page left a moment ago stays alive (hidden), so without a new key it would
          come back with the old run's picks in its state, ignore the cleared storage, and autosave them to the server again. */}
      <Picker
        key={pickerKey(String(mode ?? ""), issue.url, fresh)}
        mode={String(mode ?? "")}
        issueKey={issue.url}
        chunks={issue.chunks}
        hasClicks={issue.hasClicks}
        initialView={parsePicking(picking)}
        initialPicks={initialPicks}
        manual
        manualOnly={Boolean(parseLinkMode(String(mode ?? "")))}
        knownHandles={known}
        lookups
      />
    </main>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <PageHeader current={2} hrefs={{ 1: "/source" }} />
      <h1 className="mb-3 text-4xl sm:text-5xl">
        We couldn&rsquo;t <StepWord>load</StepWord> that issue
      </h1>
      <p role="alert" className="mb-6 max-w-2xl border-l-4 border-coral pl-4 text-lg">
        {message}
      </p>
      <p className="flex flex-wrap gap-x-6 gap-y-2">
        <a href="/source" className="font-bold underline underline-offset-4">
          Back to the source step
        </a>
        <a href="/settings" className="font-bold underline underline-offset-4">
          Settings
        </a>
      </p>
    </main>
  );
}
