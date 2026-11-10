import type { CSSProperties, ReactElement } from "react";
import { BRAND_NAME, contrast, sameColor } from "@/lib/brand";
import { MARK_SVG } from "./mark";
import { BODY_H, CARD_GAP, CONTENT_W, TAG_SHRINK, lines, shortBlurb } from "./plan";
import type { Slot } from "./style";
import { PHOTO_MAX_PICKS, SLIDE_H, SLIDE_W, type Kit, type Slide, type SlideItem } from "./types";

// Satori (next/og) renders this: flexbox only, inline styles, no Tailwind.
const DISPLAY_FONT = "Madimi One";
const BODY_FONT = "DM Sans";
// Satori only honours lineClamp on display:block elements, so the clamp sets it (spread after the element's own display).
const clamp = (n: number) => ({ lineClamp: n, display: "block" }) as CSSProperties;
const P = 72;
const TEXT_W = SLIDE_W - 2 * P;
/** The cover's picture, when it is a section (not the background), takes the room between the name and the text, up to this tall. */
const COVER_PHOTO_MAX_H = 640;
/** Height of the cover's corner dandelion. */
const PUFF_H = 160;

/** The largest font size from `from` down to `to` (steps of 4) at which `text` fits `height` when wrapped to the text width. Rough, like the card model. */
const fitFont = (text: string, em: number, height: number, from: number, to: number, lh: number) => {
  const longest = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  for (let s = from; s > to; s -= 4) if (longest * s * em <= TEXT_W && wrapLines(text, s, em, TEXT_W) * s * lh <= height) return s;
  return to;
};

type TextSizes = { title: number; titleLines: number; body: number; bodyLines: number };

/**
 * Sizes for a slide's title and its text. Empty ones are simply not drawn, and the other takes the room: a title alone grows to
 * fill the slide, a text alone is as big as it can be while all of it fits (so a long one is small). With both, the title keeps its
 * size and the text shrinks only if it would not fit below it.
 */
function textSizes(title: string, body: string, o: { title: number; titleMax: number; titleLh: number; body: number; bodyMax: number; bodyMin: number; room: number }): TextSizes {
  const T = 0.62; // average character width in ems: the display font, then the body font
  const B = 0.56;
  const GAP = 28;
  const lines = (text: string, size: number, em: number) => wrapLines(text, size, em, TEXT_W);
  if (title && !body) {
    const s = fitFont(title, T, o.room, o.titleMax, o.title, o.titleLh);
    return { title: s, titleLines: lines(title, s, T) + 1, body: o.body, bodyLines: 1 };
  }
  if (!title && body) {
    const s = fitFont(body, B, o.room, o.bodyMax, o.bodyMin, 1.3);
    return { title: o.title, titleLines: 1, body: s, bodyLines: Math.max(1, Math.floor(o.room / (s * 1.3))) };
  }
  const t = fitFont(title, T, o.room * 0.6, o.title, 64, o.titleLh);
  const left = Math.max(o.room - Math.min(4, lines(title, t, T)) * t * o.titleLh - GAP, o.bodyMin * 1.3);
  const s = body ? fitFont(body, B, left, o.body, o.bodyMin, 1.3) : o.body;
  return { title: t, titleLines: 4, body: s, bodyLines: Math.max(1, Math.floor(left / (s * 1.3))) };
}

function Brand({ kit, size, logo, fontSize, stacked, color }: { kit: Kit; size: number; logo?: string; fontSize: number; stacked?: boolean; color?: string }) {
  if (stacked && kit.nameLines) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize, fontWeight: 700, lineHeight: 1.1 }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={size} height={size} alt="" />
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex" }}>{kit.nameLines[0]}</div>
          <div style={{ display: "flex" }}>{kit.nameLines[1]}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize, fontWeight: 700, color }}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} width={size} height={size} alt="" />
      )}
      {kit.name}
    </div>
  );
}

function Credit({ kit, size = 26, color: fill }: { kit: Kit; size?: number; color?: string }) {
  if (kit.attribution === false) return null;
  const color = fill ?? kit.colors.text;
  const mark = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG.replaceAll("__FILL__", color)).toString("base64")}`;
  const h = Math.round(size * 2.5);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: size, fontWeight: 500 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mark} width={Math.round((h * 404) / 608)} height={h} alt="" />
      {`Created with ${BRAND_NAME}`}
    </div>
  );
}

/**
 * One corner of a pick slide's header or footer, as chosen in Settings (kit.slots): the publication or the organization (name + logo),
 * the issue's title or date, or nothing. `maxWidth` keeps it clear of the page number (header) or the credit (footer).
 */
function CornerSlot({ kind, kit, logoSize, fontSize, color, maxWidth, lines = 1 }: { kind: Slot; kit: Kit; logoSize: number; fontSize: number; color?: string; maxWidth: number; /** A long name or title may wrap onto this many lines before it is cut off with "…". */ lines?: number }) {
  const id = kit.identity;
  const empty = <div style={{ display: "flex" }} />;
  if (!id || kind === "none") return empty;
  if (kind === "attribution") return kit.attribution === false ? empty : <Credit kit={kit} size={Math.max(20, fontSize - 4)} color={color} />;
  if (kind === "title" || kind === "carousel" || kind === "date") {
    const text = kind === "title" ? id.title : kind === "carousel" ? id.carouselTitle : id.date;
    return text ? (
      <div style={{ display: "flex", maxWidth, fontSize, fontWeight: 700, color }}>
        <div style={{ lineHeight: 1.1, ...clamp(lines) }}>{text}</div>
      </div>
    ) : (
      empty
    );
  }
  const who = kind === "publication" ? id.publication : id.organization;
  if (!who.name && !who.logo) return empty;
  // A wide logo is capped at half the room so the name still fits beside it.
  const aspect = who.logoAspect ?? 1;
  const cap = Math.round(maxWidth * (who.name ? 0.5 : 1));
  const w = Math.min(Math.round(logoSize * aspect), cap);
  const h = Math.round(w / aspect);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, maxWidth, fontSize, fontWeight: 700, color }}>
      {who.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={who.logo} width={w} height={h} alt="" />
      )}
      {who.name && <div style={{ lineHeight: 1.1, ...clamp(lines) }}>{who.name}</div>}
    </div>
  );
}

const CREAM = "#f7ede2";

/** Text color for a custom background: the kit's ink, or cream when that reads better. */
const textOn = (bg: string, ink: string) => (contrast(bg, ink) >= contrast(bg, CREAM) ? ink : CREAM);

export function SlideView({ slide, kit: baseKit }: { slide: Slide; kit: Kit }): ReactElement {
  // A custom background recolors the slide itself; text on it flips between ink and cream. Cards keep their own ink text.
  const custom = slide.bg ? slide.bg : undefined;
  const fg = custom ? textOn(custom, baseKit.colors.text) : undefined;
  const styled: Kit = custom ? { ...baseKit, onBackground: fg, nameOnBackground: fg } : baseKit;
  // The "Carousel title" corner shows the cover's title, which only the plan knows.
  const kit: Kit = slide.kind === "picks" && styled.identity ? { ...styled, identity: { ...styled.identity, carouselTitle: slide.carouselTitle ?? "" } } : styled;
  const c = kit.colors;
  const DISPLAY = kit.fonts?.display ?? DISPLAY_FONT;
  const DW = kit.fonts ? 700 : 400;
  const base: CSSProperties = { width: SLIDE_W, height: SLIDE_H, display: "flex", flexDirection: "column", fontFamily: kit.fonts?.body ?? BODY_FONT, color: c.text };
  // Once a slide style is saved, the top left of the cover and the closing slide shows what the person chose for the header's top left corner (instead of the
  // publication's name lockup). The credit is then drawn there, not a second time at the bottom.
  const topChoice = kit.styled && kit.slots ? kit.slots.top : undefined;
  const endCredit = topChoice === "attribution" ? null : undefined;
  if (slide.kind === "cover") {
    const bgPhoto = slide.photo && slide.photoMode === "background" ? slide.photo : undefined;
    const boxPhoto = slide.photo && slide.photoMode !== "background" ? slide.photo : undefined;
    // On a picture the text is always light, over a darkening layer, whatever the slide color would have chosen.
    const ink = bgPhoto ? CREAM : (fg ?? textOn(c.accent, c.text));
    const coverKit: Kit = bgPhoto || ink !== c.text ? { ...kit, onBackground: ink, nameOnBackground: ink } : kit;
    // The corner dandelion hangs below the top margin; the picture starts below it rather than under it.
    const brandH = topChoice ? 96 : kit.logoOnAccent ?? kit.logo ? 150 : kit.nameLines ? 124 : 42;
    const puffClear = slide.puff && boxPhoto ? Math.max(0, P + PUFF_H + 28 - (P + brandH + 48)) : 0;
    const sz = textSizes(slide.title, slide.subtitle, { title: kit.coverTitleSize ?? 168, titleMax: 300, titleLh: 1, body: 44, bodyMax: 72, bodyMin: 28, room: boxPhoto ? 360 : 780 });
    return (
      <div style={{ ...base, background: custom ?? c.accent, color: ink, position: "relative" }}>
        {bgPhoto && (
          <>
            {/* An <img> with object-fit: the renderer does not honor background-size: cover (the picture tiles instead). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgPhoto} width={SLIDE_W} height={SLIDE_H} alt="" style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
            <div style={{ position: "absolute", top: 0, left: 0, width: SLIDE_W, height: SLIDE_H, display: "flex", backgroundImage: "linear-gradient(rgba(20,28,25,0.38), rgba(20,28,25,0.66))" }} />
          </>
        )}
        {slide.puff && (
          // A static dandelion, half faded, in the corner opposite the name: the mark the "Created with" credit uses, in the text color.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/svg+xml;base64,${Buffer.from(MARK_SVG.replaceAll("__FILL__", ink)).toString("base64")}`} width={Math.round((PUFF_H * 404) / 608)} height={PUFF_H} alt="" style={{ position: "absolute", top: P, right: P, opacity: 0.5 }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: P, width: SLIDE_W, height: SLIDE_H, ...(boxPhoto ? { gap: 48 } : {}) }}>
        {topChoice ? <CornerSlot kind={topChoice} kit={kit} logoSize={96} fontSize={34} color={ink} maxWidth={760} lines={2} /> : <Brand kit={coverKit} size={150} logo={kit.logoOnAccent ?? kit.logo} fontSize={kit.nameLines ? 56 : 34} stacked />}
        {boxPhoto && (
          <div style={{ display: "flex", flex: 1, minHeight: 280, maxHeight: COVER_PHOTO_MAX_H, borderRadius: 44, overflow: "hidden", marginTop: puffClear }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={boxPhoto} width="100%" height="100%" alt="" style={{ objectFit: "cover" }} />
          </div>
        )}
        {(slide.title || slide.subtitle) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {slide.title && <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: DW, fontSize: sz.title, lineHeight: 1, ...clamp(sz.titleLines) }}>{slide.title}</div>}
            {slide.subtitle && <div style={{ display: "flex", fontSize: sz.body, fontWeight: 500, lineHeight: 1.3, ...clamp(sz.bodyLines) }}>{slide.subtitle}</div>}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700 }}>
            Swipe
            <svg width="56" height="28" viewBox="0 0 56 28">
              <path d="M3 14h48M38 3l13 11-13 11" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          {slide.images?.length ? <CoverImages images={slide.images} /> : endCredit === null ? <div style={{ display: "flex" }} /> : <Credit kit={kit} color={ink} />}
        </div>
        {slide.images?.length && endCredit !== null ? <Credit kit={kit} color={ink} /> : null}
        </div>
        </div>
      </div>
    );
  }
  if (slide.kind === "closing") {
    const dark = !!slide.dark;
    const fgClosing = custom ? fg! : dark ? (kit.onBackground ?? c.text) : textOn(c.card, c.text);
    const bgPhoto = slide.photo && slide.photoMode === "background" ? slide.photo : undefined;
    const boxPhoto = slide.photo && slide.photoMode !== "background" ? slide.photo : undefined;
    // On a picture the text is always light, over a darkening layer, whatever the slide color would have chosen.
    const onPhoto = !!bgPhoto;
    const ink = onPhoto ? CREAM : fgClosing;
    const flipped = !custom && !dark && ink !== c.text;
    const photoKit: Kit = onPhoto || flipped ? { ...kit, onBackground: ink, nameOnBackground: ink } : kit;
    const csz = textSizes(slide.title, slide.line, { title: 132, titleMax: 240, titleLh: 1.02, body: 46, bodyMax: 72, bodyMin: 30, room: (boxPhoto ? 380 : 700) - (slide.more > 0 ? 90 : 0) - (slide.link ? 70 : 0) });
    return (
      <div style={{ ...base, background: custom ?? (dark ? c.background : c.card), color: ink, position: "relative" }}>
        {bgPhoto && (
          <>
            {/* An <img> with object-fit: the renderer does not honor background-size: cover (the picture tiles instead). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgPhoto} width={SLIDE_W} height={SLIDE_H} alt="" style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
            <div style={{ position: "absolute", top: 0, left: 0, width: SLIDE_W, height: SLIDE_H, display: "flex", backgroundImage: "linear-gradient(rgba(20,28,25,0.38), rgba(20,28,25,0.66))" }} />
          </>
        )}
        {/* Padding lives on this inner box: the renderer offsets absolutely placed pictures by the parent's padding. */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: P, width: SLIDE_W, height: SLIDE_H, ...(boxPhoto ? { gap: 48 } : {}) }}>
        {topChoice ? <CornerSlot kind={topChoice} kit={kit} logoSize={96} fontSize={34} color={onPhoto || flipped ? ink : dark ? kit.nameOnBackground : undefined} maxWidth={760} lines={2} /> : <Brand kit={photoKit} size={140} logo={dark || onPhoto ? (kit.logoOnBackground ?? kit.logo) : kit.logo} fontSize={34} color={onPhoto || flipped ? ink : dark ? kit.nameOnBackground : undefined} />}
        {boxPhoto && (
          <div style={{ display: "flex", flex: 1, minHeight: 280, maxHeight: COVER_PHOTO_MAX_H, borderRadius: 44, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={boxPhoto} width="100%" height="100%" alt="" style={{ objectFit: "cover" }} />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {slide.more > 0 && (
            <div style={{ display: "flex", alignSelf: "flex-start", background: c.accent, color: textOn(c.accent, c.text), borderRadius: 999, padding: "10px 28px", fontSize: 40, fontWeight: 700 }}>
              +{slide.more} more
            </div>
          )}
          {slide.title && <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: DW, fontSize: csz.title, lineHeight: 1.02, ...clamp(Math.max(3, csz.titleLines)) }}>{slide.title}</div>}
          {slide.line && <div style={{ display: "flex", fontSize: csz.body, fontWeight: 500, lineHeight: 1.3, ...clamp(Math.max(3, csz.bodyLines)) }}>{slide.line}</div>}
          {slide.link && <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: c.accent }}>{slide.link}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {slide.cta !== "" ? (
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700, background: onPhoto ? ink : dark && !custom ? c.accent : fgClosing, color: onPhoto ? "#141c19" : dark && !custom ? c.background : (custom ?? c.card), borderRadius: 999, padding: "16px 36px" }}>
              {slide.cta ?? "Subscribe · link in bio"}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
          {slide.images?.length ? <CoverImages images={slide.images} size={100} /> : endCredit === null ? <div style={{ display: "flex" }} /> : <Credit kit={kit} color={onPhoto ? ink : fg} />}
        </div>
        {slide.images?.length && endCredit !== null ? <Credit kit={kit} color={onPhoto ? ink : fg} /> : null}
        </div>
        </div>
      </div>
    );
  }
  const n = slide.items.length;
  // When the publication and the organization have the same name, it only appears once: bottom left, with the top left left empty.
  const nameOf = (k: Slot | undefined) => (k === "publication" ? kit.identity?.publication.name : k === "organization" ? kit.identity?.organization.name : undefined)?.trim().toLowerCase();
  // A name only appears once, in the first of these corners to show it: bottom left, then bottom right, then top left.
  const seen = new Set<string>();
  const once = (k: Slot | undefined): Slot => {
    const name = nameOf(k);
    if (!k) return "none";
    if (!name) return k;
    if (seen.has(name)) return "none";
    seen.add(name);
    return k;
  };
  const bottomKind = once(kit.slots?.bottom);
  const bottomRightKind = once(kit.slots?.bottomRight);
  const topKind = once(kit.slots?.top);
  const hasImage = slide.items.length === 1 && !!slide.items[0].image;
  // The left and right corners of the footer share one row (the single pick's picture takes the right end too): each gets what is left.
  const bothBelow = bottomKind !== "none" && bottomRightKind !== "none";
  const leftW = bothBelow ? 440 : hasImage ? 470 : 560;
  const rightW = bothBelow ? (hasImage ? 330 : 440) : hasImage ? 470 : 560;
  // Without a saved style (the demo, or before one is chosen) the bottom left repeats the plain name when there is no logo or "Swipe": show it there only.
  const nameOnlyBelow = !kit.slots && !kit.swipe && !kit.logo;
  return (
    <div style={{ ...base, background: custom ?? c.background, padding: P, gap: 28, color: kit.onBackground ?? c.text }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", background: slide.group ? c.chip : "transparent", borderRadius: 999, padding: slide.group ? "8px 26px" : 0, fontSize: 32, fontWeight: 700, color: slide.group ? textOn(c.chip, c.text) : c.text }}>
          {slide.group ??
            (kit.slots ? (
              <CornerSlot kind={topKind ?? "none"} kit={kit} logoSize={64} fontSize={32} color={kit.nameOnBackground} maxWidth={720} />
            ) : nameOnlyBelow ? (
              <div style={{ display: "flex" }} />
            ) : (
              <Brand kit={kit} size={64} logo={kit.logoOnBackground ?? kit.logo} fontSize={32} color={kit.nameOnBackground} />
            ))}
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
          {slide.page} / {slide.pages}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 28 }}>
        {slide.items.map((it, i) => {
          // A slide color paints the whole slide, cards included: they take the slide's color and are told apart by an outline. A card with its own color keeps it.
          const tone = it.bg ?? custom ?? (i % 2 === 0 ? c.card : c.accent);
          return <Card key={i} item={it} n={n} tone={tone} showGroup={!slide.group && n <= 2} chip={c.chip} chipText={textOn(c.chip, c.text)} display={DISPLAY} dw={DW} text={textOn(tone, c.text)} outline={sameColor(tone, custom ?? c.background)} />;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: slide.items.length === 1 && slide.items[0].image ? 104 : 64 }}>
        {kit.slots ? (
          // Two lines of 28px still fit the 64px footer.
          <CornerSlot kind={bottomKind} kit={kit} logoSize={56} fontSize={28} color={kit.onBackground} maxWidth={leftW} lines={2} />
        ) : kit.swipe ? (
          <Swipe color={kit.onBackground ?? c.text} />
        ) : kit.logo ? (
          <div style={{ display: "flex" }} />
        ) : (
          <Brand kit={kit} size={56} logo={undefined} fontSize={28} />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {kit.slots ? <CornerSlot kind={bottomRightKind} kit={kit} logoSize={56} fontSize={28} color={kit.onBackground} maxWidth={rightW} lines={2} /> : <Credit kit={kit} size={24} color={fg} />}
          {slide.items.length === 1 && slide.items[0].image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.items[0].image} width={104} height={104} alt="" style={{ borderRadius: 22, objectFit: "cover" }} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

const SIZES = {
  1: { title: 92, titleLines: 4, meta: 44, blurb: 32, blurbLines: 6, pad: 56, gap: 28 },
  2: { title: 64, titleLines: 3, meta: 36, blurb: 30, blurbLines: 4, pad: 44, gap: 18 },
  3: { title: 50, titleLines: 2, meta: 30, blurb: 26, blurbLines: 1, pad: 36, gap: 12 },
  4: { title: 42, titleLines: 2, meta: 26, blurb: 22, blurbLines: 1, pad: 28, gap: 8 },
} as const;

/** Lines needed when whole words wrap (what the renderer does), with every character `em` wide. Never fewer than the real count for a wider-than-average font. */
const wrapLines = (text: string, px: number, em: number, width: number) => {
  const char = px * em;
  let n = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = word.length * char;
    if (used === 0) used = w;
    else if (used + char + w <= width) used += char + w;
    else {
      n++;
      used = w;
    }
  }
  return n;
};

/** The largest a title may grow when its card has no description. */
const TITLE_MAX = { 1: 300, 2: 190, 3: 110, 4: 84 } as const;

const LOGO_H = { 1: 100, 2: 72, 3: 56, 4: 44 } as const;

/** Height of the picture banner at the top of a card (only slides with 1 or 2 picks have room for one). */
const PHOTO_H = { 1: 320, 2: 120 } as const;

/** A card the same color as its slide would vanish; swap it for the kit background (or, if that is the slide color, the other card tone). */

function Card({ item, n, tone, showGroup, chip, chipText, display, dw, text, outline }: { item: SlideItem; n: number; tone: string; showGroup: boolean; chip: string; chipText: string; display: string; dw: number; text: string; outline?: boolean }) {
  const z = SIZES[n as 1 | 2 | 3 | 4];
  const photoH = item.photo && n <= PHOTO_MAX_PICKS ? PHOTO_H[n as 1 | 2] : 0;
  // The description gets whatever height is left after everything else on the card (chip, title, date line, @handle), so the
  // @handle and the date line are never squeezed or pushed over the text. A rough model, like the one that packs picks onto slides.
  const blurbLines = (() => {
    if (!item.blurb) return 0;
    const width = CONTENT_W - 2 * z.pad;
    const meta = [item.when, item.place].filter(Boolean).join(" · ");
    let fixed = 2 * z.pad + (item.title ? Math.min(z.titleLines, lines(item.title, z.title, 0.6, width)) * z.title * 1.08 : 0);
    let parts = item.title ? 2 : 1; // the title (when there is one) and the description
    if (showGroup && item.group) {
      fixed += (z.meta - 8) * 1.2 + 8;
      parts++;
    }
    if (item.logo) {
      fixed += LOGO_H[n as 1 | 2 | 3 | 4];
      parts++;
    }
    if (photoH) {
      fixed += photoH;
      parts++;
    }
    if (meta) {
      fixed += Math.min(2, lines(meta, z.meta, 0.55, width)) * z.meta * 1.2;
      parts++;
    }
    if (item.tag) {
      fixed += (z.meta - TAG_SHRINK) * 1.2;
      parts++;
    }
    const room = (BODY_H - (n - 1) * CARD_GAP) / n - fixed - (parts - 1) * z.gap + 8; // 8: the bottom padding can give a little
    // With one or two picks per slide the description may use every line that is left; with more, a short one-liner is the design.
    const fits = Math.floor(room / (z.blurb * 1.35));
    // Without a title the description is the card: it may use every line that is left, however many picks share the slide.
    return Math.max(0, n <= 2 || !item.title ? fits : Math.min(z.blurbLines, fits));
  })();
  // No description: the title takes the room it would have had, as large as it fits (same rough model as above: lines from the character
  // count, and no single word wider than the card).
  const title = (() => {
    if (item.blurb || !item.title) return { size: z.title, lines: z.titleLines };
    const width = CONTENT_W - 2 * z.pad;
    const meta = [item.when, item.place].filter(Boolean).join(" · ");
    let other = 0;
    let parts = 1; // the title
    if (showGroup && item.group) {
      other += (z.meta - 8) * 1.2 + 8;
      parts++;
    }
    if (item.logo) {
      other += LOGO_H[n as 1 | 2 | 3 | 4];
      parts++;
    }
    if (photoH) {
      other += photoH;
      parts++;
    }
    if (meta) {
      other += Math.min(2, lines(meta, z.meta, 0.55, width)) * z.meta * 1.2;
      parts++;
    }
    if (item.tag) {
      other += (z.meta - TAG_SHRINK) * 1.2;
      parts++;
    }
    const room = ((BODY_H - (n - 1) * CARD_GAP) / n - 2 * z.pad - other - (parts - 1) * z.gap) * 0.92;
    const longest = Math.max(...item.title.split(/\s+/).map((w) => w.length));
    for (let size = TITLE_MAX[n as 1 | 2 | 3 | 4]; size > z.title; size -= 4) {
      const l = wrapLines(item.title, size, 0.62, width);
      if (longest * size * 0.62 <= width && l * size * 1.08 <= room) return { size, lines: l + 1 };
    }
    return { size: z.title, lines: z.titleLines };
  })();
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: tone, color: text, borderRadius: 44, padding: outline ? z.pad - 4 : z.pad, gap: z.gap, justifyContent: "center", overflow: "hidden", ...(outline ? { border: `4px solid ${text}` } : {}) }}>
      {photoH > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photo} width={CONTENT_W - 2 * z.pad} height={photoH} alt="" style={{ borderRadius: 28, objectFit: "cover", flexShrink: 0 }} />
      )}
      {showGroup && item.group && (
        <div style={{ display: "flex", alignSelf: "flex-start", background: chip, color: chipText, borderRadius: 999, padding: "4px 20px", fontSize: z.meta - 8, fontWeight: 700 }}>{item.group}</div>
      )}
      {item.logo && (
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.logo} height={LOGO_H[n as 1 | 2 | 3 | 4]} width={Math.round(LOGO_H[n as 1 | 2 | 3 | 4] * (item.logoAspect ?? 1))} alt="" />
          {item.partnerLogo && (
            <>
              <div style={{ display: "flex", justifyContent: "center", width: 84, fontSize: z.meta, fontWeight: 700, lineHeight: 1, position: "relative", top: 10 }}>&</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.partnerLogo} height={Math.round(LOGO_H[n as 1 | 2 | 3 | 4] * 0.36)} width={Math.round(LOGO_H[n as 1 | 2 | 3 | 4] * 0.36 * (item.partnerAspect ?? 1))} alt="" style={{ position: "relative", top: 10 }} />
            </>
          )}
        </div>
      )}
      {item.title && <div style={{ display: "flex", fontFamily: display, fontWeight: dw, fontSize: title.size, lineHeight: 1.08, flexShrink: 0, ...clamp(title.lines) }}>{item.title}</div>}
      {(item.when || item.place) && (
        <div style={{ display: "flex", fontSize: z.meta, fontWeight: 700, flexShrink: 0, ...clamp(2) }}>{[item.when, item.place].filter(Boolean).join(" · ")}</div>
      )}
      {blurbLines > 0 && item.blurb && <div style={{ display: "flex", fontSize: z.blurb, lineHeight: 1.35, ...clamp(blurbLines) }}>{n >= 3 && item.title ? shortBlurb(item.blurb) : item.blurb}</div>}
      {item.tag && <div style={{ display: "flex", fontSize: z.meta - TAG_SHRINK, fontWeight: 700, flexShrink: 0, ...clamp(1) }}>{`@${item.tag}`}</div>}
    </div>
  );
}

function Swipe({ color, size = 34 }: { color: string; size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: size, fontWeight: 700, color }}>
      Swipe
      <svg width="56" height="28" viewBox="0 0 56 28">
        <path d="M3 14h48M38 3l13 11-13 11" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

function CoverImages({ images, size = 140 }: { images: string[]; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {images.slice(0, 5).map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} width={size} height={size} alt="" style={{ borderRadius: 18, objectFit: "cover" }} />
      ))}
    </div>
  );
}
