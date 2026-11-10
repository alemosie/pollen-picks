// Settings > Brand is one section now: it used to be three (Organization, Slide style, Slide colors). The old addresses (?section=organization and so on)
// are in links people saved or were sent, so they still open the Brand section.

export const SECTION_ALIASES: Record<string, string> = { organization: "brand", style: "brand", colors: "brand" };

/** The section a `?section=` value names: the value itself when it is one of `ids`, an old name's new home, else the first section. */
export function resolveSection(value: string | string[] | undefined, ids: readonly string[]): string {
  const v = Array.isArray(value) ? value[0] : value;
  const id = v && v in SECTION_ALIASES ? SECTION_ALIASES[v] : v;
  return ids.find((s) => s === id) ?? ids[0];
}
