// Server-only: the slide kit for one user's saved style (Settings > Slide style): fonts, the header and footer choices, and who the
// slides are from (publication, organization, issue title, date), with logos ready for the renderer.

import { sized } from "../cdn";
import type { IssueData } from "../demo";
import { assertPublicHost, cleanPublicUrl } from "../publicFetch";
import { fontPair, issueDate, type SlideStyle } from "./style";
import type { Kit } from "./types";

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
const TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const CACHE_MS = 30 * 60_000;
const cache = new Map<string, { at: number; logo: Logo | null }>();

/**
 * A publication's logo as a data URI the renderer can draw, or null. The address can be one a user typed, so it gets the same
 * care as any public page we read: https only, no private addresses (checked on every redirect), a time and a size limit.
 * A logo that can't be had just means the slide shows the name alone.
 */
export async function fetchLogo(raw: string): Promise<Logo | null> {
  const hit = cache.get(raw);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.logo;
  let logo: Logo | null = null;
  try {
    let url = cleanPublicUrl(raw);
    for (let hop = 0; hop <= MAX_REDIRECTS && !logo; hop++) {
      await assertPublicHost(url.hostname);
      const res = await fetch(url, {
        redirect: "manual",
        headers: { Accept: "image/png,image/jpeg,image/gif;q=0.8", "User-Agent": "PollenPicks/1.0 (+https://pollenpicks.netlify.app)" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = cleanPublicUrl(new URL(res.headers.get("location")!, url).href);
        continue;
      }
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!res.ok || !["image/png", "image/jpeg", "image/gif"].includes(type)) break;
      const buf = Buffer.from(await res.arrayBuffer());
      const aspect = buf.length <= MAX_BYTES ? imageAspect(buf) : null;
      if (aspect) logo = { src: `data:${type};base64,${buf.toString("base64")}`, aspect };
      break;
    }
  } catch {
    logo = null;
  }
  if (cache.size >= 50) cache.delete(cache.keys().next().value!);
  cache.set(raw, { at: Date.now(), logo });
  return logo;
}

const dataUriAspect = (uri: string): number | undefined => imageAspect(Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64")) ?? undefined;

/** The kit fields a saved style adds: fonts, which corner shows what, and the facts to show. */
export async function styleKit(style: SlideStyle, issue: IssueData): Promise<Pick<Kit, "fonts" | "slots" | "identity">> {
  const uses = (s: "publication" | "organization") => style.top === s || style.bottom === s;
  const pubUrl = issue.publication?.logo;
  const pub = uses("publication") && pubUrl ? await fetchLogo(sized(pubUrl, 256)) : null;
  const orgLogo = uses("organization") ? style.orgLogo : null;
  return {
    fonts: fontPair(style.font),
    slots: { top: style.top, bottom: style.bottom },
    identity: {
      publication: { name: issue.newsletter, logo: pub?.src, logoAspect: pub?.aspect },
      // An organization name left empty in Settings falls back to the one beehiiv gives for the publication.
      organization: { name: style.orgName || issue.publication?.organization || "", logo: orgLogo ?? undefined, logoAspect: orgLogo ? dataUriAspect(orgLogo) : undefined },
      title: issue.title,
      date: issueDate(issue.publishedAt),
    },
  };
}
