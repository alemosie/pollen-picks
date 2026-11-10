// How a user wants their slides sent to LinkedIn (Settings > LinkedIn format). LinkedIn's own carousel is a PDF, so that is the default; the other
// choice is the slides as separate images (which LinkedIn shows as a grid, with the edges cropped, and which can carry alt text per image).

export const LINKEDIN_FORMATS = ["pdf", "images"] as const;
export type LinkedinFormat = (typeof LINKEDIN_FORMATS)[number];
export const DEFAULT_LINKEDIN_FORMAT: LinkedinFormat = "pdf";

/** Anything that isn't one of the two formats reads as the default. */
export const cleanLinkedinFormat = (v: unknown): LinkedinFormat => (v === "images" ? "images" : DEFAULT_LINKEDIN_FORMAT);
