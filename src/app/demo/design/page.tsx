import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FlowLoader } from "@/components/FlowLoader";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { Track } from "@/components/Track";
import { DemoHeaderRight } from "@/components/DemoHeaderRight";
import { loadDemoIssueWithHighlights } from "@/lib/demoServer";
import { DEMO_CHANNELS } from "@/lib/demoChannels";
import { stepUrl } from "@/lib/flow";
import { knownForPicks } from "@/lib/instagramHandles";
import { slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFromPage } from "@/lib/slides/options";
import { TemplateEditor } from "@/app/design/TemplateEditor";

export const metadata = { title: "Demo: Design · Pollen Picks" };

export default function DemoDesign(props: PageProps<"/demo/design">) {
  return (
    <Suspense fallback={<FlowLoader instant label="Setting up your carousel…" />}>
      <DemoDesignContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DemoDesignContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // filter(Boolean) first: Number("") is 0, so an empty ?picks= would otherwise count as pick #0.
  const ids = String(Array.isArray(sp.picks) ? sp.picks[0] : (sp.picks ?? ""))
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(Number.isInteger);
  if (ids.length === 0) redirect(stepUrl("demo", "pick"));

  const issue = await loadDemoIssueWithHighlights();
  const items = slideItemsFor(issue.chunks, ids, await knownForPicks(issue.chunks, ids));

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32 pt-6">
      <SaveStep step={3} />
      <Track event="design_reached" />
      <PageHeader current={3} hrefs={{ 1: "/demo/source", 2: stepUrl("demo", "pick") }} right={<DemoHeaderRight />} finalLabel="Finish" />
      <TemplateEditor mode="demo" newsletter={issue.newsletter} items={items} picks={ids} channels={DEMO_CHANNELS} initial={parseTemplateFromPage(sp)} />
    </main>
  );
}
