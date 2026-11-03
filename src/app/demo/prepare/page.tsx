import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FlowLoader } from "@/components/FlowLoader";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { DemoHeaderRight } from "@/components/DemoHeaderRight";
import { loadDemoIssue } from "@/lib/demo";
import { DEMO_CHANNELS } from "@/lib/demoChannels";
import { stepUrl } from "@/lib/flow";
import { captionItemsFor } from "@/lib/slides/items";
import { parseTemplateFromPage, templateParams } from "@/lib/slides/options";
import { PrepareView } from "@/app/prepare/PrepareView";

export const metadata = { title: "Demo: prepare · Pollen Picks" };

export default function DemoPrepare(props: PageProps<"/demo/prepare">) {
  return (
    <Suspense fallback={<FlowLoader label="Getting your channels ready…" />}>
      <DemoPrepareContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DemoPrepareContent({
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

  const tpl = parseTemplateFromPage(sp);
  const extra = templateParams(tpl).toString();
  const q = `picks=${ids.join(",")}${extra ? `&${extra}` : ""}`;
  const issue = loadDemoIssue();

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <SaveStep step={4} />
      <PageHeader
        current={4}
        hrefs={{
          2: stepUrl("demo", "pick"),
          3: stepUrl("demo", "design", q),
        }}
        right={<DemoHeaderRight />} finalLabel="Finish"
      />
      <PrepareView
        channels={DEMO_CHANNELS}
        picks={ids}
        template={extra}
        link={issue.url}
        captionItems={captionItemsFor(
          issue.chunks,
          tpl.spec ? tpl.spec.slides.flat().filter((id) => ids.includes(id)) : ids,
          issue.publishedAt.slice(0, 10),
          tpl.spec?.edits,
        )}
        newsletter="Just a Phase"
        heading={tpl.heading}
        nextHref={stepUrl("demo", "send", q)}
        backHref={stepUrl("demo", "design", q)}
        demo
      />
    </main>
  );
}
