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
import { filtersToQuery, hasFilters, parseFilters } from "@/lib/historyFilters";
import { historyFacets, listHistory } from "@/lib/postHistory";
import { currentSlideSettings } from "@/lib/slideStyleStore";
import { HistoryFilterBar } from "./HistoryFilterBar";
import { HistoryList } from "./HistoryList";
import { HistoryCheckButton, HistoryProvider } from "./HistoryProvider";

export const metadata = { title: "History · Pollen Picks" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function History({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<FlowLoader label="Opening your history…" />}>
      <HistoryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HistoryContent({ searchParams }: { searchParams: Search }) {
  await connection();
  const sp = await searchParams;
  const filters = parseFilters((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));
  const filterQuery = filtersToQuery(filters);
  const session = await requireSession("/history");
  const [{ palette }, entries, facets] = await Promise.all([
    currentSlideSettings(),
    listHistory(session.userId, { filters }).catch(() => null),
    historyFacets(session.userId).catch(() => null),
  ]);
  return (
    <HistoryProvider key={filterQuery} initial={entries ?? []} filterQuery={filterQuery}>
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
          <div className="flex flex-wrap items-center gap-2 sm:mt-2">
            {entries !== null && entries.length > 0 && <HistoryCheckButton />}
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
          Every draft and post Pollen Picks has tried to create in Buffer for you, including any that failed. Each one has its link to open it in Buffer and, once a post is out, its live link. Posts that are still publishing update here on their own.
        </p>
      </div>
      {entries !== null && (entries.length > 0 || hasFilters(filters)) && <FeedbackPrompt className="mb-6" />}
      <section aria-label="History" className="rounded-2xl bg-card p-6">
        {entries === null ? (
          <p role="alert" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
            Couldn&rsquo;t load your history. Reload the page to try again.
          </p>
        ) : (
          <>
            {facets && (facets.services.length > 0 || hasFilters(filters)) && <HistoryFilterBar facets={facets} />}
            <HistoryList filterQuery={filterQuery} />
          </>
        )}
      </section>
    </main>
    </HistoryProvider>
  );
}
