// What won't fully fit on a network: the slides (it posts only the first few) and the caption (over its character limit, or too many @tags).
// The Send step shows an alert triangle next to a network with any of these. Pure, so the wording is tested without a page.

import { fitFor, MAX_MENTIONS } from "./caption";
import { imageLimit, serviceKey } from "./channels";

/** Plain sentences, one per problem; empty when everything fits. Every channel of a network shares them. */
export function fitIssues(service: string, o: { slideCount: number; caption: string }): string[] {
  const issues: string[] = [];
  const room = imageLimit(service);
  if (o.slideCount > room) issues.push(`It takes only the first ${room} of your ${o.slideCount} slides.`);
  const f = fitFor(service, o.caption);
  const num = (n: number) => n.toLocaleString("en");
  if (f.over > 0 && f.limit !== undefined) issues.push(`The caption is ${num(f.over)} characters over its limit of ${num(f.limit)}.`);
  if (f.mentionsOver > 0) issues.push(`The caption has ${f.mentionsOver} @${f.mentionsOver === 1 ? "tag" : "tags"} too many (the limit is ${MAX_MENTIONS[serviceKey(service)]}).`);
  // Send now never publishes a caption that is over: that channel is saved as a draft to shorten in Buffer (see effectiveIntent).
  if (!f.fits) issues.push("Send now saves it as a draft to shorten in Buffer.");
  return issues;
}

/**
 * How a network's line under "Fits on" on Write reads. A caption that was only made to fit by leaving picks out is not "fits": the picks are missing.
 *   fits   a check
 *   over   too long (`label`: "over by N")
 *   tags   too many @tags (`label`: "N too many tags")
 *   cut    fits only because picks were left out (`label`: "N picks left out")
 */
export function captionFitState(service: string, caption: string, leftOut: number): { state: "fits" | "over" | "tags" | "cut"; label: string | null } {
  const f = fitFor(service, caption);
  if (f.over > 0) return { state: "over", label: `over by ${f.over.toLocaleString("en")}` };
  if (f.mentionsOver > 0) return { state: "tags", label: `${f.mentionsOver} too many tags` };
  if (leftOut > 0) return { state: "cut", label: `${leftOut} ${leftOut === 1 ? "pick" : "picks"} left out` };
  return { state: "fits", label: null };
}
