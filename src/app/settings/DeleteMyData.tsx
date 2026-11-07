"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Settings > Account: delete everything Pollen Picks holds for this account. Asks first, then ends the session. */
export function DeleteMyData() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStep("busy");
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(res.status === 401 ? "Your Buffer login has expired. Log in again, then try once more." : (data.error ?? "Couldn't delete everything. Try again in a moment."));
        return setStep("confirm");
      }
      setStep("done");
      window.setTimeout(() => router.replace("/"), 2500);
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
      setStep("confirm");
    }
  }

  if (step === "done")
    return (
      <p role="status" className="m-0 rounded-xl bg-surface p-4 text-sm font-semibold">
        Your data is deleted and you&rsquo;re logged out. Taking you home&hellip;
      </p>
    );

  return (
    <div className="grid max-w-xl gap-3">
      {step === "idle" ? (
        <div>
          <button
            type="button"
            onClick={() => setStep("confirm")}
            className="inline-flex items-center gap-2 rounded-xl bg-surface px-5 py-2.5 font-bold ring-1 ring-ink/15 hover:ring-ink/40"
          >
            <Trash2 aria-hidden className="size-4" strokeWidth={2.25} />
            Delete my data
          </button>
        </div>
      ) : (
        <div role="group" aria-label="Confirm deleting your data" className="grid gap-3 rounded-2xl bg-coral/20 p-4">
          <p className="m-0 font-bold">Delete everything Pollen Picks holds about you?</p>
          <p className="m-0 text-sm">
            This removes your account, your beehiiv key and Buffer access, your settings and slide style, your history, your saved creations, your current run and anything still waiting to send,
            and the text you highlighted. It can&rsquo;t be undone. It doesn&rsquo;t touch anything in Buffer or beehiiv: drafts and posts already created
            there stay where they are.
          </p>
          {error && (
            <p role="alert" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={run}
              disabled={step === "busy"}
              className="rounded-xl bg-coral px-4 py-2 font-bold text-ink-deep hover:brightness-95 disabled:opacity-60"
            >
              {step === "busy" ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setError(null);
              }}
              disabled={step === "busy"}
              className="rounded-xl bg-surface px-4 py-2 font-bold ring-1 ring-ink/20 hover:ring-ink/40 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
