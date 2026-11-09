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
