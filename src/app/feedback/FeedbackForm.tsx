"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { primaryButton } from "@/components/FlowBar";
import { sessionId } from "@/lib/events";
import { shareLinksOffer } from "@/lib/sharedSlides";

const HOSTS = [
  { id: "beehiiv", label: "beehiiv" },
  { id: "substack", label: "Substack" },
  { id: "other", label: "Other" },
] as const;

const chip =
  "cursor-pointer rounded-xl bg-surface px-4 py-2.5 font-semibold ring-1 ring-ink/20 has-[:checked]:bg-ink has-[:checked]:text-cream has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink";
const field = "w-full rounded-xl bg-surface px-4 py-3 ring-1 ring-ink/20";

function Question({ title, required, hint, children }: { title: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="mb-8 border-0 p-0">
      <legend className="mb-2 text-lg font-bold">
        {title}
        {required && <span aria-hidden className="text-coral"> *</span>}
      </legend>
      {hint && <p className="mb-3 mt-0 text-sm">{hint}</p>}
      {children}
    </fieldset>
  );
}

function Scale({ name, low, high }: { name: string; low: string; high: string }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`${chip} grid size-12 place-items-center px-0`}>
            <input type="radio" name={name} value={n} className="sr-only" />
            {n}
          </label>
        ))}
      </div>
      <p className="mb-0 mt-2 flex max-w-xs justify-between text-sm">
        <span>{low}</span>
        <span>{high}</span>
      </p>
    </div>
  );
}

// What this browser could share, as a stable string for useSyncExternalStore ("" = nothing; also what the server renders).
const offerSnapshot = () => {
  const o = shareLinksOffer();
  return o ? JSON.stringify(o) : "";
};
const noSubscribe = () => () => {};
// The demo never sends or stores slides, so its form doesn't mention them.
const isDemoOffer = (offer: string) => {
  try {
    return new URL((JSON.parse(offer) as { slideUrl: string }).slideUrl).pathname.startsWith("/demo/");
  } catch {
    return true;
  }
};

export function FeedbackForm() {
  const offer = useSyncExternalStore(noSubscribe, offerSnapshot, () => "");
  const [host, setHost] = useState<string>("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    const quote = f.get("quote");
    if (!f.get("host") || !f.get("likelihood") || !quote) {
      setError("Please answer the questions marked with a star.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: f.get("host"),
          hostOther: f.get("hostOther"),
          easy: num("easy"),
          likelihood: num("likelihood"),
          loved: f.get("loved"),
          wouldChange: f.get("wouldChange"),
          quoteOk: quote === "yes",
          share: quote === "yes" && offer ? (JSON.parse(offer) as unknown) : undefined,
          session: sessionId(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that. Please try again in a moment.");
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  if (state === "done")
    return (
      <div role="status" className="rounded-2xl bg-accent p-6 sm:p-8">
        <h2 className="mb-3 text-3xl">Thanks for your feedback!</h2>
        <p className="mb-4 text-lg leading-relaxed">
          Every visitor and bit of feedback is super important to us. It&rsquo;s how we can iterate and put our best foot
          forward when we submit this project for Buffer Commit (a chance at up to $25,600 to be used for nonprofit
          funding!) on 13 Nov ❤️
        </p>
        <p className="mb-6 leading-relaxed">
          Pollen Picks has been built from a real use case: to extend the reach of Amsterdam Parent Project&rsquo;s popular
          local new-parent activities newsletter. Learn more about{" "}
          <a href="https://amsterdamparentproject.nl" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">
            Amsterdam Parent Project
          </a>{" "}
          or connect with Alex on{" "}
          <a
            href="https://www.linkedin.com/in/alexandrasiega/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline underline-offset-4"
          >
            LinkedIn
          </a>
          .
        </p>
        <Link href="/demo/source" className="inline-block rounded-xl bg-ink px-6 py-3 font-bold text-cream hover:bg-ink-deep">
          Back to Pollen Picks
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate>
      <Question title="Where do you host your newsletter?" required>
        <div className="flex flex-wrap gap-2">
          {HOSTS.map((h) => (
            <label key={h.id} className={chip}>
              <input type="radio" name="host" value={h.id} checked={host === h.id} onChange={() => setHost(h.id)} className="sr-only" />
              {h.label}
            </label>
          ))}
        </div>
        {host === "other" && (
          <input
            name="hostOther"
            maxLength={60}
            aria-label="Where do you host your newsletter?"
            placeholder="Which platform?"
            className={`${field} mt-3 max-w-sm`}
          />
        )}
      </Question>

      <Question title="Was it easy to use Pollen Picks?">
        <Scale name="easy" low="Really hard" high="Super easy" />
      </Question>

      <Question title="How likely are you to use it for your own content?" required>
        <Scale name="likelihood" low="Never" high="Every time I publish" />
      </Question>

      <Question title="What's one thing you loved?">
        <textarea name="loved" aria-label="What's one thing you loved?" rows={3} maxLength={1000} className={field} />
      </Question>

      <Question title="What's one thing you'd change?">
        <textarea name="wouldChange" aria-label="What's one thing you'd change?" rows={3} maxLength={1000} className={field} />
      </Question>

      <Question
        title="OK to share?"
        required
        hint={
          offer
            ? `If yes, we may share your feedback as a quote or visual on our website, to show how others are using Pollen Picks.${isDemoOffer(offer) ? "" : " If you have sent slides to Buffer, we also keep a copy of the latest ones."}`
            : "Yes means I may quote your feedback."
        }
      >
        <div className="flex flex-wrap gap-2">
          <label className={chip}>
            <input type="radio" name="quote" value="yes" className="sr-only" />
            Yes
          </label>
          <label className={chip}>
            <input type="radio" name="quote" value="no" className="sr-only" />
            No
          </label>
        </div>
      </Question>

      {error && (
        <p role="alert" className="mb-4 font-bold">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className={`${primaryButton} disabled:opacity-60`}>
        {state === "sending" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
