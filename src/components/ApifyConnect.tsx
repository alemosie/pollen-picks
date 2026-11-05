"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

export type ApifyState = { last4: string } | null;

const field = "w-full rounded-xl bg-surface px-4 py-3 font-mono text-sm ring-1 ring-ink/15 focus:ring-2 focus:ring-ink";
const TOKEN_PAGE = "https://console.apify.com/settings/integrations";

/**
 * Save (or remove) the user's own Apify token, which pays for their Instagram lookups once the free ones are used.
 * The token is sent once to /api/apify/connect and never comes back: only its last four characters.
 */
export function ApifyConnect({ initial, onChange }: { initial: ApifyState; onChange?: (state: ApifyState) => void }) {
  const [state, setState] = useState<ApifyState>(initial);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const helpId = useId();
  const errId = useId();

  const update = (next: ApifyState) => {
    setState(next);
    onChange?.(next);
  };

  async function call(method: "POST" | "DELETE") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apify/connect", {
        method,
        ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; last4?: string };
      if (res.status === 401) setError("Your Buffer login has expired. Log in again, then paste the token.");
      else if (!res.ok) setError(data.error ?? "That didn't work. Try again in a moment.");
      else if (method === "DELETE") update(null);
      else {
        setKey("");
        setShow(false);
        update({ last4: data.last4 ?? "" });
      }
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state) {
    return (
      <div>
        <p role="status" className="mb-3 mt-0 inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-cream">
          <Check aria-hidden className="size-4" strokeWidth={3} /> Your Apify token is saved
        </p>
        <p className="mb-0 mt-0 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span>
            Token ending <span className="font-mono font-bold">{state.last4}</span> pays for your Instagram account lookups.
          </span>
          <button type="button" onClick={() => call("DELETE")} disabled={busy} className="font-bold underline underline-offset-4 disabled:opacity-40">
            {busy ? "Removing…" : "Remove token"}
          </button>
        </p>
        {error && (
          <p role="alert" className="mb-0 mt-3 border-l-4 border-coral pl-3 text-sm font-semibold">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (key.trim()) void call("POST");
      }}
      noValidate
    >
      <label htmlFor={inputId} className="mb-2 block font-bold">
        Apify API token
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={show ? "text" : "password"}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore
          placeholder="Paste your token here"
          aria-describedby={error ? `${helpId} ${errId}` : helpId}
          aria-invalid={error ? true : undefined}
          className={`${field} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide token" : "Show token"}
          aria-pressed={show}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full hover:bg-ink/10"
        >
          {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      <p id={helpId} className="mb-0 mt-3 text-sm">
        Pollen Picks uses your token only to find which Instagram account owns a post you pick, so your Instagram captions and slides can tag it. It is
        saved encrypted and never shown again; remove it any time in Settings. Each lookup costs about $0.002 on your Apify account (Apify&rsquo;s free plan
        includes $5 a month).{" "}
        <a href={TOKEN_PAGE} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">
          Get your token in Apify
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
      {error && (
        <p id={errId} role="alert" className="mb-0 mt-3 border-l-4 border-coral pl-3 text-sm font-semibold">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !key.trim()} className="mt-4 rounded-xl bg-ink px-5 py-2.5 font-bold text-cream hover:bg-ink-deep disabled:opacity-40">
        {busy ? "Checking with Apify…" : "Save token"}
      </button>
    </form>
  );
}
