import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseChunks, type Chunk } from "./pollen/chunks";
import { mergeClicks } from "./pollen/rank";
import { rankChunks, withDates } from "./pollen/rankChunks";
import type { ClickRow } from "./pollen/types";

/** Demo mode freezes "today" so the ranking is reproducible (Wed 21 Oct 2026). */
export const DEMO_TODAY = "2026-10-21";

export type PickChunk = Chunk & { rank: number | null; score: number | null };
export type IssueData = { /** What beehiiv says about the publication: its logo and the organization behind it. Only for the user's own issues. */ publication?: { logo?: string; organization?: string }; title: string; /** The newsletter's name, shown on slides and in captions. */ newsletter: string; publishedAt: string; url: string; /** Who wrote it, when the page says (public pages only). */ author?: string | null; /** The issue's preview image (beehiiv's thumbnail_url). */ thumbnail?: string; chunks: PickChunk[]; hasClicks: boolean };

export function loadDemoIssue(): IssueData {
  const dir = join(process.cwd(), "fixtures");
  const html = readFileSync(join(dir, "issue-49.html"), "utf8");
  const { post, clicks } = JSON.parse(readFileSync(join(dir, "issue-49.clicks.json"), "utf8")) as {
    post: { title: string; publishedAt: string; url: string; thumbnail?: string; author?: string };
    clicks: ClickRow[];
  };
  const reference = post.publishedAt.slice(0, 10);
  const parsed = parseChunks(html);
  const ranks = rankChunks(parsed, mergeClicks(clicks), { today: DEMO_TODAY, reference });
  const chunks = withDates(parsed, reference).map((c) => ({ ...c, rank: ranks.get(c.id)?.rank ?? null, score: ranks.get(c.id)?.score ?? null }));
  return { title: post.title, newsletter: "Just a Phase", publishedAt: post.publishedAt, url: post.url, thumbnail: post.thumbnail, author: post.author, chunks, hasClicks: true };
}
