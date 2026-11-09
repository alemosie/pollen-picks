"use client";

import { Bookmark, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PollenSpinner } from "@/components/PollenSpinner";
import { useReplaceRun } from "@/components/useReplaceRun";
import { applyOpened, openedUrl } from "@/lib/runSync";
import { SAVED_STEP_NAMES, type OpenedCreation, type SavedCreationSummary } from "@/lib/savedCreationShape";

const when = (iso: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Saved creations: issues the person saved from Write or Send, each reopened where it was saved. They stay until deleted, and hold only the picks,
 * the design and the caption text, never images. Opening one puts it back as the run in this browser (replacing the run that was there).
 */
export function SavedCreations({ items: initial }: { items: SavedCreationSummary[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Picks the issue no longer has: the person decides whether to open what is left.
  const [notice, setNotice] = useState<{ id: string; text: string; open: () => void } | null>(null);

  const { guard, dialog } = useReplaceRun();

  // Opening replaces the run in this browser (and the one on the server, which the guard has already dealt with), so the steps find the same picks and caption.
  function go(c: OpenedCreation) {
    applyOpened(c, "saved");
    router.push(openedUrl(c));
  }

  async function open(id: string) {
    setBusy(id);
    setError("");
    setNotice(null);
    try {
      const res = await fetch(`/api/saved/${id}`, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { creation?: OpenedCreation; error?: string };
      if (res.status === 401) setError("Your Buffer login has expired. Log in again to open this.");
      else if (!res.ok || !j.creation) setError(j.error ?? "Couldn't open it right now. Try again in a moment.");
      else {
        const c = j.creation;
        if (c.dropped > 0) {
          setNotice({
            id,
            text: `${plural(c.dropped, "pick")} from this creation ${c.dropped === 1 ? "is" : "are"} no longer in the issue. You can open the other ${c.picks.length}, and write the caption again.`,
            open: () => void guard(() => go(c), { intoSource: c.source }),
          });
        } else void guard(() => go(c), { intoSource: c.source });
      }
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/saved/${id}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 401) setError("Your Buffer login has expired. Log in again to delete this.");
      else if (!res.ok) setError(j.error ?? "Couldn't delete it right now. Try again in a moment.");
      else {
        setItems((all) => all.filter((x) => x.id !== id));
        setConfirmDelete(null);
        setNotice(null);
        router.refresh();
      }
    } catch {
      setError("Couldn't reach Pollen Picks. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="saved-creations" aria-labelledby="saved-creations-title" className="mb-10 scroll-mt-6">
      <h2 id="saved-creations-title" className="mb-1 flex items-center gap-3 text-2xl">
        <Bookmark aria-hidden className="size-6" strokeWidth={2.25} />
        Saved creations
      </h2>
      <p className="mb-4 max-w-2xl text-sm">
        Press <b>Save</b> on the Design, Write or Send step to keep a creation here, and pick it up again from any device. It holds your picks, your design and your caption text, never the images, and it stays until you delete it. Once an issue is saved, further changes to it are saved into it automatically.
      </p>
      {error && (
        <p role="alert" className="mb-3 border-l-4 border-coral pl-3 text-sm font-semibold">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="m-0 rounded-xl bg-surface p-4 text-sm font-semibold">Nothing saved yet.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border-[3px] border-honey p-4 sm:p-5">
          {items.map((c) => (
            <li key={c.id} className="rounded-xl bg-surface p-4 ring-1 ring-ink/10">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1 basis-64">
                  <span className="block truncate font-semibold" title={c.title}>
                    {c.title || c.newsletter || "Untitled issue"}
                  </span>
                  <span className="block text-xs text-ink/80">
                    {c.newsletter && c.title ? `${c.newsletter} · ` : ""}
                    {plural(c.picks, "pick")} · opens at {SAVED_STEP_NAMES[c.step]}
                    {c.hasCaption ? " · caption edits kept" : ""}
                  </span>
                  <time dateTime={c.updatedAt} suppressHydrationWarning className="block text-xs text-ink/80">
                    Saved {when(c.updatedAt)}
                  </time>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => open(c.id)}
                    disabled={busy !== null}
                    aria-label={`Open ${c.title || c.newsletter || "this creation"}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-honey px-3 py-1.5 text-sm font-bold text-ink-deep hover:brightness-95 disabled:opacity-60"
                  >
                    {busy === c.id && <PollenSpinner className="size-4" />}
                    Open
                  </button>
                  {confirmDelete !== c.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(c.id)}
                      disabled={busy !== null}
                      aria-label={`Delete ${c.title || c.newsletter || "this creation"}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-sm font-bold ring-1 ring-ink/20 hover:ring-ink/40 disabled:opacity-60"
                    >
                      <Trash2 aria-hidden className="size-4" strokeWidth={2.25} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {confirmDelete === c.id && (
                <div role="group" aria-label="Confirm delete" className="mt-3 grid gap-2 rounded-lg bg-honey/30 p-2 text-xs">
                  <p role="alert" className="m-0 font-semibold">
                    Delete this saved creation? Its picks, design and caption text are removed. Posts already in Buffer aren&rsquo;t touched.
                  </p>
                  <span className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => remove(c.id)} disabled={busy !== null} className="rounded-lg bg-coral px-3 py-1.5 font-bold text-ink-deep hover:brightness-95 disabled:opacity-60">
                      Yes, delete
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg bg-surface px-3 py-1.5 font-bold ring-1 ring-ink/20 hover:ring-ink/40">
                      Cancel
                    </button>
                  </span>
                </div>
              )}
              {notice?.id === c.id && (
                <div role="group" aria-label="Some picks are gone" className="mt-3 grid gap-2 rounded-lg bg-honey/30 p-2 text-xs">
                  <p role="alert" className="m-0 font-semibold">
                    {notice.text}
                  </p>
                  <span className="flex flex-wrap gap-2">
                    <button type="button" onClick={notice.open} className="rounded-lg bg-honey px-3 py-1.5 font-bold text-ink-deep hover:brightness-95">
                      Open anyway
                    </button>
                    <button type="button" onClick={() => setNotice(null)} className="rounded-lg bg-surface px-3 py-1.5 font-bold ring-1 ring-ink/20 hover:ring-ink/40">
                      Cancel
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </section>
  );
}
