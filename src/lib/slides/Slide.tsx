import type { CSSProperties, ReactElement } from "react";
import { BRAND_NAME, contrast, sameColor } from "@/lib/brand";
import { MARK_SVG } from "./mark";
import { shortBlurb } from "./plan";
import { SLIDE_H, SLIDE_W, type Kit, type Slide, type SlideItem } from "./types";

// Satori (next/og) renders this: flexbox only, inline styles, no Tailwind.
const DISPLAY_FONT = "Madimi One";
const BODY_FONT = "DM Sans";
// Satori only honours lineClamp on display:block elements, so the clamp sets it (spread after the element's own display).
const clamp = (n: number) => ({ lineClamp: n, display: "block" }) as CSSProperties;
const P = 72;

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

const CREAM = "#f7ede2";

/** Text color for a custom background: the kit's ink, or cream when that reads better. */
const textOn = (bg: string, ink: string) => (contrast(bg, ink) >= contrast(bg, CREAM) ? ink : CREAM);

export function SlideView({ slide, kit: baseKit }: { slide: Slide; kit: Kit }): ReactElement {
  // A custom background recolors the slide itself; text on it flips between ink and cream. Cards keep their own ink text.
  const custom = slide.bg ? slide.bg : undefined;
  const fg = custom ? textOn(custom, baseKit.colors.text) : undefined;
  const kit: Kit = custom ? { ...baseKit, onBackground: fg, nameOnBackground: fg } : baseKit;
  const c = kit.colors;
  const DISPLAY = kit.fonts?.display ?? DISPLAY_FONT;
  const DW = kit.fonts ? 700 : 400;
  const base: CSSProperties = { width: SLIDE_W, height: SLIDE_H, display: "flex", flexDirection: "column", fontFamily: kit.fonts?.body ?? BODY_FONT, color: c.text };
  if (slide.kind === "cover") {
    return (
      <div style={{ ...base, background: custom ?? c.accent, color: fg ?? c.text, padding: P, justifyContent: "space-between", position: "relative" }}>
        <Brand kit={kit} size={150} logo={kit.logoOnAccent ?? kit.logo} fontSize={kit.nameLines ? 56 : 34} stacked />
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: DW, fontSize: kit.coverTitleSize ?? 168, lineHeight: 1, ...clamp(4) }}>{slide.title}</div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 500 }}>{slide.subtitle}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700 }}>
            Swipe
            <svg width="56" height="28" viewBox="0 0 56 28">
              <path d="M3 14h48M38 3l13 11-13 11" stroke={fg ?? c.text} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          {slide.images?.length ? <CoverImages images={slide.images} /> : <Credit kit={kit} color={fg} />}
        </div>
        {slide.images?.length ? <Credit kit={kit} color={fg} /> : null}
        </div>
      </div>
    );
  }
  if (slide.kind === "closing") {
    const dark = !!slide.dark;
    const fgClosing = custom ? fg! : dark ? (kit.onBackground ?? c.text) : c.text;
    return (
      <div style={{ ...base, background: custom ?? (dark ? c.background : c.card), color: fgClosing, padding: P, justifyContent: "space-between" }}>
        <Brand kit={kit} size={140} logo={dark ? (kit.logoOnBackground ?? kit.logo) : kit.logo} fontSize={34} color={dark ? kit.nameOnBackground : undefined} />
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {slide.more > 0 && (
            <div style={{ display: "flex", alignSelf: "flex-start", background: c.accent, borderRadius: 999, padding: "10px 28px", fontSize: 40, fontWeight: 700 }}>
              +{slide.more} more
            </div>
          )}
          <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: DW, fontSize: 132, lineHeight: 1.02, ...clamp(3) }}>{slide.title}</div>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 500, ...clamp(3) }}>{slide.line}</div>
          {slide.link && <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: c.accent }}>{slide.link}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, background: dark && !custom ? c.accent : fgClosing, color: dark && !custom ? c.background : (custom ?? c.card), borderRadius: 999, padding: "16px 36px" }}>
            {slide.cta ?? "Subscribe · link in bio"}
          </div>
          {slide.images?.length ? <CoverImages images={slide.images} size={100} /> : <Credit kit={kit} color={fg} />}
        </div>
        {slide.images?.length ? <Credit kit={kit} color={fg} /> : null}
        </div>
      </div>
    );
  }
  const n = slide.items.length;
  return (
    <div style={{ ...base, background: custom ?? c.background, padding: P, gap: 28, color: kit.onBackground ?? c.text }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", background: slide.group ? c.chip : "transparent", borderRadius: 999, padding: slide.group ? "8px 26px" : 0, fontSize: 32, fontWeight: 700, color: c.text }}>
          {slide.group ?? <Brand kit={kit} size={64} logo={kit.logoOnBackground ?? kit.logo} fontSize={32} color={kit.nameOnBackground} />}
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
          {slide.page} / {slide.pages}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 28 }}>
        {slide.items.map((it, i) => (
          <Card key={i} item={it} n={n} tone={it.bg ?? cardTone(i % 2 === 0 ? c.card : c.accent, custom, c.background)} showGroup={!slide.group && n <= 2} chip={c.chip} display={DISPLAY} dw={DW} text={it.bg ? textOn(it.bg, c.text) : c.text} outline={!!it.bg && sameColor(it.bg, custom ?? c.background)} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: slide.items.length === 1 && slide.items[0].image ? 104 : 64 }}>
        {kit.swipe ? <Swipe color={kit.onBackground ?? c.text} /> : kit.logo ? <div style={{ display: "flex" }} /> : <Brand kit={kit} size={56} logo={undefined} fontSize={28} />}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Credit kit={kit} size={24} color={fg} />
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
  2: { title: 64, titleLines: 3, meta: 36, blurb: 30, blurbLines: 2, pad: 44, gap: 18 },
  3: { title: 50, titleLines: 2, meta: 30, blurb: 26, blurbLines: 1, pad: 36, gap: 12 },
  4: { title: 42, titleLines: 2, meta: 26, blurb: 22, blurbLines: 1, pad: 28, gap: 8 },
} as const;

const LOGO_H = { 1: 100, 2: 72, 3: 56, 4: 44 } as const;

/** A card the same color as its slide would vanish; swap it for the kit background (or, if that is the slide color, the other card tone). */
const cardTone = (tone: string, bg: string | undefined, fallback: string) => (bg && tone.toLowerCase() === bg.toLowerCase() ? (fallback.toLowerCase() === bg.toLowerCase() ? "#fffaf3" : fallback) : tone);

function Card({ item, n, tone, showGroup, chip, display, dw, text, outline }: { item: SlideItem; n: number; tone: string; showGroup: boolean; chip: string; display: string; dw: number; text: string; outline?: boolean }) {
  const z = SIZES[n as 1 | 2 | 3 | 4];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: tone, color: text, borderRadius: 44, padding: outline ? z.pad - 4 : z.pad, gap: z.gap, justifyContent: "center", overflow: "hidden", ...(outline ? { border: `4px solid ${text}` } : {}) }}>
      {showGroup && item.group && (
        <div style={{ display: "flex", alignSelf: "flex-start", background: chip, borderRadius: 999, padding: "4px 20px", fontSize: z.meta - 8, fontWeight: 700 }}>{item.group}</div>
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
      <div style={{ display: "flex", fontFamily: display, fontWeight: dw, fontSize: z.title, lineHeight: 1.08, ...clamp(z.titleLines) }}>{item.title}</div>
      {(item.when || item.place) && (
        <div style={{ display: "flex", fontSize: z.meta, fontWeight: 700, ...clamp(2) }}>{[item.when, item.place].filter(Boolean).join(" · ")}</div>
      )}
      {z.blurbLines > 0 && item.blurb && <div style={{ display: "flex", fontSize: z.blurb, lineHeight: 1.35, ...clamp(z.blurbLines) }}>{n >= 3 ? shortBlurb(item.blurb) : item.blurb}</div>}
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
