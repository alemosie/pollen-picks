import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StepAside } from "@/components/StepTree";
import { requireSession } from "@/lib/auth";
import { loadDemoIssue } from "@/lib/demo";
import { planSlides } from "@/lib/slides/plan";
import { slideItemsFor } from "@/lib/slides/items";

export const metadata = { title: "Create · Pollen Picks" };

export default function Create(props: PageProps<"/create">) {
  return (
    <Suspense fallback={null}>
      <CreateContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CreateContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { mode, picks } = await searchParams;
  await requireSession(`/create?mode=${encodeURIComponent(String(mode ?? ""))}&picks=${encodeURIComponent(String(picks ?? ""))}`);
  const ids = String(picks ?? "").split(",").map(Number).filter(Number.isFinite);
  if (mode !== "demo" || ids.length === 0) redirect("/pick?mode=demo");

  const issue = loadDemoIssue();
  const slides = planSlides(slideItemsFor(issue.chunks, ids), { newsletter: "Just a Phase" });
  const q = encodeURIComponent(ids.join(","));

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16 pt-6">
      <header className="mb-12 flex items-center justify-between">
        <Logo height={52} href="/source" />
        <Link href="/pick?mode=demo" className="text-sm font-semibold underline underline-offset-4">
          Back to picks
        </Link>
      </header>
      <StepAside current={4} hrefs={{ 1: "/", 2: "/source", 3: "/pick?mode=demo" }} />
      <div className="mb-10">
      <h1 className="mb-3 text-4xl sm:text-5xl">Your carousel</h1>
      <p className="mb-0 max-w-2xl text-lg">
        {slides.length} slides from {ids.length} {ids.length === 1 ? "pick" : "picks"}. Template editing and captions come next.
      </p>
      </div>
      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {slides.map((s, i) => (
          <li key={i} className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/slide/preview?picks=${q}&n=${i}`}
              alt={`Slide ${i + 1} of ${slides.length}`}
              width={540}
              height={675}
              loading={i < 5 ? "eager" : "lazy"}
              className="aspect-[4/5] w-full rounded-2xl bg-surface ring-1 ring-ink/10"
            />
            <span className="text-xs font-semibold">
              {i + 1}. {s.kind === "cover" ? "Cover" : s.kind === "closing" ? "Closing" : `${s.items.length} ${s.items.length === 1 ? "pick" : "picks"}`}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
