import { ServerTimings } from "@/components/ServerTimings";
import { timer } from "@/lib/timing";
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
import { knownForPicks } from "@/lib/instagramHandles";
import { picksInIssue, slideItemsFor } from "@/lib/slides/items";
import { PaletteSync } from "@/components/PaletteSync";
import { currentSlideSettings, loadSlideStyle } from "@/lib/slideStyleStore";
import { parseTemplateFromPage } from "@/lib/slides/options";
import { listChannels } from "@/lib/buffer";
import { lastSendChannelIds } from "@/lib/postHistory";
import { TemplateEditor } from "./TemplateEditor";

export const metadata = { title: "Design · Pollen Picks" };

export default function Design(props: PageProps<"/design">) {
  return (
    <Suspense fallback={<FlowLoader instant label="Setting up your carousel…" />}>
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
  const t = timer("/design");
  const session = await t.step("session", requireSession(`/design?${back.toString()}`));
  // filter(Boolean) first: Number("") is 0, so an empty ?picks= would otherwise count as pick #0.
  const asked = String(picks ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  if (asked.length === 0) redirect(stepUrl(mode, "pick"));

  const issue = await t.step("issue", loadAppIssue(mode));
  if (!issue) redirect("/source");
  // Picks the issue doesn't have (unsaved highlights, say) would leave blank slides: none left means there is nothing to design yet.
  const ids = picksInIssue(issue.chunks, asked);
  if (ids.length === 0) redirect(stepUrl(mode, "pick"));
  // The picks' handles and the slide settings don't depend on each other, so they load together.
  // The channels (Buffer) only say how many slides each network takes: if they can't be read the page just goes without that list.
  const [known, { version, palette }, savedStyle, channels, lastSend] = await Promise.all([
    t.step("handles", knownForPicks(issue.chunks, ids)),
    t.step("settings", currentSlideSettings()),
    t.step("brand", loadSlideStyle(session.userId)),
    t.step("channels (Buffer)", listChannels(session.accessToken).catch(() => undefined)),
    t.step("last send", lastSendChannelIds(session.userId)),
  ]);
  const items = slideItemsFor(issue.chunks, ids, known);
  const report = t.report();

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32 pt-6">
      <ServerTimings report={report} />
      <SaveStep step={3} />
      <Track event="design_reached" />
      <PageHeader current={3} hrefs={{ 1: "/source", 2: stepUrl(mode, "pick") }} />
      <PaletteSync palette={palette} />
      <TemplateEditor
        // A new source or new picks start from a clean editor, not from the state of a page that was visited before.
        key={`${mode}|${issue.url}|${ids.join(",")}`}
        mode={mode}
        issueKey={issue.url}
        newsletter={issue.newsletter}
        items={items}
        images={issue.images}
        picks={ids}
        channels={channels}
        lastSend={lastSend}
        brand={{ name: savedStyle?.style.orgName ?? "", fallbackName: issue.publication?.organization, logo: savedStyle?.style.orgLogo ?? null }}
        initial={{ ...parseTemplateFromPage(sp), sv: version }}
      />
    </main>
  );
}
