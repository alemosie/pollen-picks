/** File names for "Download your demo": the slides as slide-1.png, slide-2.png ..., and one caption file per kind of network. */

export const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "caption";

/** "slide-1.png". With ten or more slides the numbers are padded (slide-01.png) so every file manager sorts them in order. */
export function slideFileName(index: number, total: number, ext: string): string {
  const width = String(total).length;
  return `slide-${String(index + 1).padStart(width, "0")}.${ext}`;
}

/** The file extension for what the slide route sent back. It answers PNG for a full-size slide. */
export function extFor(contentType: string | null): string {
  const t = (contentType ?? "").toLowerCase();
  return t.includes("webp") ? "webp" : t.includes("jpeg") || t.includes("jpg") ? "jpg" : "png";
}

/** One name per caption, from the networks it is for ("Instagram" -> caption-instagram.txt). Two captions never share a name. */
export function captionFileNames(labels: string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const base = `caption-${slug(label)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${n === 1 ? base : `${base}-${n}`}.txt`;
  });
}
