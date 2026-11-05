import { DemoHeaderRight } from "@/components/DemoHeaderRight";
import { PageHeader } from "@/components/StepTree";
import { StepWord } from "@/components/StepWord";
import { loadDemoIssue } from "@/lib/demo";
import type { ReactNode } from "react";
import { stepUrl } from "@/lib/flow";
import { PublicSourceBody, SourceLogos } from "@/components/PublicSource";
import { DemoSourcePicker } from "./DemoSourcePicker";

export const metadata = { title: "Demo: choose a source · Pollen Picks" };

type Source = { id: string; title: string; tag: string; logos: ReactNode; body: ReactNode; tone: string; href?: string; link?: boolean };

export default function DemoSource() {
  const issue = loadDemoIssue();
  const sources: Source[] = [
    {
      id: "demo",
      title: "Demo issue",
      tag: "Try it right now",
      logos: <SourceLogos />,
      body: (
        <span className="leading-relaxed">
          Pick from a real issue of{" "}
          <a
            href="https://amsterdamparentproject.beehiiv.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline decoration-[3px] underline-offset-4 hover:decoration-coral"
          >
            {issue.newsletter}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          , a beehiiv newsletter, with real click data. No account needed.
        </span>
      ),
      tone: "bg-accent",
      href: stepUrl("demo", "pick"),
    },
    {
      id: "public",
      title: "Public link",
      tag: "Paste a public link",
      logos: <SourceLogos substack more="and any public link" />,
      body: <PublicSourceBody />,
      tone: "bg-card",
      link: true,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">
      <PageHeader current={1} right={<DemoHeaderRight />} finalLabel="Finish" />
      <div className="mb-10">
        <h1 className="mb-3 text-4xl sm:text-5xl">
          Choose a newsletter <StepWord>source</StepWord>
        </h1>
        <p className="mb-0 max-w-2xl text-lg">
          Start with the demo issue, or paste a link to a public post and highlight what you want to share.
        </p>
      </div>
      <DemoSourcePicker sources={sources} demoIssue={{ title: issue.title, publishedAt: issue.publishedAt, thumbnail: issue.thumbnail, newsletter: issue.newsletter, author: issue.author }} />
    </main>
  );
}
