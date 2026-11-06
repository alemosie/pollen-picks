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

export const metadata = { title: "Choose a post · Pollen Picks" };

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
      <div className="mb-10 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:gap-x-4">
          <h1 className="mb-3 col-span-2 row-start-2 min-w-0 text-3xl sm:col-span-1 sm:col-start-1 sm:row-start-1 sm:text-5xl">
            Choose a <StepWord>post</StepWord>
          </h1>
          <p className="col-span-2 row-start-3 mb-0 max-w-2xl text-lg sm:col-span-1 sm:col-start-1 sm:row-start-2">
          Buffer is connected. Paste a link to any public post, or choose one of your
          own newsletter issues.
        </p>
          <div className="col-span-2 row-start-1 mb-2 justify-self-end sm:col-span-1 sm:col-start-2 sm:mb-0 sm:self-start sm:row-span-2 sm:mt-2">
            <ShareLinkButton />
          </div>
      </div>

      <ServerTimings report={t.report()} />
      <ModePicker beehiiv={beehiiv} initialIssues={null} initialIssuesError={null} />
    </main>
  );
}
