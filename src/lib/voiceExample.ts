import { parseChunks } from "./pollen/chunks";
import { withDates } from "./pollen/rankChunks";

/** An illustrative paragraph, the way a newsletter writer might type it. Not a real listing. */
const PARAGRAPH_HTML =
  `<h2>This week</h2><p><a href="https://example.com/music-hall">Gatti’s Music Hall</a> \u2014 the museum\u2019s deep ice wells ` +
  `are transformed into a Victorian era music hall for one night only on Sat 21st Nov. Book now, it always sells out.</p>`;

export type VoiceExample = {
  /** Pieces of the raw paragraph; `found` ones are what the rules picked out. */
  parts: { text: string; found?: "title" | "date" | "blurb" }[];
  title: string;
  when: string | null;
  blurb: string;
};

/** Runs the real parser on the example, so the splash page shows what the app actually does. */
export function voiceExample(reference: string): VoiceExample {
  const [c] = withDates(parseChunks(PARAGRAPH_HTML), reference);
  const text = c.text;
  const parts: VoiceExample["parts"] = [];
  const t = text.indexOf(c.title);
  if (t > 0) parts.push({ text: text.slice(0, t) });
  parts.push({ text: c.title, found: "title" });
  const rest = text.slice(t + c.title.length);
  const b = c.blurb ? rest.indexOf(c.blurb) : -1;
  if (b > 0) parts.push({ text: rest.slice(0, b) });
  const blurb = b >= 0 ? c.blurb : rest;
  // The date the rules read out of the running text, marked inside the description.
  const d = blurb.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? \d{1,2}(?:st|nd|rd|th)? [A-Z][a-z]+/);
  if (d && d.index != null) {
    parts.push({ text: blurb.slice(0, d.index), found: "blurb" });
    parts.push({ text: d[0], found: "date" });
    parts.push({ text: blurb.slice(d.index + d[0].length), found: "blurb" });
  } else {
    parts.push({ text: blurb, found: "blurb" });
  }
  return { parts, title: c.title, when: c.when, blurb: c.blurb };
}
