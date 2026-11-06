// Server-only: the picture addresses a user saved to use on slides (Design > edit slide > Picture > Add link). Only the address is kept,
// in the user_photo_links table (see db/supabase/0021). A slide refers to it by its 8-hex id, never by the address, and Buffer downloads
// every slide from this app (no browser involved) for days after a post is made, which is why the address has to be kept here.
// A link is private to its owner and is only ever read for them (or for a signed send of their slides).

import { randomBytes } from "node:crypto";
import { db } from "./db";
import { cleanPublicUrl } from "./publicFetch";
import { fetchPhoto } from "./slides/kit";
import { MAX_PHOTO_LINKS } from "./slides/types";

export { MAX_PHOTO_LINKS };

export type PhotoLink = { id: string; url: string };

const MAX_URL_CHARS = 1000;

/** What a person pasted as a clean https address, or why it can't be used. Doesn't fetch anything. */
export function checkPhotoLink(raw: unknown): { url: string } | { error: string } {
  if (typeof raw !== "string" || !raw.trim()) return { error: "Paste the link to a picture." };
  if (raw.length > MAX_URL_CHARS * 2) return { error: "That link is too long." };
  let url: string;
  try {
    url = cleanPublicUrl(raw).href;
  } catch {
    return { error: "Use a normal https link to a picture, like https://example.com/photo.jpg." };
  }
  if (url.length > MAX_URL_CHARS) return { error: "That link is too long." };
  return { url };
}

export async function listPhotoLinks(uid: string): Promise<PhotoLink[]> {
  const { data, error } = await db().from("user_photo_links").select("id, url").eq("user_id", uid).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id as string, url: r.url as string }));
}

/**
 * Saves a link and returns it with its id, or why it was refused (`status` is the HTTP status to answer with). The picture is fetched once
 * first, the way a slide will fetch it, so a link that can't be drawn (a web page, a site that refuses downloads) is refused now and not
 * silently missing from the slide later. Saving the same address again returns the same id.
 */
export async function savePhotoLink(uid: string, input: unknown): Promise<{ link: PhotoLink } | { error: string; status: number }> {
  const ok = checkPhotoLink(input);
  if ("error" in ok) return { error: ok.error, status: 400 };
  const { data: existing, error: findError } = await db().from("user_photo_links").select("id").eq("user_id", uid).eq("url", ok.url).maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing) return { link: { id: existing.id as string, url: ok.url } };
  const { count, error: countError } = await db().from("user_photo_links").select("id", { count: "exact", head: true }).eq("user_id", uid);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= MAX_PHOTO_LINKS) return { error: `You can keep ${MAX_PHOTO_LINKS} links. Remove one in Settings > Photos to add another.`, status: 409 };
  if (!(await fetchPhoto(ok.url))) return { error: "Couldn't use that link. It has to be a public picture (JPEG, PNG, GIF or WebP), not a web page.", status: 422 };
  for (let attempt = 0; attempt < 4; attempt++) {
    const id = randomBytes(4).toString("hex");
    const { error } = await db().from("user_photo_links").insert({ user_id: uid, id, url: ok.url });
    if (!error) return { link: { id, url: ok.url } };
    if (error.code === "23505") {
      // Either that id is taken (try another) or the same address was saved a moment ago (use that one).
      const { data: again } = await db().from("user_photo_links").select("id").eq("user_id", uid).eq("url", ok.url).maybeSingle();
      if (again) return { link: { id: again.id as string, url: ok.url } };
      continue;
    }
    throw new Error(error.message);
  }
  throw new Error("could not find a free link id");
}

/** The address behind one of this user's ids, or null (not theirs, or removed). */
export async function photoLinkUrl(uid: string, id: string): Promise<string | null> {
  if (!/^[0-9a-f]{8}$/.test(id)) return null;
  const { data, error } = await db().from("user_photo_links").select("url").eq("user_id", uid).eq("id", id).maybeSingle();
  return error || !data ? null : (data.url as string);
}

/** Removes every link this user saved (Settings > Photos > Remove all). */
export async function deleteAllPhotoLinks(uid: string): Promise<void> {
  const { error } = await db().from("user_photo_links").delete().eq("user_id", uid);
  if (error) throw new Error(error.message);
}

export async function deletePhotoLink(uid: string, id: string): Promise<void> {
  if (!/^[0-9a-f]{8}$/.test(id)) return;
  const { error } = await db().from("user_photo_links").delete().eq("user_id", uid).eq("id", id);
  if (error) throw new Error(error.message);
}
