import { cookies } from "next/headers";
import { loadDemoIssue } from "./demo";
import {
  DEMO_HL_COOKIE,
  decodeDemoRows,
  demoHighlightChunks,
} from "./pollen/demoHighlights";

/** The demo issue plus whatever this visitor highlighted on the Manual tab (kept in their cookie). */
export async function loadDemoIssueWithHighlights() {
  const issue = loadDemoIssue();
  const raw = (await cookies()).get(DEMO_HL_COOKIE)?.value;
  return {
    ...issue,
    chunks: [...issue.chunks, ...demoHighlightChunks(decodeDemoRows(raw))],
  };
}
