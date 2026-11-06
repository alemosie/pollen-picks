"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import type { BeehiivPublication } from "@/lib/beehiiv";
import { BeehiivMark } from "./BeehiivLogo";
import { PublicationSummary } from "./PublicationSummary";

export type BeehiivState = { last4: string; publications: BeehiivPublication[] } | null;

const field = "w-full rounded-xl bg-surface px-4 py-3 font-mono text-sm ring-1 ring-ink/15 focus:ring-2 focus:ring-ink";

/**
 * Connect (or show the connection to) beehiiv. The same UI sits in /settings and on /source.
 * The key is sent once to /api/beehiiv/connect and never comes back: only the last four characters and the publications.
 */
export function BeehiivConnect({
  initial,
  onChange,
  settingsLink = false,
  inCard = false,
}: {
  initial: BeehiivState;
  /** Called after connecting or removing, so a parent (the source page) can react. */
  onChange?: (state: BeehiivState) => void;
  /** On /source the connected card points to Settings for removing the key; on /settings it has the remove button itself. */
  settingsLink?: boolean;
  /** Inside the source card (not connected yet): the key field and its button in one row, like the public link card. */
  inCard?: boolean;
}) {
  const [state, setState] = useState<BeehiivState>(initial);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const helpId = useId();
  const errId = useId();

  const update = (next: BeehiivState) => {
    setState(next);
    onChange?.(next);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !key.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/beehiiv/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; last4?: string; publications?: BeehiivPublication[] };
      if (res.status === 401) {
        setError("Your Buffer login has expired. Log in again, then paste the key.");
      } else if (!res.ok || !data.last4) {
        setError(data.error ?? "Couldn't save the key. Try again in a moment.");
      } else {
        setKey("");
        setShow(false);
        update({ last4: data.last4, publications: data.publications ?? [] });
      }
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/beehiiv/connect", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't remove the key. Try again in a moment.");
      } else {
        update(null);
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
        <p role="status" className="mb-4 mt-0 inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-cream">
          <Check aria-hidden className="size-4" strokeWidth={3} /> Connected to beehiiv
        </p>
        <ul className="m-0 grid list-none gap-3 p-0">
          {state.publications.map((p) => (
            <li key={p.id}>
              <div className="rounded-2xl bg-surface p-4">
                <PublicationSummary publication={p} />
              </div>
              {!settingsLink && (
                <LogoField
                  publication={p}
                  onSaved={(publications) => update({ last4: state.last4, publications })}
                />
              )}
            </li>
          ))}
        </ul>
        <p className="mb-0 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <BeehiivMark className="h-4 w-auto" /> Key ending <span className="font-mono font-bold">{state.last4}</span> is saved.
          </span>
          {settingsLink ? (
            <Link href="/settings" className="font-bold underline underline-offset-4">
              Manage in Settings
            </Link>
          ) : (
            <button type="button" onClick={remove} disabled={busy} className="font-bold underline underline-offset-4 disabled:opacity-40">
              {busy ? "Removing…" : "Remove key"}
            </button>
          )}
        </p>
        {error && (
          <p role="alert" className="mb-0 mt-3 border-l-4 border-coral pl-3 text-sm font-semibold">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (inCard) {
    return (
      <form onSubmit={save} noValidate className="min-w-0">
        <label htmlFor={inputId} className="sr-only">
          beehiiv API key
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 sm:flex-1">
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
              placeholder="Paste your API key"
              aria-describedby={error ? `${helpId} ${errId}` : helpId}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-xl border-2 border-ink bg-surface py-3 pl-4 pr-12 text-base outline-none focus-visible:shadow-[0_0_0_1px_var(--color-ink)]"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide key" : "Show key"}
              aria-pressed={show}
              className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full hover:bg-ink/10"
            >
              {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
          </div>
          <button type="submit" disabled={busy || !key.trim()} className="rounded-xl bg-ink px-6 py-3 font-bold text-cream hover:bg-ink-deep disabled:opacity-60 max-sm:w-full">
            {busy ? "Checking…" : "Connect"}
          </button>
        </div>
        {error && (
          <p id={errId} role="alert" className="mb-0 mt-3 border-l-4 border-coral pl-3 text-sm font-semibold">
            {error}
          </p>
        )}
        <p id={helpId} className="mb-0 mt-3 leading-relaxed">
          Paste your beehiiv API key to share your own content, with top-click ranking and every issue in your archive. It is saved encrypted and only reads your posts.{" "}
          <Link href="/beehiiv/setup" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">
            How to get your key
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={save} noValidate>
      <label htmlFor={inputId} className="mb-2 block font-bold">
        beehiiv API key
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
          placeholder="Paste your key here"
          aria-describedby={error ? `${helpId} ${errId}` : helpId}
          aria-invalid={error ? true : undefined}
          className={`${field} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide key" : "Show key"}
          aria-pressed={show}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full hover:bg-ink/10"
        >
          {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      <p id={helpId} className="mb-0 mt-3 text-sm">
        This will save your beehiiv API key, encrypted, so Pollen Picks can read your newsletter posts. It only reads: it never edits, sends or deletes
        anything in beehiiv, and the key is never shown again. You can remove it any time in Settings.{" "}
        <Link href="/beehiiv/setup" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">
          How to get your key
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      </p>
      {error && (
        <p id={errId} role="alert" className="mb-0 mt-3 border-l-4 border-coral pl-3 text-sm font-semibold">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !key.trim()}
        className="mt-4 rounded-xl bg-ink px-5 py-2.5 font-bold text-cream hover:bg-ink-deep disabled:opacity-40"
      >
        {busy ? "Checking with beehiiv…" : "Save key"}
      </button>
    </form>
  );
}

/** Set the publication's logo by link, for when beehiiv's API doesn't hand it over. */
function LogoField({ publication: p, onSaved }: { publication: BeehiivPublication; onSaved: (publications: BeehiivPublication[]) => void }) {
  const [value, setValue] = useState(p.logo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function send(logo: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/beehiiv/connect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publication: p.id, logo }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; publications?: BeehiivPublication[] };
      if (!res.ok || !data.publications) setError(data.error ?? "Couldn't save the logo. Try again in a moment.");
      else {
        if (!logo) setValue("");
        onSaved(data.publications);
      }
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 px-1 text-sm">
      <label htmlFor={id} className="mb-1 block font-semibold">
        Newsletter logo link
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…/logo.png"
          autoComplete="off"
          data-1p-ignore
          className={`${field} min-w-0 flex-1 max-sm:basis-full`}
        />
        <button type="button" onClick={() => send(value)} disabled={busy || !value.trim()} className="rounded-xl bg-ink px-4 py-2 font-bold max-sm:flex-1 text-cream hover:bg-ink-deep disabled:opacity-40">
          {busy ? "Saving…" : "Save logo"}
        </button>
        {p.logo && (
          <button type="button" onClick={() => send("")} disabled={busy} className="rounded-xl px-3 py-2 font-bold underline underline-offset-4 disabled:opacity-40">
            Remove
          </button>
        )}
      </div>
      <p className="mb-0 mt-2">Shown next to this newsletter in the app, not on your slides. Paste a link to the image (https only).</p>
      {error && (
        <p role="alert" className="mb-0 mt-2 border-l-4 border-coral pl-3 font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
