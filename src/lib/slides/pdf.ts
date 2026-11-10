// Server-only: the slides of a send as one PDF, one slide per page, for LinkedIn's swipeable document carousel (Buffer's `document` asset).
//
// The PDF is written by hand rather than with a library: a page here is one picture, so the file is only a few small objects around the JPEG
// bytes (a JPEG can be put in a PDF as is, with /DCTDecode). That keeps the app free of another dependency and the file small: slides go in as
// JPEGs, not PNGs, which is a few hundred kilobytes a page and not a few megabytes (the storage plan is 1 GB).

import sharp from "sharp";

/** `text`: what the slide says, written into the page as invisible text, so a screen reader (and search, and copy) can read a page that is only a picture. */
export type PdfPage = { jpeg: Buffer; width: number; height: number; text?: string };

/** A page is this many points per slide pixel. Viewers fit the page to the screen, so only the shape matters; a smaller page keeps the numbers small. */
const POINTS_PER_PIXEL = 0.5;
/** JPEG quality for the pages: text and flat colors stay clean, and a slide stays well under a megabyte. */
export const PDF_JPEG_QUALITY = 85;

const latin1 = (s: string) => Buffer.from(s, "latin1");
const num = (n: number) => String(Math.round(n * 100) / 100);

/** A PDF text string: UTF-16 in hex, so any title (accents, emoji) is safe and nothing needs escaping. */
function pdfText(s: string): string {
  const be = Buffer.alloc(2 + s.length * 2);
  be.writeUInt16BE(0xfeff, 0);
  for (let i = 0; i < s.length; i++) be.writeUInt16BE(s.charCodeAt(i), 2 + i * 2);
  return `<${be.toString("hex").toUpperCase()}>`;
}

/** The few characters outside Latin-1 that the PDF's WinAnsi text encoding has a place for. Anything else it can't show becomes "?". */
const WIN_ANSI: Record<string, number> = { "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93, "\u201D": 0x94, "\u2013": 0x96, "\u2014": 0x97, "\u2026": 0x85, "\u2022": 0x95, "\u20AC": 0x80 };

/** A string for the page's text layer: one byte a character in WinAnsi, with backslash and parentheses escaped. */
export function pdfLiteral(s: string): string {
  let out = "";
  for (const ch of s.replace(/\s+/g, " ").trim()) {
    const code = WIN_ANSI[ch] ?? ch.codePointAt(0)!;
    const c = code > 255 || code < 32 ? "?" : String.fromCharCode(code);
    out += c === "\\" || c === "(" || c === ")" ? `\\${c}` : c;
  }
  return `(${out})`;
}

/** The text as lines short enough to sit inside the page at 12 points, breaking at spaces. */
export function wrapText(text: string, max = 70): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (line && line.length + 1 + word.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * One PDF from JPEG pages. Object numbers: 1 catalog, 2 page tree, 3 info, 4 the font of the text layer; then, for page i, 5+3i the page,
 * 6+3i its drawing instructions, 7+3i its picture. Throws on no pages.
 */
export function buildPdf(pages: PdfPage[], title: string): Buffer {
  if (pages.length === 0) throw new Error("A PDF needs at least one page.");
  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Buffer) => {
    chunks.push(b);
    length += b.length;
  };
  const object = (n: number, ...parts: (string | Buffer)[]) => {
    offsets[n] = length;
    push(latin1(`${n} 0 obj\n`));
    for (const p of parts) push(typeof p === "string" ? latin1(p) : p);
    push(latin1("\nendobj\n"));
  };

  push(latin1("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${5 + 3 * i} 0 R`).join(" ")}] >>`);
  object(3, `<< /Title ${pdfText(title)} /Producer ${pdfText("Pollen Picks")} >>`);
  object(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  pages.forEach((p, i) => {
    const w = p.width * POINTS_PER_PIXEL;
    const h = p.height * POINTS_PER_PIXEL;
    const page = 5 + 3 * i;
    object(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(w)} ${num(h)}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> /Font << /F1 4 0 R >> >> /Contents ${page + 1} 0 R >>`);
    // The picture, then (when the slide has words) the same words as invisible text (render mode 3), which readers pick up and the eye never sees.
    const lines = p.text ? wrapText(p.text) : [];
    const words = lines.length ? ` BT 3 Tr /F1 12 Tf 14 TL 24 ${num(h - 36)} Td ${lines.map((l, k) => `${k ? "T* " : ""}${pdfLiteral(l)} Tj`).join(" ")} ET` : "";
    const draw = `q ${num(w)} 0 0 ${num(h)} 0 0 cm /Im0 Do Q${words}`;
    object(page + 1, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    object(
      page + 2,
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      p.jpeg,
      "\nendstream",
    );
  });

  const count = 5 + 3 * pages.length;
  const xref = length;
  push(latin1(`xref\n0 ${count}\n0000000000 65535 f \n`));
  for (let n = 1; n < count; n++) push(latin1(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`));
  push(latin1(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

/** Turns slide images (PNG or JPEG) into JPEG pages: opaque (white behind anything see-through) and sRGB, which is what DeviceRGB means. */
export async function toPdfPage(image: Buffer): Promise<PdfPage> {
  const { data, info } = await sharp(image).flatten({ background: "#ffffff" }).toColourspace("srgb").jpeg({ quality: PDF_JPEG_QUALITY }).toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}

/** The slides, in order, as one PDF. `texts` (one per slide, as for alt text) become each page's invisible text layer. */
export async function slidesToPdf(images: Buffer[], title: string, texts?: string[]): Promise<Buffer> {
  const pages = await Promise.all(images.map(toPdfPage));
  return buildPdf(pages.map((p, i) => (texts?.[i]?.trim() ? { ...p, text: texts[i] } : p)), title);
}
