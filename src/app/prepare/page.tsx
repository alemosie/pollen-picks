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
import { captionItemsFor } from "@/lib/slides/items";
import { parseTemplateFromPage, templateParams } from "@/lib/slides/options";
import { PrepareView } from "./PrepareView";

export const metadata = { title: "Send · Pollen Picks" };

export default function Send(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<FlowLoader label="Getting your channels ready…" />}>
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
  // The sample issue is the public demo: old demo links go to /demo/prepare, and need no login.
  if (mode === "demo") redirect(demoUrlFrom("prepare", sp));
  const tpl = parseTemplateFromPage(sp);
  const extra = templateParams(tpl).toString();
  const ids = String(sp.picks ?? "")
    .split(",")
    .map(Number)
    .filter(Number.isFinite);
  const self = `/prepare?mode=${encodeURIComponent(mode)}&picks=${ids.join(",")}${extra ? `&${extra}` : ""}`;
  const session = await requireSession(self);
  if (ids.length === 0) redirect(stepUrl(mode, "pick"));

  const issue = await loadAppIssue(mode);
  if (!issue) redirect("/source");
  const channels = await listChannels(session.accessToken);
  const q = ids.join(",");

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <SaveStep step={4} />
      <PageHeader
        current={4}
        hrefs={{
          1: "/source",
          2: stepUrl(mode, "pick"),
          3: stepUrl(mode, "design", `picks=${q}${extra ? `&${extra}` : ""}`),
        }}
      />
      <PrepareView
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
        nextHref={stepUrl(mode, "send", `picks=${q}${extra ? `&${extra}` : ""}`)}
        backHref={stepUrl(mode, "design", `picks=${q}${extra ? `&${extra}` : ""}`)}
      />
    </main>
  );
}
