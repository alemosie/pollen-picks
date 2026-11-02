import { Suspense } from "react";
import { StepWord } from "@/components/StepWord";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
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
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <SaveStep step={3} />
      <PageHeader current={3} hrefs={{ 1: "/source", 2: "/pick?mode=demo" }} />
      <div className="mb-6">
        <h1 className="mb-3 text-4xl sm:text-5xl"><StepWord>Create</StepWord> your carousel</h1>
        <p className="mb-0 max-w-2xl text-lg">
          Use the standard template, or customize how picks are laid out and what the text says. You&apos;ll write the caption and choose where it goes next.
        </p>
      </div>
      <TemplateEditor items={items} picks={ids} initial={parseTemplateFromPage(sp)} />
    </main>
  );
}
