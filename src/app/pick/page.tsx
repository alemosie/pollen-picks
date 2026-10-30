import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/auth";
import { loadDemoIssue } from "@/lib/demo";
import { Picker } from "./Picker";

export const metadata = { title: "Pick content · Pollen Picks" };

export default function Pick(props: PageProps<"/pick">) {
  return (
    <Suspense fallback={null}>
      <PickContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PickContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  if (!(await getSession())) redirect("/");
  const { mode } = await searchParams;
  if (mode !== "demo") redirect("/start"); // public / own-newsletter modes arrive later

  const issue = loadDemoIssue();
  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <header className="mb-8 flex items-center justify-between">
        <Logo height={48} href="/start" />
        <a href="/api/auth/buffer/logout" className="text-sm font-semibold underline underline-offset-4">
          Log out
        </a>
      </header>
      <p className="mb-1 w-fit rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold">Demo issue</p>
      <h1 className="mb-1 text-3xl sm:text-4xl">What should we post?</h1>
      <p className="mb-6">{issue.title}. Choose 1 to 20 items.</p>
      <Picker mode="demo" chunks={issue.chunks} hasClicks={issue.hasClicks} />
    </main>
  );
}
