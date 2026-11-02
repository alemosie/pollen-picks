import { Suspense } from "react";
import { StepWord } from "@/components/StepWord";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { requireSession } from "@/lib/auth";
import { loadDemoIssue } from "@/lib/demo";
import { Picker } from "./Picker";
import { parsePicking } from "./picking";

export const metadata = { title: "Pick content · Pollen Picks" };

export default function Pick(props: PageProps<"/pick">) {
  return (
    <Suspense fallback={null}>
      <PickContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PickContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { mode, picking } = await searchParams;
  await requireSession(`/pick?mode=${encodeURIComponent(String(mode ?? ""))}`);
  if (mode !== "demo") redirect("/source"); // public / own-newsletter modes arrive later

  const issue = loadDemoIssue();
  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <SaveStep step={2} />
      <PageHeader current={2} hrefs={{ 1: "/source" }} />
      <div className="mb-6">
      <h1 className="mb-3 text-4xl sm:text-5xl"><StepWord>Pick</StepWord> what to post</h1>
      <p className="mb-0 max-w-2xl text-lg">
        Picking from{" "}
        <a href={issue.url} target="_blank" rel="noopener noreferrer" className="group font-semibold underline decoration-[3px] underline-offset-[7px] transition-colors hover:decoration-coral">
          {issue.title}
          <svg aria-hidden viewBox="0 0 20 20" className="ml-1.5 inline-block size-4 align-[-0.1em] transition-colors group-hover:text-coral" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 14 14 6M7 6h7v7" />
          </svg>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
      </div>
      <Picker mode="demo" chunks={issue.chunks} hasClicks={issue.hasClicks} initialView={parsePicking(picking)} />
    </main>
  );
}
