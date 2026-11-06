import { db } from "./db";

/** Tables that hold one row per thing a user did, keyed by `user_id`. Removed before the user row itself, which they point at. */
const OWNED = ["custom_picks", "draft_log", "instagram_lookups", "post_history", "public_sources", "slide_styles", "brand_profiles"] as const;

/**
 * Deletes everything Pollen Picks holds for one account: the saved tokens and keys (also from Vault), settings, history and the queue of
 * sends, highlights and saved sources, and finally the account row. Answers to the feedback form stay but are no longer linked to the
 * account. The shared cache of Instagram handles isn't personal, so it stays.
 *
 * Safe to run again: each step only removes what is left, so if one fails the person can simply press the button once more.
 */
export async function deleteAccount(userId: string): Promise<void> {
  for (const provider of ["buffer", "beehiiv", "apify"]) {
    const { error } = await db().rpc("delete_connection", { p_user_id: userId, p_provider: provider });
    if (error) throw new Error(`Could not remove the ${provider} connection: ${error.message}`);
  }
  for (const table of OWNED) {
    const { error } = await db().from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
  }
  const unlinked = await db().from("feedback").update({ user_id: null }).eq("user_id", userId);
  if (unlinked.error) throw new Error(`Could not unlink feedback: ${unlinked.error.message}`);
  const { error } = await db().from("users").delete().eq("id", userId);
  if (error) throw new Error(`Could not delete the account: ${error.message}`);
}
