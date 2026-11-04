import { cookies } from "next/headers";
import { DEMO_TODAY, loadDemoIssue } from "./demo";
import { DEMO_SRC_COOKIE, decodeDemoSource } from "./pollen/demoSource";
import {
  DEMO_HL_COOKIE,
  decodeDemoRows,
  demoHighlightChunks,
} from "./pollen/demoHighlights";

/** The demo issue plus whatever this visitor highlighted on the Manual tab (kept in their cookie). */
export async function loadDemoIssueWithHighlights() {
  const jar = await cookies();
  const highlights = demoHighlightChunks(decodeDemoRows(jar.get(DEMO_HL_COOKIE)?.value));
  // A pasted public page replaces the sample issue: no parsed chunks or clicks, only what the visitor highlighted.
  const src = decodeDemoSource(jar.get(DEMO_SRC_COOKIE)?.value);
  if (src) {
    return {
      title: src.title,
      newsletter: src.newsletter,
      author: src.author,
      // Only a reference date for dates inside picks. Highlights carry none, and new Date() would block prerendering.
      publishedAt: `${DEMO_TODAY}T00:00:00.000Z`,
      url: src.url,
      chunks: highlights.map((c) => ({ ...c, rank: null, score: null })),
      hasClicks: false,
      custom: true,
    };
  }
  const issue = loadDemoIssue();
  return { ...issue, chunks: [...issue.chunks, ...highlights], custom: false };
}
