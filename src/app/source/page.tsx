import { Suspense } from "react";
import { connection } from "next/server";
import { Logo } from "@/components/Logo";
import { StepAside } from "@/components/StepTree";
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
    <main className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-12 flex items-center justify-between">
        <Logo height={52} />
        <a href="/api/auth/buffer/logout" className="text-sm font-semibold underline underline-offset-4">
          Log out
        </a>
      </header>

      <StepAside current={2} hrefs={{ 1: "/" }} />
      <div className="mb-10">
      <h1 className="mb-3 text-4xl sm:text-5xl">Choose your newsletter source</h1>
      <p className="mb-0 max-w-2xl text-lg">Buffer is connected. Now choose where the content comes from. You can switch any time.</p>
      </div>

      <ModePicker />
    </main>
  );
}
