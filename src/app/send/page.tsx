import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { requireSession } from "@/lib/auth";
import { listChannels } from "@/lib/buffer";
import { demoUrlFrom, stepUrl } from "@/lib/flow";
import { loadAppIssue } from "@/lib/sources";
import { captionItemsFor, slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFromPage, templateParams } from "@/lib/slides/options";
import { planSlides } from "@/lib/slides/plan";
import { SendConfirm } from "./SendConfirm";

export const metadata = { title: "Send · Pollen Picks" };

export default function Send(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<FlowLoader label="Preparing to send…" />}>
      <SendContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SendContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;
  const mode = String(sp.mode ?? "");
  // The sample issue is the public demo: old demo links go to /demo/send, and need no login.
  if (mode === "demo") redirect(demoUrlFrom("send", sp));
  const tpl = parseTemplateFromPage(sp);
  const extra = templateParams(tpl).toString();
  // filter(Boolean) first: Number("") is 0, so an empty ?picks= would otherwise count as pick #0.
  const ids = String(sp.picks ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  const tail = `${ids.join(",")}${extra ? `&${extra}` : ""}`;
  const session = await requireSession(
    `/send?mode=${encodeURIComponent(mode)}&picks=${tail}`,
  );
  if (ids.length === 0) redirect(stepUrl(mode, "pick"));

  const issue = await loadAppIssue(mode);
  if (!issue) redirect("/source");
  const slides = planSlides(slideItemsFor(issue.chunks, ids), {
    newsletter: "Just a Phase",
    ...tpl,
  });
  const channels = await listChannels(session.accessToken);
  const q = ids.join(",");

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <SaveStep step={5} />
      <PageHeader
        current={5}
        hrefs={{
          1: "/source",
          2: stepUrl(mode, "pick"),
          3: stepUrl(mode, "design", `picks=${tail}`),
          4: stepUrl(mode, "prepare", `picks=${tail}`),
        }}
      />
      <SendConfirm
        urls={slides.map(
          (_, i) =>
            `/api/slide/preview?picks=${q}&n=${i}${extra ? `&${extra}` : ""}`,
        )}
        channels={channels}
        picks={ids}
        template={extra}
        link={issue.url}
        captionItems={captionItemsFor(
          issue.chunks,
          tpl.spec
            ? tpl.spec.slides.flat().filter((id) => ids.includes(id))
            : ids,
          issue.publishedAt.slice(0, 10),
          tpl.spec?.edits,
        )}
        newsletter="Just a Phase"
        heading={tpl.heading}
        backHref={stepUrl(mode, "prepare", `picks=${tail}`)}
      />
    </main>
  );
}
