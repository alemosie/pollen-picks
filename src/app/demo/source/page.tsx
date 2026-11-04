import { DemoHeaderRight } from "@/components/DemoHeaderRight";
import { PageHeader } from "@/components/StepTree";
import { StepWord } from "@/components/StepWord";
import { loadDemoIssue } from "@/lib/demo";
import type { ReactNode } from "react";
import { stepUrl } from "@/lib/flow";
import { DemoSourcePicker } from "./DemoSourcePicker";

export const metadata = { title: "Demo: choose a source · Pollen Picks" };

type Source = { id: string; title: string; tag: string; badge?: string; body: ReactNode; tone: string; href?: string };

export default function DemoSource() {
  const issue = loadDemoIssue();
  const sources: Source[] = [
    {
      id: "demo",
      title: "Demo issue",
      tag: "Try it right now",
      badge: "beehiiv newsletter",
      body: (
        <>
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
        </>
      ),
      tone: "bg-accent",
      href: stepUrl("demo", "pick"),
    },
    {
      id: "beehiiv",
      title: "Beehiiv newsletter",
      tag: "Paste a public link",
      body: "Pick from the latest issue of any public beehiiv newsletter.",
      tone: "bg-card",
    },
    {
      id: "substack",
      title: "Substack newsletter",
      tag: "Paste a public link",
      body: "Pick from the latest post of any public Substack.",
      tone: "bg-card",
    },
    {
      id: "any",
      title: "Any public newsletter",
      tag: "Pick any content",
      body: "Highlight text from any newsletter you can open in a browser.",
      tone: "bg-card",
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
          Start with the demo issue. More sources are on the way.
        </p>
      </div>
      <DemoSourcePicker sources={sources} />
    </main>
  );
}
