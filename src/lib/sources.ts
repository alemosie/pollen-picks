import type { IssueData } from "./demo";

/**
 * The issue a signed-in user creates and sends posts from, for the content source `mode` ("public" or "own").
 * Returns null while that source isn't built yet.
 *
 * The sample issue (loadDemoIssue in ./demo) is deliberately NOT returned here. It powers the public /demo flow only and
 * must never reach Buffer: the signed-in pages and /api/draft all load their content through this function, so a sample
 * pick can't become a draft.
 *
 * TODO(BYO Beehiiv / public newsletters): fetch and parse the chosen newsletter's issue and return it.
 */
export async function loadAppIssue(mode: string | undefined): Promise<IssueData | null> {
  void mode;
  return null;
}
