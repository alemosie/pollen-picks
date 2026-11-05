"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SAVED_EVENT } from "@/lib/progress";
import { MAX_ORG_NAME } from "@/lib/slides/style";
import { logoFromFile } from "./shrinkLogo";

const field = "w-full rounded-xl bg-surface px-4 py-2.5 ring-1 ring-ink/15";

/**
 * Settings > Organization: the name and logo shown wherever a slide's header or footer is set to "Organization" (Slide style).
 * Saves as you go. Only these two fields are sent, so it never touches the slide style chosen on the other screen.
 */
export function OrganizationEditor({ initialName, initialLogo, orgFallback }: { initialName: string; initialLogo: string | null; orgFallback?: string }) {
  // Left empty, the slides use the organization beehiiv gives for the publication, so the field starts filled in with it.
  // Saving that same name stores nothing: the slides then keep following beehiiv if the name changes there.
  const [name, setName] = useState(initialName || orgFallback || "");
  const stored = (v: string) => (orgFallback && v.replace(/\s+/g, " ").trim() === orgFallback ? "" : v);
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const savedName = useRef(initialName);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function save(body: { orgName?: string; orgLogo?: string | null }) {
    const mine = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/slide-style", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (mine !== seq.current) return;
      if (res.status === 401) setError("Your Buffer login has expired. Log in again, then try once more.");
      else if (!res.ok) setError(data.error ?? "That didn't save. Try again in a moment.");
      else {
        if (body.orgName !== undefined) savedName.current = body.orgName.replace(/\s+/g, " ").trim();
        window.dispatchEvent(new Event(SAVED_EVENT));
      }
    } catch {
      if (mine === seq.current) setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    const r = await logoFromFile(file);
    if ("error" in r) return setError(r.error);
    setLogo(r.uri);
    await save({ orgLogo: r.uri });
  }

  const set = !!name.trim() || !!logo;

  return (
    <section aria-labelledby="organization" className="rounded-2xl bg-card p-6">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="organization" className="m-0 text-2xl">
          Organization
        </h2>
        <span role="status" className="text-sm font-semibold">
          {busy ? "Saving…" : ""}
        </span>
      </div>
      <p className="mb-6 mt-0 text-sm">
        The organization behind your newsletter. It shows on your slides wherever you choose &ldquo;Organization name + logo&rdquo;. Changes save as you make them.
      </p>

      <div className="grid max-w-xl gap-6">
        <div>
          <label htmlFor="org-name" className="mb-2 block font-bold">
            Name
          </label>
          <input
            id="org-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              window.clearTimeout(timer.current);
              const next = stored(e.target.value);
              timer.current = window.setTimeout(() => void (next.trim() !== savedName.current && save({ orgName: next })), 600);
            }}
            onBlur={() => {
              // Leaving the field saves straight away rather than waiting out the pause.
              window.clearTimeout(timer.current);
              // An emptied field goes back to the beehiiv name.
              if (!name.trim() && orgFallback) setName(orgFallback);
              const next = stored(name);
              if (next.trim() !== savedName.current) void save({ orgName: next });
            }}
            maxLength={MAX_ORG_NAME}
            placeholder={orgFallback ?? "For example, Amsterdam Parent Project"}
            className={field}
          />
          {orgFallback && (
            <p className="mb-0 mt-1.5 text-xs">
              {name.trim() === orgFallback
                ? "Filled in from beehiiv. Change it to use a different name on your slides."
                : <>Your own name. Clear the field to go back to &ldquo;{orgFallback}&rdquo; from beehiiv.</>}
            </p>
          )}
        </div>

        <div>
          <span className="mb-2 block font-bold">Logo</span>
          <div className="flex flex-wrap items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Your organization logo" className="h-16 max-w-48 rounded-lg bg-surface object-contain p-1.5 ring-1 ring-ink/15" />
            ) : (
              <span className="grid h-16 w-28 place-items-center rounded-lg border-2 border-dashed border-ink/25 text-xs font-semibold text-ink/60">No logo</span>
            )}
            <input ref={fileInput} type="file" accept="image/png,image/jpeg" className="sr-only" tabIndex={-1} onChange={(e) => void pickLogo(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-surface px-4 py-2.5 font-bold ring-1 ring-ink/15 hover:ring-ink/40">
              <Upload aria-hidden className="size-4" /> {logo ? "Replace logo" : "Upload a logo"}
            </button>
            {logo && (
              <button
                type="button"
                onClick={() => {
                  setLogo(null);
                  void save({ orgLogo: null });
                }}
                className="text-sm font-bold underline underline-offset-4"
              >
                Remove logo
              </button>
            )}
          </div>
          <p className="mb-0 mt-1.5 text-xs">PNG or JPEG. It is shrunk before it is saved.</p>
        </div>

        {error && (
          <p role="alert" className="m-0 border-l-4 border-coral pl-3 text-sm font-semibold">
            {error}
          </p>
        )}

        {set && (
          <p className="m-0 text-sm">
            Choose where it appears in{" "}
            <Link href="/settings?section=style" className="font-bold underline underline-offset-4">
              Slide style
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
