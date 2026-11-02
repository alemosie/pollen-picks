import { Suspense } from "react";
import { StepWord } from "@/components/StepWord";
import { connection } from "next/server";
import { PageHeader } from "@/components/StepTree";
import { requireSession } from "@/lib/auth";
import { ModePicker } from "./ModePicker";

export const metadata = { title: "Choose your setup · Pollen Picks" };

export default function Start() {
  return (
    <Suspense fallback={null}>
      <StartContent />
    </Suspense>
  );
}

async function StartContent() {
  await connection();
  await requireSession("/source");

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-6">

      <PageHeader current={1} />
      <div className="mb-10">
      <h1 className="mb-3 text-4xl sm:text-5xl">Choose your newsletter <StepWord>source</StepWord></h1>
      <p className="mb-0 max-w-2xl text-lg">Buffer is connected. Now choose where the content comes from. You can switch any time.</p>
      </div>

      <ModePicker />
    </main>
  );
}
