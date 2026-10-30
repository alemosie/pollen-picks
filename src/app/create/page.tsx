import Link from "next/link";

export const metadata = { title: "Create · Pollen Picks" };

// Placeholder: the template creator comes next.
export default function Create() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="mb-3 text-4xl">Template creator</h1>
      <p className="mb-6">Coming next: your carousel and caption, side by side.</p>
      <Link href="/pick?mode=demo" className="font-semibold underline underline-offset-4">
        Back to picks
      </Link>
    </main>
  );
}
