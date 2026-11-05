import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { Track } from "@/components/Track";
import { requireSession } from "@/lib/auth";
import { listChannels } from "@/lib/buffer";
import { demoUrlFrom, parseLinkMode, stepUrl } from "@/lib/flow";
import { loadAppIssue } from "@/lib/sources";
import { knownForPicks } from "@/lib/instagramHandles";
import { captionItemsFor } from "@/lib/slides/items";
import { coverTitle, parseTemplateFromPage, templateParams } from "@/lib/slides/options";
import { WriteView } from "./WriteView";

export const metadata = { title: "Write · Pollen Picks" };

export default function Write(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<FlowLoader label="Getting your caption ready…" />}>
      <WriteContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function WriteContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;
  const mode = String(sp.mode ?? "");
  // The sample issue is the public demo: old demo links go to /demo/write, and need no login.
  if (mode === "demo") redirect(demoUrlFrom("write", sp));
  const tpl = parseTemplateFromPage(sp);
  const extra = templateParams(tpl).toString();
  // filter(Boolean) first: Number("") is 0, so an empty ?picks= would otherwise count as pick #0.
  const ids = String(sp.picks ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  const self = `/write?mode=${encodeURIComponent(mode)}&picks=${ids.join(",")}${extra ? `&${extra}` : ""}`;
  const session = await requireSession(self);
  if (ids.length === 0) redirect(stepUrl(mode, "pick"));

  const issue = await loadAppIssue(mode);
  if (!issue) redirect("/source");
  const channels = await listChannels(session.accessToken);
  const q = ids.join(",");
  const known = await knownForPicks(issue.chunks, ids);


  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <SaveStep step={4} />
      <Track event="write_reached" />
      <PageHeader
        current={4}
        hrefs={{
          1: "/source",
          2: stepUrl(mode, "pick"),
          3: stepUrl(mode, "design", `picks=${q}${extra ? `&${extra}` : ""}`),
        }}
      />
      <WriteView
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
          known,
        )}
        newsletter={issue.newsletter}
        author={issue.author}
        creditLink={Boolean(parseLinkMode(mode))}
        heading={coverTitle(tpl)}
        nextHref={stepUrl(mode, "send", `picks=${q}${extra ? `&${extra}` : ""}`)}
        backHref={stepUrl(mode, "design", `picks=${q}${extra ? `&${extra}` : ""}`)}
      />
    </main>
  );
}
