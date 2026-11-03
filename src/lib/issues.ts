// Server-only: the signed-in user's beehiiv issues, newest first. Shared by the source page (first render) and
// /api/beehiiv/issues (after connecting or switching publication).
import { BeehiivKeyError, listIssues, type BeehiivIssuePage } from "./beehiiv";
import { getBeehiivConnection, loadBeehiivKey } from "./connections";

export type IssueList = { publicationId: string } & BeehiivIssuePage;
export type IssueListResult = { list: IssueList } | { error: string; status: number };

/** `publicationId` defaults to the first publication the saved key can see, and must be one of them. */
export async function loadIssueList(userId: string, publicationId?: string | null, page = 1): Promise<IssueListResult> {
  try {
    const conn = await getBeehiivConnection(userId);
    if (!conn || conn.publications.length === 0) return { error: "Connect your beehiiv key first.", status: 404 };
    const pub = publicationId ?? conn.publications[0].id;
    if (!conn.publications.some((p) => p.id === pub)) return { error: "That publication isn't covered by your key.", status: 400 };
    const key = await loadBeehiivKey(userId);
    if (!key) return { error: "Connect your beehiiv key first.", status: 404 };
    return { list: { publicationId: pub, ...(await listIssues(key, pub, { page })) } };
  } catch (e) {
    if (e instanceof BeehiivKeyError) {
      return { error: e.message, status: e.kind === "invalid" ? 401 : e.kind === "rate-limited" ? 429 : e.kind === "not-found" ? 404 : 502 };
    }
    console.error("beehiiv issue list failed:", (e as Error).message);
    return { error: "Couldn't load your issues. Try again in a moment.", status: 503 };
  }
}
