import { MAX_LOGO_CHARS } from "@/lib/slides/style";

/** Shrinks a PNG or JPEG to at most `max` pixels on its longest side and returns it as a PNG data URI (transparency is kept). */
async function shrink(file: File, max: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * k));
  canvas.height = Math.max(1, Math.round(bmp.height * k));
  canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/png");
}

/** A logo file as a small PNG data URI the server accepts, or an error to show. */
export async function logoFromFile(file: File): Promise<{ uri: string } | { error: string }> {
  if (!["image/png", "image/jpeg"].includes(file.type)) return { error: "Use a PNG or JPEG logo." };
  try {
    let uri = await shrink(file, 256);
    if (uri.length > MAX_LOGO_CHARS) uri = await shrink(file, 128);
    return uri.length > MAX_LOGO_CHARS ? { error: "That logo is too detailed. Try a simpler or smaller image." } : { uri };
  } catch {
    return { error: "Couldn't read that image. Try another PNG or JPEG." };
  }
}
