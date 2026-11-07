import { ServerTimings } from "@/components/ServerTimings";
import { timer } from "@/lib/timing";
import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/StepTree";
import { SaveStep } from "@/components/SaveStep";
import { Track } from "@/components/Track";
import { currentSession, toLogin } from "@/lib/auth";
import { listChannels } from "@/lib/buffer";
import { demoUrlFrom, parseLinkMode, stepUrl } from "@/lib/flow";
import { loadAppIssue } from "@/lib/sources";
import { knownForPicks } from "@/lib/instagramHandles";
import { captionItemsFor } from "@/lib/slides/items";
import { currentStyleVersion } from "@/lib/slideStyleStore";
import { coverTitle, parseTemplateFromPage, templateParams, pickEditsFor } from "@/lib/slides/options";
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
  // The style version (database) and the session check (database) don't depend on each other, so they run together.
  const t = timer("/write");
  const [sv, session] = await Promise.all([t.step("style version", currentStyleVersion()), t.step("session", currentSession())]);
  const tpl = { ...parseTemplateFromPage(sp), sv };
  const extra = templateParams(tpl).toString();
  // filter(Boolean) first: Number("") is 0, so an empty ?picks= would otherwise count as pick #0.
  const ids = String(sp.picks ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  const self = `/write?mode=${encodeURIComponent(mode)}&picks=${ids.join(",")}${extra ? `&${extra}` : ""}`;
  if (!session) toLogin(self);
  if (ids.length === 0) redirect(stepUrl(mode, "pick"));

  // The issue (database, beehiiv) and the channels (Buffer) don't depend on each other, so they load together.
  const [issue, channels] = await Promise.all([t.step("issue", loadAppIssue(mode)), t.step("channels (Buffer)", listChannels(session.accessToken))]);
  if (!issue) redirect("/source");
  const q = ids.join(",");
  const known = await t.step("handles", knownForPicks(issue.chunks, ids));
  const report = t.report();


  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <ServerTimings report={report} />
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
        key={`${mode}|${issue.url}|${q}|${extra}`}
        channels={channels}
        source={mode}
        picks={ids}
        template={extra}
        link={issue.url}
        captionItems={captionItemsFor(
          issue.chunks,
          tpl.spec
            ? tpl.spec.slides.flat().filter((id) => ids.includes(id))
            : ids,
          issue.publishedAt.slice(0, 10),
          pickEditsFor(tpl.spec),
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
