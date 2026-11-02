import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { requireSession } from "@/lib/auth";
import { loadDemoIssue } from "@/lib/demo";
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
  const { mode, picks } = sp;
  // Keep every param (the custom layout lives in `spec`), so a shared link survives the Buffer login round trip.
  const back = new URLSearchParams();
  for (const [k, v] of Object.entries(sp))
    if (typeof v === "string") back.set(k, v);
    else if (Array.isArray(v) && v[0]) back.set(k, v[0]);
  await requireSession(`/design?${back.toString()}`);
  const ids = String(picks ?? "")
    .split(",")
    .map(Number)
    .filter(Number.isFinite);
  if (mode !== "demo" || ids.length === 0) redirect("/pick?mode=demo");

  const issue = loadDemoIssue();
  const items = slideItemsFor(issue.chunks, ids);

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32 pt-6">
      <SaveStep step={3} />
      <PageHeader current={3} hrefs={{ 1: "/source", 2: "/pick?mode=demo" }} />
      <TemplateEditor
        items={items}
        picks={ids}
        initial={parseTemplateFromPage(sp)}
      />
    </main>
  );
}
