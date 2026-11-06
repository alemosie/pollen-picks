import { useEffect, useState } from "react";
import type { IssueImage } from "@/lib/pollen/imageIds";

/** The signed-in user's saved picture links and what the picture picker needs to add and remove them. */
export type LinksApi = {
  /** Shaped like the other pictures; `src` is the address the user saved. */
  images: IssueImage[];
  loading: boolean;
  /** A link is being checked and saved. */
  busy: boolean;
  error: string | null;
  /** Saves the link (the server checks that it is a picture); resolves with its id, or null (the reason is in `error`). */
  add: (url: string) => Promise<string | null>;
  remove: (id: string) => Promise<void>;
};

const asImage = (p: { id: string; url: string }, n: number): IssueImage => ({ id: p.id, src: p.url, alt: `Your picture ${n}` });

/** Loads the list once when `enabled` (a signed-in user on one of their own issues). */
export function useSavedPhotos(enabled: boolean): LinksApi {
  const [list, setList] = useState<{ id: string; url: string }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetch("/api/photos")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("list"))))
      .then((d: { photos?: { id: string; url: string }[] }) => live && setList(d.photos ?? []))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [enabled]);

  const add = async (url: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const body = (await res.json().catch(() => ({}))) as { photo?: { id: string; url: string }; error?: string };
      if (!res.ok || !body.photo) return void setError(body.error ?? "Couldn't save that link. Try again."), null;
      const saved = body.photo;
      setList((prev) => [saved, ...(prev ?? []).filter((p) => p.id !== saved.id)]);
      return saved.id;
    } catch {
      setError("Couldn't save that link. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete");
      setList((prev) => (prev ?? []).filter((p) => p.id !== id));
    } catch {
      setError("Couldn't remove that link. Try again.");
    }
  };

  return { images: (list ?? []).map((p, n) => asImage(p, list!.length - n)), loading: enabled && list === null && !failed, busy, error, add, remove };
}
