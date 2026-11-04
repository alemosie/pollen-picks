import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { DemoHeaderRight } from "@/components/DemoHeaderRight";
import { loadDemoIssueWithHighlights } from "@/lib/demoServer";
import { Track } from "@/components/Track";
import { Picker } from "@/app/pick/Picker";
import { parsePicking } from "@/app/pick/picking";

export const metadata = { title: "Demo: pick content · Pollen Picks" };

export default function DemoPick(props: PageProps<"/demo/pick">) {
  return (
    <Suspense fallback={<FlowLoader label="Gathering your picks…" />}>
      <DemoPickContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DemoPickContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { picking, picks } = await searchParams;
  // filter(Boolean) first: Number("") is 0, so an empty ?picks= would otherwise count as pick #0.
  const initialPicks = String(Array.isArray(picks) ? picks[0] : (picks ?? ""))
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0);

  const issue = await loadDemoIssueWithHighlights();
  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <SaveStep step={2} />
      <Track event="demo_start" />
      <PageHeader current={2} right={<DemoHeaderRight />} finalLabel="Finish" />
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h1 className="mb-3 text-4xl sm:text-5xl">
            <StepWord>Pick</StepWord> what to post
          </h1>
          <div className="sm:mt-2">
            <ShareLinkButton kind="pick" title="Anyone with this link can open this demo, no account needed" />
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
        mode="demo"
        chunks={issue.chunks}
        hasClicks={issue.hasClicks}
        initialView={parsePicking(picking)}
        initialPicks={initialPicks}
        manual
      />
    </main>
  );
}
