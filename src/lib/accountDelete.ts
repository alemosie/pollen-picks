import { db } from "./db";
import { removeAllSlidesOf } from "./slideStore";

/** Tables that hold one row per thing a user did, keyed by `user_id`. Removed before the user row itself, which they point at. */
const OWNED = ["current_runs", "custom_picks", "draft_log", "instagram_lookups", "post_history", "public_sources", "saved_creations", "slide_styles", "brand_profiles", "user_photo_links"] as const;

/**
 * Deletes everything Pollen Picks holds for one account: the saved tokens and keys (also from Vault), settings, history and the queue of
 * sends, the stored slide images, highlights and saved sources, and finally the account row. Answers to the feedback form stay but are no longer linked to the
 * account. The shared cache of Instagram handles isn't personal, so it stays.
 *
 * Safe to run again: each step only removes what is left, so if one fails the person can simply press the button once more.
 */
export async function deleteAccount(userId: string): Promise<void> {
  for (const provider of ["buffer", "beehiiv", "apify"]) {
    const { error } = await db().rpc("delete_connection", { p_user_id: userId, p_provider: provider });
    if (error) throw new Error(`Could not remove the ${provider} connection: ${error.message}`);
  }
  // The stored slide images of every send (see slideStore) go first: they are personal content in a public bucket. Files, then the feedback that points at them.
  await removeAllSlidesOf(userId);
  const images = await db().from("feedback").update({ slide_images: null }).eq("user_id", userId);
  if (images.error && !/slide_images/.test(images.error.message)) throw new Error(`Could not clear shared slides from feedback: ${images.error.message}`);
  for (const table of OWNED) {
    const { error } = await db().from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
  }
  const unlinked = await db().from("feedback").update({ user_id: null }).eq("user_id", userId);
  if (unlinked.error) throw new Error(`Could not unlink feedback: ${unlinked.error.message}`);
  const { error } = await db().from("users").delete().eq("id", userId);
  if (error) throw new Error(`Could not delete the account: ${error.message}`);
}
