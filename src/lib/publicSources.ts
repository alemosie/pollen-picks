// Server-only: the public posts users chose as a source, stored in public.public_sources (db/supabase/0006_public_sources.sql).
import { db } from "./db";
import type { PublicPost } from "./publicPost";

export type PublicSource = {
  id: string;
  url: string;
  title: string;
  site: string | null;
  author: string | null;
  publishedAt: string | null;
  image: string | null;
};

type Row = { id: string; url: string; title: string; site: string | null; author: string | null; published_at: string | null; image: string | null };
const COLUMNS = "id, url, title, site, author, published_at, image";
const toSource = (r: Row): PublicSource => ({ id: r.id, url: r.url, title: r.title, site: r.site, author: r.author, publishedAt: r.published_at, image: r.image });

/** Saves (or refreshes) the user's source for this post. The same link gives the same id, so highlights carry over. */
export async function savePublicSource(userId: string, post: PublicPost): Promise<PublicSource> {
  const { data, error } = await db()
    .from("public_sources")
    .upsert(
      { user_id: userId, url: post.url.slice(0, 2000), title: post.title.slice(0, 200), site: post.site, author: post.author, published_at: post.publishedAt, image: post.image },
      { onConflict: "user_id,url" },
    )
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(`Could not save the source: ${error?.message ?? "no row returned"}`);
  return toSource(data as Row);
}

/** Any signed-in visitor can open a source by its id (it only holds what the public page says), so shared step links keep working. */
export async function loadPublicSource(id: string): Promise<PublicSource | null> {
  const { data, error } = await db().from("public_sources").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not read the source: ${error.message}`);
  return data ? toSource(data as Row) : null;
}
