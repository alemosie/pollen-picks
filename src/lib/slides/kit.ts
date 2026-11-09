// Server-only: the slide kit for one user's saved style (Settings > Slide style): fonts, the header and footer choices, and who the
// slides are from (publication, organization, issue title, date), with logos ready for the renderer.

import { sized } from "../cdn";
import type { IssueData } from "../demo";
import { assertPublicHost, cleanPublicUrl } from "../publicFetch";
import { fontPair, issueDate, type SlideStyle } from "./style";
import type { IssueImage } from "../pollen/imageIds";
import { stockSvg } from "./stock";
import { PHOTO_MAX_PICKS, type Kit, type Slide, type SlideItem } from "./types";

type Logo = { src: string; aspect: number };

/** Width / height of a PNG, GIF or JPEG from its header bytes, or null when it isn't one (or can't be read). */
export function imageAspect(buf: Buffer): number | null {
  let w = 0;
  let h = 0;
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    w = buf.readUInt32BE(16);
    h = buf.readUInt32BE(20);
  } else if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
    w = buf.readUInt16LE(6);
    h = buf.readUInt16LE(8);
  } else if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i + 9 < buf.length; ) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        h = buf.readUInt16BE(i + 5);
        w = buf.readUInt16BE(i + 7);
        break;
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return w > 0 && h > 0 ? w / h : null;
}

const MAX_BYTES = 600_000;
/** A picture from an issue (shown as a banner on a card) is bigger than a logo; we ask the CDN for ~1000px wide, so this is generous. */
const PHOTO_MAX_BYTES = 1_500_000;
const PHOTO_WIDTH = 1000;
const TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const CACHE_MS = 30 * 60_000;
type Cached = Map<string, { at: number; logo: Logo | null }>;
const cache: Cached = new Map();
// Photos are large data URIs, so far fewer are kept than logos.
const photoCache: Cached = new Map();

/**
 * A publication's logo as a data URI the renderer can draw, or null. The address can be one a user typed, so it gets the same
 * care as any public page we read: https only, no private addresses (checked on every redirect), a time and a size limit.
 * A logo that can't be had just means the slide shows the name alone.
 */
export const fetchLogo = (raw: string): Promise<Logo | null> => fetchImage(raw, MAX_BYTES, cache, 50);

/**
 * A picture from the user's own issue as a data URI the renderer can draw, or null (then the slide is drawn without it).
 * Same care as a logo: the address comes out of the issue's HTML, so it is still checked as a public https host on every redirect.
 * PNG, JPEG and GIF only: the slide renderer can't draw WebP.
 */
export const fetchPhoto = (raw: string): Promise<Logo | null> => fetchImage(sized(raw, PHOTO_WIDTH), PHOTO_MAX_BYTES, photoCache, 12, true);

/** Pictures on other sites are often WebP or AVIF, or several MB: for photos those are downloaded (up to this size) and turned into a ~1000px JPEG. */
const PHOTO_DOWNLOAD_MAX = 8_000_000;

async function fetchImage(raw: string, maxBytes: number, cache: Cached, keep: number, convert = false): Promise<Logo | null> {
  const hit = cache.get(raw);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.logo;
  let logo: Logo | null = null;
  try {
    let url = cleanPublicUrl(raw);
    for (let hop = 0; hop <= MAX_REDIRECTS && !logo; hop++) {
      await assertPublicHost(url.hostname);
      const res = await fetch(url, {
        redirect: "manual",
        headers: { Accept: convert ? "image/jpeg,image/png,image/gif,image/webp,image/avif;q=0.9,image/*;q=0.5" : "image/png,image/jpeg,image/gif;q=0.8", "User-Agent": "PollenPicks/1.0 (+https://pollenpicks.netlify.app)" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = cleanPublicUrl(new URL(res.headers.get("location")!, url).href);
        continue;
      }
      let type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const plain = ["image/png", "image/jpeg", "image/gif"].includes(type);
      if (!res.ok || !(plain || (convert && /^image\/(webp|avif|jpg|pjpeg|x-png|tiff|heic)$/.test(type)))) {
        if (convert) console.warn(`[photo] skipped ${url.href}: HTTP ${res.status}, content-type "${type}"`);
        break;
      }
      if (Number(res.headers.get("content-length") ?? 0) > (convert ? PHOTO_DOWNLOAD_MAX : maxBytes)) break;
      let buf: Buffer = Buffer.from(await res.arrayBuffer());
      if (buf.length > (convert ? PHOTO_DOWNLOAD_MAX : maxBytes)) break;
      // The slide renderer draws PNG, JPEG and GIF only, and a photo has to stay small: anything else (or anything big) becomes a JPEG.
      if (convert && (!plain || buf.length > maxBytes)) {
        const { default: sharp } = await import("sharp");
        buf = await sharp(buf, { failOn: "none" }).rotate().resize({ width: PHOTO_WIDTH, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer();
        type = "image/jpeg";
        if (buf.length > maxBytes) break;
      }
      const aspect = imageAspect(buf);
      if (aspect) logo = { src: `data:${type === "image/jpg" ? "image/jpeg" : type};base64,${buf.toString("base64")}`, aspect };
      break;
    }
  } catch (e) {
    if (convert) console.warn(`[photo] failed ${raw}: ${e instanceof Error ? e.message : e}`);
    logo = null;
  }
  if (convert && !logo) console.warn(`[photo] no picture drawn for ${raw}`);
  if (cache.size >= keep) cache.delete(cache.keys().next().value!);
  cache.set(raw, { at: Date.now(), logo });
  return logo;
}

/** Looks up a picture address the signed-in user saved, by its id: the address, or null when it isn't theirs or is gone. */
export type SavedPhotoLink = (id: string) => Promise<string | null>;

/** The cover or closing slide with its chosen picture drawn in. A picture that can't be fetched is left out; the slide is still drawn. */
export async function withCoverPhoto(slide: Slide, images: IssueImage[] | undefined, saved?: SavedPhotoLink): Promise<Slide> {
  if ((slide.kind !== "cover" && slide.kind !== "closing") || !slide.photoId) return slide;
  // A built-in picture is drawn in code: no issue and no fetch needed.
  const stock = stockSvg(slide.photoId);
  if (stock) return { ...slide, photo: `data:image/svg+xml;base64,${Buffer.from(stock).toString("base64")}` };
  // The issue's picture, else one the user saved a link to.
  const src = (images ?? []).find((i) => i.id === slide.photoId)?.src ?? (await saved?.(slide.photoId));
  if (!src) return slide;
  const photo = await fetchPhoto(src);
  return photo ? { ...slide, photo: photo.src } : slide;
}

/** The slide's picks with the pictures chosen for them drawn in. A picture that can't be fetched is left out; the slide is still drawn. */
export async function withPhotos(items: SlideItem[], images: IssueImage[] | undefined, linkImages?: (pickId: number) => Promise<IssueImage[]>, saved?: SavedPhotoLink): Promise<SlideItem[]> {
  if (items.length > PHOTO_MAX_PICKS || !items.some((i) => i.photoId)) return items;
  const byId = new Map((images ?? []).map((i) => [i.id, i]));
  return Promise.all(
    items.map(async (it) => {
      // The picture is one from the issue, else one the user saved a link to, else one from the page the pick links to (each looked up
      // only when the one before doesn't have it).
      // A built-in picture is drawn in code: no issue and no fetch needed.
      const stock = it.photoId ? stockSvg(it.photoId) : undefined;
      if (stock) return { ...it, photo: `data:image/svg+xml;base64,${Buffer.from(stock).toString("base64")}` };
      let src = it.photoId ? byId.get(it.photoId)?.src : undefined;
      if (!src && it.photoId) src = (await saved?.(it.photoId)) ?? undefined;
      if (!src && it.photoId && linkImages && it.id != null) src = (await linkImages(it.id)).find((i) => i.id === it.photoId)?.src;
      const photo = src ? await fetchPhoto(src) : null;
      return photo ? { ...it, photo: photo.src } : it;
    }),
  );
}

const dataUriAspect = (uri: string): number | undefined => imageAspect(Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64")) ?? undefined;

/** The kit fields a saved style adds: fonts, which corner shows what, and the facts to show. */
export async function styleKit(style: SlideStyle, issue: IssueData): Promise<Pick<Kit, "fonts" | "slots" | "identity" | "attribution">> {
  const uses = (s: "publication" | "organization") => style.top === s || style.bottom === s || style.bottomRight === s;
  const pubUrl = issue.publication?.logo;
  const pub = uses("publication") && pubUrl ? await fetchLogo(sized(pubUrl, 256)) : null;
  const orgLogo = uses("organization") ? style.orgLogo : null;
  return {
    fonts: fontPair(style.font),
    slots: { top: style.top, bottom: style.bottom, bottomRight: style.bottomRight },
    // The credit is drawn only where the person put it (the cover and closing slides show it when any corner has it).
    attribution: [style.top, style.bottom, style.bottomRight].includes("attribution"),
    identity: {
      publication: { name: issue.newsletter, logo: pub?.src, logoAspect: pub?.aspect },
      // An organization name left empty in Settings falls back to the one beehiiv gives for the publication.
      organization: { name: style.orgName || issue.publication?.organization || "", logo: orgLogo ?? undefined, logoAspect: orgLogo ? dataUriAspect(orgLogo) : undefined },
      title: issue.title,
      date: issueDate(issue.publishedAt),
    },
  };
}
