import { notFound } from "next/navigation";
import { DevPanel } from "./DevPanel";

export const metadata = { title: "Dev settings · Pollen Picks", robots: { index: false } };

/** Development only (404 in production): choose how fake Buffer behaves, without env vars. */
export default function Dev() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">
      <h1 className="mb-2 text-4xl">Dev settings</h1>
      <p className="mb-8 max-w-2xl text-lg">
        Choose how fake Buffer behaves, to try the send, History and retry states without a real post. Applies to the next send. Only exists in development.
      </p>
      <DevPanel />
    </main>
  );
}
