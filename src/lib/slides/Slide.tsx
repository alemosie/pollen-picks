import type { CSSProperties, ReactElement } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { MARK_SVG } from "./mark";
import { SLIDE_H, SLIDE_W, type Kit, type Slide, type SlideItem } from "./types";

// Satori (next/og) renders this: flexbox only, inline styles, no Tailwind.
const DISPLAY = "Madimi One";
const BODY = "DM Sans";
const clamp = (n: number) => ({ lineClamp: n }) as CSSProperties;
const P = 72;

function Credit({ kit, size = 26 }: { kit: Kit; size?: number }) {
  if (kit.attribution === false) return null;
  const color = kit.colors.text;
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

export function SlideView({ slide, kit }: { slide: Slide; kit: Kit }): ReactElement {
  const c = kit.colors;
  const base: CSSProperties = { width: SLIDE_W, height: SLIDE_H, display: "flex", flexDirection: "column", fontFamily: BODY, color: c.text };
  if (slide.kind === "cover") {
    return (
      <div style={{ ...base, background: c.accent, padding: P, justifyContent: "space-between", position: "relative" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>{kit.name}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 168, lineHeight: 1, ...clamp(4) }}>{slide.title}</div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 500 }}>{slide.subtitle}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700 }}>
            Swipe
            <svg width="56" height="28" viewBox="0 0 56 28">
              <path d="M3 14h48M38 3l13 11-13 11" stroke={c.text} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <Dots c={c} />
        </div>
        <Credit kit={kit} />
        </div>
      </div>
    );
  }
  if (slide.kind === "closing") {
    return (
      <div style={{ ...base, background: c.card, padding: P, justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>{kit.name}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {slide.more > 0 && (
            <div style={{ display: "flex", alignSelf: "flex-start", background: c.accent, borderRadius: 999, padding: "10px 28px", fontSize: 40, fontWeight: 700 }}>
              +{slide.more} more
            </div>
          )}
          <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 132, lineHeight: 1.02, ...clamp(3) }}>{slide.title}</div>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 500, ...clamp(3) }}>{slide.line}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, background: c.text, color: c.background, borderRadius: 999, padding: "16px 36px" }}>
            Subscribe · link in bio
          </div>
          <div style={{ display: "flex", width: 56, height: 56, borderRadius: 999, background: c.highlight }} />
        </div>
        <Credit kit={kit} />
        </div>
      </div>
    );
  }
  const n = slide.items.length;
  return (
    <div style={{ ...base, background: c.background, padding: P, gap: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", background: slide.group ? c.chip : "transparent", borderRadius: 999, padding: slide.group ? "8px 26px" : 0, fontSize: 32, fontWeight: 700 }}>
          {slide.group ?? kit.name}
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
          {slide.page} / {slide.pages}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 28 }}>
        {slide.items.map((it, i) => (
          <Card key={i} item={it} n={n} tone={i % 2 === 0 ? c.card : c.accent} showGroup={!slide.group} chip={c.chip} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 64 }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>{kit.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Credit kit={kit} size={24} />
          <div style={{ display: "flex", width: 36, height: 36, borderRadius: 999, background: c.highlight }} />
        </div>
      </div>
    </div>
  );
}

const SIZES = {
  1: { title: 92, titleLines: 4, meta: 44, blurb: 36, blurbLines: 6, pad: 56, gap: 28 },
  2: { title: 64, titleLines: 3, meta: 36, blurb: 30, blurbLines: 2, pad: 44, gap: 18 },
  3: { title: 50, titleLines: 2, meta: 30, blurb: 0, blurbLines: 0, pad: 36, gap: 12 },
} as const;

function Card({ item, n, tone, showGroup, chip }: { item: SlideItem; n: number; tone: string; showGroup: boolean; chip: string }) {
  const z = SIZES[n as 1 | 2 | 3];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: tone, borderRadius: 44, padding: z.pad, gap: z.gap, justifyContent: "center", overflow: "hidden" }}>
      {showGroup && item.group && (
        <div style={{ display: "flex", alignSelf: "flex-start", background: chip, borderRadius: 999, padding: "4px 20px", fontSize: z.meta - 8, fontWeight: 700 }}>{item.group}</div>
      )}
      <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: z.title, lineHeight: 1.08, ...clamp(z.titleLines) }}>{item.title}</div>
      {item.when && <div style={{ display: "flex", fontSize: z.meta, fontWeight: 700, ...clamp(2) }}>{item.when}</div>}
      {item.place && <div style={{ display: "flex", fontSize: z.meta - 4, fontWeight: 500, ...clamp(1) }}>{item.place}</div>}
      {z.blurbLines > 0 && item.blurb && <div style={{ display: "flex", fontSize: z.blurb, lineHeight: 1.35, ...clamp(z.blurbLines) }}>{item.blurb}</div>}
    </div>
  );
}

function Dots({ c }: { c: Kit["colors"] }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {[c.card, c.background, c.chip, c.highlight].map((col, i) => (
        <div key={i} style={{ display: "flex", width: 52, height: 52, borderRadius: 999, background: col }} />
      ))}
    </div>
  );
}
