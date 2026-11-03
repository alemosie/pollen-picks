import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { requireSession } from "@/lib/auth";
import { demoUrlFrom } from "@/lib/flow";
import { loadAppIssue } from "@/lib/sources";
import { Picker } from "./Picker";
import { parsePicking } from "./picking";

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
  const initialPicks = String(Array.isArray(picks) ? picks[0] : (picks ?? ""))
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0);
  await requireSession(`/pick?mode=${encodeURIComponent(String(mode ?? ""))}`);
  const issue = await loadAppIssue(String(mode ?? ""));
  if (!issue) redirect("/source"); // public / own-newsletter modes arrive later
  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <SaveStep step={2} />
      <PageHeader current={2} hrefs={{ 1: "/source" }} />
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h1 className="mb-3 text-4xl sm:text-5xl">
            <StepWord>Pick</StepWord> what to post
          </h1>
          <div className="sm:mt-2">
            <ShareLinkButton kind="pick" mode={String(mode ?? "")} />
          </div>
        </div>
        <p className="mb-0 max-w-2xl text-lg">
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
      </div>
      <Picker
        mode={String(mode ?? "")}
        chunks={issue.chunks}
        hasClicks={issue.hasClicks}
        initialView={parsePicking(picking)}
        initialPicks={initialPicks}
      />
    </main>
  );
}
