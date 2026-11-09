// Server-only: the one place a set of slides is drawn from an issue. The preview route (what the browser and Buffer's older signed links fetch)
// and the send queue (which draws the final slides once and stores them, see ../slideStore) both come through here, so a stored slide is
// exactly the slide the person saw.

import { DEFAULT_COLORS } from "../brand";
import type { IssueData } from "../demo";
import { knownForPicks } from "../instagramHandles";
import { linkImagesFor } from "../pollen/linkImages";
import { loadSlideStyle } from "../slideStyleStore";
import { photoLinkUrl } from "../userPhotoLinks";
import { slideItemsFor } from "./items";
import { styleKit, withCoverPhoto, withPhotos } from "./kit";
import type { parseTemplateFrom } from "./options";
import { planSlides } from "./plan";
import { renderSlide } from "./render";
import { DEFAULT_STYLE } from "./style";

export type SlideSetInput = {
  issue: IssueData;
  ids: number[];
  template: ReturnType<typeof parseTemplateFrom>;
  /** Whose style (Settings) and saved picture links apply. Null for the shared demo addresses, which never use anyone's. */
  uid: string | null;
  /** True for one of the user's own issues or a pasted link (not the demo): their pictures are looked up for the picks. */
  ownIssue: boolean;
};

export type SlideSet = {
  count: number;
  /** One slide as an HTTP response (the route sends it on as is; the queue reads its bytes and content type). */
  render(n: number, opts?: { web?: { width: number }; smallJpeg?: boolean }): Promise<Response>;
};

/** The slides for these picks, or null when none of the picks exist in the issue. */
export async function prepareSlideSet(i: SlideSetInput): Promise<SlideSet | null> {
  const { issue, ids, uid, ownIssue } = i;
  const items = slideItemsFor(issue.chunks, ids, await knownForPicks(issue.chunks, ids));
  if (items.length === 0) return null;
  const slides = planSlides(items, { newsletter: issue.newsletter, defaultCoverPhoto: issue.images?.find((img) => img.preview)?.id, ...i.template });
  const saved = uid ? await loadSlideStyle(uid) : null;
  // A picture link the user saved is theirs alone: only looked up where the address belongs to them (uid).
  const savedLink = uid ? (id: string) => photoLinkUrl(uid, id) : undefined;
  return {
    count: slides.length,
    async render(n, opts = {}) {
      const slide = slides[n];
      const drawn =
        slide.kind === "picks"
          ? { ...slide, items: await withPhotos(slide.items, issue.images, ownIssue ? (id) => linkImagesFor(issue.chunks.find((c) => c.id === id)?.url) : undefined, savedLink) }
          : await withCoverPhoto(slide, issue.images, savedLink);
      // Someone who has not chosen a slide style (a row that only holds a palette or an organization is not one) gets the standard look: DEFAULT_STYLE.
      const kit = uid
        ? {
            ...(await styleKit(saved?.styled ? saved.style : { ...DEFAULT_STYLE, orgName: saved?.style.orgName ?? "", orgLogo: saved?.style.orgLogo ?? null }, issue)),
            ...(saved?.styled ? { styled: true as const } : {}),
          }
        : {};
      return renderSlide(drawn, { name: issue.newsletter, colors: DEFAULT_COLORS, ...kit }, opts.web, { smallJpeg: opts.smallJpeg });
    },
  };
}
