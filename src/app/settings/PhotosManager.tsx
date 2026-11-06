"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

type Link = { id: string; url: string };

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Settings > Photos: the picture links saved for slides, to remove one by one or all at once. */
export function PhotosManager({ initial, max }: { initial: Link[]; max: number }) {
  const [links, setLinks] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, what: string, apply: () => void) {
    setError(null);
    setBusy(what);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      apply();
    } catch {
      setError("Couldn't remove that. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const removeOne = (id: string) => call(`/api/photos/${id}`, id, () => setLinks((p) => p.filter((x) => x.id !== id)));
  const removeAll = () =>
    call("/api/photos", "all", () => {
      setLinks([]);
      setConfirmAll(false);
    });

  return (
    <section aria-labelledby="photos" className="rounded-2xl bg-card p-4 sm:p-6">
      <h2 id="photos" className="mb-1 text-2xl">
        Photos
      </h2>
      <p className="mb-4 mt-0 max-w-2xl text-sm">
        These are the links to public pictures you added for your slides. Only the link is saved, never a copy of the picture, and only you can use it. You can keep {max}.
        Removing a link doesn&rsquo;t delete the picture anywhere: it just can&rsquo;t be used on slides any more, and a slide that used it is drawn without it. If a
        scheduled post still needs one, keep it until the post has gone out.
      </p>
      <p role="status" className="mb-4 mt-0 text-sm font-bold">
        {links.length} of {max} used
      </p>
      {error && (
        <p role="alert" className="mb-4 mt-0 border-l-4 border-coral pl-3 text-sm font-semibold">
          {error}
        </p>
      )}
      {links.length === 0 ? (
        <p className="m-0 rounded-xl bg-surface p-4 text-sm">
          No links yet. When you design a carousel, choose <strong>Add link</strong> in an edit window&rsquo;s Picture row to add one.
        </p>
      ) : (
        <>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
            {links.map((p, n) => (
              <li key={p.id} className="grid gap-2 rounded-xl bg-surface p-2 ring-1 ring-ink/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Saved picture ${links.length - n}`} width={240} height={240} loading="lazy" referrerPolicy="no-referrer" className="aspect-square w-full rounded-lg object-cover" />
                <div className="flex items-center justify-between gap-2">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.url} className="min-w-0 truncate text-xs underline underline-offset-2">
                    {hostOf(p.url)}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeOne(p.id)}
                    disabled={busy !== null}
                    aria-label={`Remove saved picture ${links.length - n} from ${hostOf(p.url)}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ring-1 ring-ink/20 hover:ring-ink/50 disabled:opacity-50"
                  >
                    <Trash2 aria-hidden className="size-3.5" strokeWidth={2.25} />
                    {busy === p.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            {confirmAll ? (
              <div role="group" aria-label="Confirm removing all links" className="grid max-w-xl gap-3 rounded-2xl bg-coral/20 p-4">
                <p className="m-0 font-bold">Remove all {links.length} links?</p>
                <p className="m-0 text-sm">This can&rsquo;t be undone. Slides that use them are drawn without them.</p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={removeAll} disabled={busy !== null} className="rounded-xl bg-ink px-5 py-2.5 font-bold text-cream hover:brightness-110 disabled:opacity-50">
                    {busy === "all" ? "Removing…" : "Yes, remove all"}
                  </button>
                  <button type="button" onClick={() => setConfirmAll(false)} disabled={busy !== null} className="rounded-xl bg-surface px-5 py-2.5 font-bold ring-1 ring-ink/15 hover:ring-ink/40">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmAll(true)} className="inline-flex items-center gap-2 rounded-xl bg-surface px-5 py-2.5 font-bold ring-1 ring-ink/15 hover:ring-ink/40">
                <Trash2 aria-hidden className="size-4" strokeWidth={2.25} />
                Remove all
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
