import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountLinks } from "@/components/AccountLinks";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";
import { FlowLoader } from "@/components/FlowLoader";
import { Logo } from "@/components/Logo";
import { PaletteSync } from "@/components/PaletteSync";
import { StepWord } from "@/components/StepWord";
import { requireSession } from "@/lib/auth";
import { listHistory } from "@/lib/postHistory";
import { listCreations } from "@/lib/savedCreations";
import { currentSlideSettings } from "@/lib/slideStyleStore";
import { HistoryList } from "./HistoryList";
import { HistoryProvider } from "./HistoryProvider";
import { SavedCreations } from "./SavedCreations";

export const metadata = { title: "History · Pollen Picks" };

export default function History() {
  return (
    <Suspense fallback={<FlowLoader label="Opening your history…" />}>
      <HistoryContent />
    </Suspense>
  );
}

async function HistoryContent() {
  await connection();
  const session = await requireSession("/history");
  const [{ palette }, entries, saved] = await Promise.all([currentSlideSettings(), listHistory(session.userId).catch(() => null), listCreations(session.userId).catch(() => null)]);
  return (
    <HistoryProvider initial={entries ?? []} filterQuery="">
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-6">
      <PaletteSync palette={palette} />
      <header className="mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 sm:mb-14">
        <Logo height={48} href="/" />
        <AccountLinks current="history" />
      </header>
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h1 className="mb-3 text-4xl sm:text-5xl">
            <StepWord>History</StepWord>
          </h1>
          <div className="flex flex-wrap items-center gap-2 max-sm:mb-4 sm:mt-2">
            <Link
              href="/source"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-surface px-4 py-2.5 font-bold ring-1 ring-ink/15 transition hover:ring-ink/40"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Back to the app
            </Link>
          </div>
        </div>
        <p className="mb-0 max-w-2xl text-lg">
          Your saved creations, then every draft and post Pollen Picks has tried to create in Buffer for you, including any that failed. Each one has its link to open it in Buffer and, once a post is out, its live link. Posts that are still publishing update here on their own.
        </p>
      </div>
      {entries !== null && entries.length > 0 && <FeedbackPrompt className="mb-8" />}
      {saved === null ? (
        <p role="alert" className="mb-8 border-l-4 border-coral pl-3 text-sm font-semibold">
          Couldn&rsquo;t load your saved creations. Reload the page to try again.
        </p>
      ) : (
        <SavedCreations items={saved} />
      )}
      <h2 id="sent-history" className="mb-3 text-2xl">
        Sent to Buffer
      </h2>
      <section aria-label="History">
        {entries === null ? (
          <p role="alert" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
            Couldn&rsquo;t load your history. Reload the page to try again.
          </p>
        ) : (
          <HistoryList />
        )}
      </section>
    </main>
    </HistoryProvider>
  );
}
