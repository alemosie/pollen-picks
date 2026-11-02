import { Suspense } from "react";
import { StepWord } from "@/components/StepWord";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
import { SavedFlash } from "@/components/SavedFlash";
import { SaveStep } from "@/components/SaveStep";
import { requireSession } from "@/lib/auth";
import { loadDemoIssue } from "@/lib/demo";
import { slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFromPage } from "@/lib/slides/options";
import { TemplateEditor } from "./TemplateEditor";

export const metadata = { title: "Create · Pollen Picks" };

export default function Create(props: PageProps<"/create">) {
  return (
    <Suspense fallback={null}>
      <CreateContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CreateContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const { mode, picks } = sp;
  await requireSession(`/create?mode=${encodeURIComponent(String(mode ?? ""))}&picks=${encodeURIComponent(String(picks ?? ""))}`);
  const ids = String(picks ?? "").split(",").map(Number).filter(Number.isFinite);
  if (mode !== "demo" || ids.length === 0) redirect("/pick?mode=demo");

  const issue = loadDemoIssue();
  const items = slideItemsFor(issue.chunks, ids);

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32 pt-6">
      <SaveStep step={3} />
      <PageHeader current={3} hrefs={{ 1: "/source", 2: "/pick?mode=demo" }} />
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="mb-3 text-4xl sm:text-5xl"><StepWord>Create</StepWord> your carousel</h1>
          <div className="mt-2 shrink-0 sm:mt-4">
            <SavedFlash />
          </div>
        </div>
        <p className="mb-0 max-w-2xl text-lg">Use the standard layout, or build your own slides.</p>
      </div>
      <TemplateEditor items={items} picks={ids} initial={parseTemplateFromPage(sp)} />
    </main>
  );
}
