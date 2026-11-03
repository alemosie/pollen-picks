import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FlowLoader } from "@/components/FlowLoader";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { DemoHeaderRight } from "@/components/DemoHeaderRight";
import { hasSession } from "@/lib/auth";
import { loadDemoIssueWithHighlights } from "@/lib/demoServer";
import { DEMO_CHANNELS } from "@/lib/demoChannels";
import { stepUrl } from "@/lib/flow";
import { captionItemsFor, slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFromPage, templateParams } from "@/lib/slides/options";
import { planSlides } from "@/lib/slides/plan";
import { SendConfirm } from "@/app/send/SendConfirm";

export const metadata = { title: "Demo: send · Pollen Picks" };

export default function DemoSend(props: PageProps<"/demo/send">) {
  return (
    <Suspense fallback={<FlowLoader label="Preparing to send…" />}>
      <DemoSendContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DemoSendContent({
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
  const q = ids.join(",");
  const tail = `picks=${q}${extra ? `&${extra}` : ""}`;
  const issue = await loadDemoIssueWithHighlights();
  const slides = planSlides(slideItemsFor(issue.chunks, ids), { newsletter: "Just a Phase", ...tpl });
  const signedIn = await hasSession();

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <SaveStep step={5} />
      <PageHeader
        current={5}
        hrefs={{
          2: stepUrl("demo", "pick"),
          3: stepUrl("demo", "design", tail),
          4: stepUrl("demo", "prepare", tail),
        }}
        right={<DemoHeaderRight />} finalLabel="Finish"
      />
      <SendConfirm
        urls={slides.map((_, i) => `/api/slide/preview?picks=${q}&n=${i}${extra ? `&${extra}` : ""}`)}
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
        backHref={stepUrl("demo", "prepare", tail)}
        demo={{ signedIn }}
      />
    </main>
  );
}
