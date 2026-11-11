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
import { lastSendChannelIds } from "@/lib/postHistory";
import { demoUrlFrom, parseLinkMode, previewMode, stepUrl } from "@/lib/flow";
import { loadAppIssue } from "@/lib/sources";
import { knownForPicks } from "@/lib/instagramHandles";
import { captionItemsFor, picksInIssue, slideItemsFor } from "@/lib/slides/items";
import { currentStyleVersion, loadLinkedinFormat } from "@/lib/slideStyleStore";
import { coverTitle, parseTemplateFromPage, templateParams, pickEditsFor } from "@/lib/slides/options";
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
  // The style version (database) and the session check (database) don't depend on each other, so they run together.
  const t = timer("/send");
  const [sv, session] = await Promise.all([t.step("style version", currentStyleVersion()), t.step("session", currentSession())]);
  const tpl = { ...parseTemplateFromPage(sp), sv };
  const extra = templateParams(tpl).toString();
  // filter(Boolean) first: Number("") is 0, so an empty ?picks= would otherwise count as pick #0.
  const asked = String(sp.picks ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  if (!session) toLogin(`/send?mode=${encodeURIComponent(mode)}&picks=${asked.join(",")}${extra ? `&${extra}` : ""}`);
  if (asked.length === 0) redirect(stepUrl(mode, "pick"));

  // The issue (database, beehiiv) and the channels (Buffer) don't depend on each other, so they load together.
  const [issue, channels, linkedinFormat, lastSend] = await Promise.all([
    t.step("issue", loadAppIssue(mode)),
    t.step("channels (Buffer)", listChannels(session.accessToken)),
    t.step("LinkedIn format", loadLinkedinFormat(session.userId)),
    t.step("last send", lastSendChannelIds(session.userId)),
  ]);
  if (!issue) redirect("/source");
  // Picks the issue doesn't have (unsaved highlights, say) can't be sent: none left means back to Pick.
  const ids = picksInIssue(issue.chunks, asked);
  if (ids.length === 0) redirect(stepUrl(mode, "pick"));
  const tail = `${ids.join(",")}${extra ? `&${extra}` : ""}`;
  const known = await t.step("handles", knownForPicks(issue.chunks, ids));
  const report = t.report();
  const slides = planSlides(slideItemsFor(issue.chunks, ids, known), {
    newsletter: issue.newsletter,
    ...tpl,
  });
  const q = ids.join(",");

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <ServerTimings report={report} />
      <SaveStep step={5} />
      <Track event="send_reached" />
      <PageHeader
        current={5}
        hrefs={{
          1: "/source",
          2: stepUrl(mode, "pick"),
          3: stepUrl(mode, "design", `picks=${tail}`),
          4: stepUrl(mode, "write", `picks=${tail}`),
        }}
      />
      <SendConfirm
        key={`${mode}|${issue.url}|${q}|${extra}`}
        urls={slides.map(
          (_, i) =>
            `/api/slide/preview?picks=${q}&n=${i}${extra ? `&${extra}` : ""}${previewMode(mode)}`,
        )}
        channels={channels}
        lastSend={lastSend}
        picks={ids}
        source={mode}
        template={extra}
        linkedinFormat={linkedinFormat}
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
        backHref={stepUrl(mode, "write", `picks=${tail}`)}
      />
    </main>
  );
}
