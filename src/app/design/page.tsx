import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { Track } from "@/components/Track";
import { requireSession } from "@/lib/auth";
import { demoUrlFrom, stepUrl } from "@/lib/flow";
import { loadAppIssue } from "@/lib/sources";
import { slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFromPage } from "@/lib/slides/options";
import { TemplateEditor } from "./TemplateEditor";

export const metadata = { title: "Design · Pollen Picks" };

export default function Design(props: PageProps<"/design">) {
  return (
    <Suspense fallback={<FlowLoader label="Setting up your carousel…" />}>
      <DesignContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DesignContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;
  const { picks } = sp;
  const mode = String(sp.mode ?? "");
  // The sample issue is the public demo now: old /design?mode=demo links go there, and need no login.
  if (mode === "demo") redirect(demoUrlFrom("design", sp));
  // Keep every param (the custom layout lives in `spec`), so a shared link survives the Buffer login round trip.
  const back = new URLSearchParams();
  for (const [k, v] of Object.entries(sp))
    if (typeof v === "string") back.set(k, v);
    else if (Array.isArray(v) && v[0]) back.set(k, v[0]);
  await requireSession(`/design?${back.toString()}`);
  // filter(Boolean) first: Number("") is 0, so an empty ?picks= would otherwise count as pick #0.
  const ids = String(picks ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  if (ids.length === 0) redirect(stepUrl(mode, "pick"));

  const issue = await loadAppIssue(mode);
  if (!issue) redirect("/source");
  const items = slideItemsFor(issue.chunks, ids);

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32 pt-6">
      <SaveStep step={3} />
      <Track event="design_reached" />
      <PageHeader current={3} hrefs={{ 1: "/source", 2: stepUrl(mode, "pick") }} />
      <TemplateEditor
        mode={mode}
        newsletter={issue.newsletter}
        items={items}
        picks={ids}
        initial={parseTemplateFromPage(sp)}
      />
    </main>
  );
}
