import { DemoHeaderRight } from "@/components/DemoHeaderRight";
import { PageHeader } from "@/components/StepTree";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StepWord } from "@/components/StepWord";
import { loadDemoIssue } from "@/lib/demo";
import { DemoSourcePicker } from "./DemoSourcePicker";

export const metadata = { title: "Demo: Choose a post · Pollen Picks" };

export default function DemoSource() {
  const issue = loadDemoIssue();

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <PageHeader current={1} right={<DemoHeaderRight />} finalLabel="Finish" />
      <div className="mb-10 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 sm:gap-x-4">
        <h1 className="col-start-1 row-start-1 mb-3 min-w-0 text-3xl sm:text-5xl">
          Choose a <StepWord>post</StepWord>
        </h1>
        <p className="col-span-2 row-start-2 mb-0 max-w-2xl text-lg sm:col-span-1 sm:col-start-1">
          Try the demo issue, or paste a link to a public post and highlight what you want to share.
        </p>
        <div className="col-start-2 row-start-1 self-start sm:row-span-2 sm:mt-2">
          <ShareLinkButton title="Anyone with this link can open this demo, no account needed" />
        </div>
      </div>
      <DemoSourcePicker demoIssue={{ title: issue.title, publishedAt: issue.publishedAt, thumbnail: issue.thumbnail, newsletter: issue.newsletter, author: issue.author }} />
    </main>
  );
}
