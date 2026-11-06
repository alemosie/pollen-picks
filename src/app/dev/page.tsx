import { notFound } from "next/navigation";
import { FAKE_KEY } from "@/lib/fakeBeehiiv";
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
      <section className="mt-6 grid max-w-2xl gap-2 rounded-2xl bg-card p-5">
        <h2 className="m-0 text-xl">Pretend beehiiv publications</h2>
        <p className="m-0 text-sm">
          Paste this key in <b>Connect beehiiv</b> (on /source or in Settings) to get four made-up publications with different layouts, date styles and click data. It replaces any beehiiv key saved for your dev account, so connect your real one again afterwards.
        </p>
        <code className="w-fit select-all rounded-lg bg-surface px-3 py-2 text-sm">{FAKE_KEY}</code>
        <p className="m-0 text-sm">
          To see how each issue is read and ranked without the browser, run <code>yarn check:fake</code>.
        </p>
      </section>
    </main>
  );
}
