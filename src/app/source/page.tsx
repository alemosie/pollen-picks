import { Suspense } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import { connection } from "next/server";
import { PageHeader } from "@/components/StepTree";
import { requireSession, sessionUserId } from "@/lib/auth";
import { getBeehiivConnection } from "@/lib/connections";
import { ServerTimings } from "@/components/ServerTimings";
import { timer } from "@/lib/timing";
import { ModePicker } from "./ModePicker";

export const metadata = { title: "Choose your setup · Pollen Picks" };

export default function Start() {
  return (
    <Suspense fallback={<FlowLoader label="Opening your source…" />}>
      <StartContent />
    </Suspense>
  );
}

async function StartContent() {
  await connection();
  // The connection read needs only the id from the cookie, so it runs alongside the session check instead of after it. The issue list is not loaded
  // here: it is a call to beehiiv, and the page used to wait for it behind the loader. The picker asks for it as soon as it is on screen.
  const t = timer("/source");
  const uid = await sessionUserId();
  const [, beehiiv] = await Promise.all([t.step("session", requireSession("/source")), t.step("connection", uid ? getBeehiivConnection(uid) : Promise.resolve(null))]);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <PageHeader current={1} />
      <div className="mb-10">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h1 className="mb-3 text-4xl sm:text-5xl">
            Choose your newsletter <StepWord>source</StepWord>
          </h1>
          <div className="sm:mt-2">
            <ShareLinkButton />
          </div>
        </div>
        <p className="mb-0 max-w-2xl text-lg">
          Buffer is connected. Now choose where the content comes from. You can
          switch any time.
        </p>
      </div>

      <ServerTimings report={t.report()} />
      <ModePicker beehiiv={beehiiv} initialIssues={null} initialIssuesError={null} />
    </main>
  );
}
