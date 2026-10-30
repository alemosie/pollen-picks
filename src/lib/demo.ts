import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseActivities } from "./pollen/parse";
import { parseChunks, type Chunk } from "./pollen/chunks";
import { mergeClicks, rankActivities } from "./pollen/rank";
import type { ClickRow } from "./pollen/types";

/** Demo mode freezes "today" so the ranking is reproducible (Wed 21 Oct 2026). */
export const DEMO_TODAY = "2026-10-21";

export type PickChunk = Chunk & { rank: number | null; score: number | null };
export type IssueData = { title: string; publishedAt: string; url: string; chunks: PickChunk[]; hasClicks: boolean };

export function loadDemoIssue(): IssueData {
  const dir = join(process.cwd(), "fixtures");
  const html = readFileSync(join(dir, "issue-49.html"), "utf8");
  const { post, clicks } = JSON.parse(readFileSync(join(dir, "issue-49.clicks.json"), "utf8")) as {
    post: { title: string; publishedAt: string; url: string };
    clicks: ClickRow[];
  };
  const reference = post.publishedAt.slice(0, 10);
  const ranked = rankActivities(parseActivities(html, { reference }), mergeClicks(clicks), { today: DEMO_TODAY, onlyUpcoming: true });
  const byKey = new Map(ranked.filter((r) => r.rank && r.key).map((r) => [r.key!, r]));
  const chunks = parseChunks(html).map((c) => {
    const r = c.key ? byKey.get(c.key) : undefined;
    return { ...c, rank: r?.rank ?? null, score: r?.stats?.score ?? null };
  });
  return { title: post.title, publishedAt: post.publishedAt, url: post.url, chunks, hasClicks: true };
}
