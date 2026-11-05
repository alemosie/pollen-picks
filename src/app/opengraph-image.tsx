import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DEFAULT_COLORS } from "@/lib/brand";
import { loadDemoIssue } from "@/lib/demo";
import { planSlides, stripEmoji } from "@/lib/slides/plan";
import { slideItemsFor } from "@/lib/slides/items";
import { loadFonts, renderSlide } from "@/lib/slides/render";
import type { SlideItem } from "@/lib/slides/types";

// The social preview (Open Graph) image: the lockup, the headline and a frozen frame of the pollen gust from the step loader.
export const alt = "Pollen Picks: let your words travel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const { background, text, accent, card, highlight } = DEFAULT_COLORS;
const COLORS = [accent, "#f28482", "#84a59d", accent, text]; // honey, coral, sage, honey, ink: the loader's palette
const SIZES = [5, 3, 4, 3, 4];

// The same gust path as FlowLoader (viewBox -60 -30 920 230): four cubic segments from left, through a loop, and out to the right.
const SEGS: [number, number][][] = [
  [[-60, 150], [120, 150], [230, 140], [310, 112]],
  [[310, 112], [400, 80], [470, 30], [420, 10]],
  [[420, 10], [360, -12], [290, 40], [330, 90]],
  [[330, 90], [370, 135], [480, 145], [580, 126]],
  [[580, 126], [680, 108], [770, 84], [860, 96]],
];
function at(t: number): [number, number] {
  const f = Math.min(0.9999, t) * SEGS.length;
  const s = SEGS[Math.floor(f)];
  const u = f - Math.floor(f);
  const m = 1 - u;
  const c = [m * m * m, 3 * m * m * u, 3 * m * u * u, u * u * u];
  return [0, 1].map((k) => s.reduce((sum, p, j) => sum + p[k] * c[j], 0)) as [number, number];
}
const COUNT = 60;
const ALL = Array.from({ length: COUNT }, (_, i) => {
  const [x, y] = at(0.02 + (i / COUNT) * 0.96);
  return {
    x: x + ((i * 37) % 12) - 6,
    y: y + ((i * 53) % 14) - 7,
    r: SIZES[i % SIZES.length] * 1.5,
    color: COLORS[i % COLORS.length],
    o: 1,
  };
});
// Only the stretch between the source squares and the slides; the grains fade in and out at each end, like the loader's mask.
const FROM = 110, TO = 560;
const GRAINS = ALL.filter((g) => g.x > FROM && g.x < TO).map((g) => ({ ...g, o: Math.min(1, (g.x - FROM) / 70, (TO - g.x) / 70) }));

/** Satori can't draw emoji without fetching them, so the preview drops them. */
const clean = (i: SlideItem): SlideItem => ({
  ...i,
  title: stripEmoji(i.title),
  group: i.group ? stripEmoji(i.group) : i.group,
  when: i.when ? stripEmoji(i.when) : i.when,
  place: i.place ? stripEmoji(i.place) : i.place,
  blurb: i.blurb ? stripEmoji(i.blurb) : i.blurb,
});

const ICON = { width: 52, height: 52, viewBox: "0 0 24 24", fill: "none", stroke: text, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const SQUARES = [
  { left: 64, top: 345, tilt: -7, bg: highlight },
  { left: 168, top: 440, tilt: 6, bg: card },
];
const CARD_W = 214;
const CARD_H = 268;
const SPOTS = [{ left: 752, top: 330, tilt: -4 }, { left: 955, top: 322, tilt: 5 }];

export default async function Image() {
  const issue = loadDemoIssue();
  const c = issue.chunks.find((x) => /halloween brunch/i.test(x.title));
  const name = stripEmoji(issue.newsletter);
  const slides = planSlides(slideItemsFor(issue.chunks, c ? [c.id] : []).map(clean), { newsletter: name, showTags: false }).slice(0, 2);
  const kit = { name, colors: DEFAULT_COLORS };
  // Render each slide to a PNG at full size first: scaling live slide markup inside another image clips its text.
  const pics = await Promise.all(
    slides.map(async (sl) => `data:image/png;base64,${Buffer.from(await (await renderSlide(sl, kit)).arrayBuffer()).toString("base64")}`),
  );
  const lockup = await readFile(join(process.cwd(), "public/brand/pollen-picks-lockup-light.png"));
  return new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: 1200, height: 630, background, fontFamily: "DM Sans", color: text }}>
        <svg width={1200} height={300} viewBox="-60 -30 920 230" style={{ position: "absolute", left: 0, top: 320 }}>
          {GRAINS.map((g, i) => (
            <circle key={i} cx={g.x} cy={g.y} r={g.r} fill={g.color} opacity={g.o} />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 72, top: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={`data:image/png;base64,${lockup.toString("base64")}`} width={150} height={69} />
          <div style={{ display: "flex", marginTop: 14, fontFamily: "Madimi One", fontSize: 76, lineHeight: 1.05, whiteSpace: "nowrap" }}>Let your words travel.</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 28, fontWeight: 500 }}>Any newsletter or blog, turned into carousel posts via Buffer.</div>
        </div>
        {SQUARES.map((q, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", left: q.left, top: q.top, width: 96, height: 96, borderRadius: 20, background: q.bg, boxShadow: "0 8px 20px rgba(43,58,54,0.18)", transform: `rotate(${q.tilt}deg)` }}>
            {i === 0 ? (
              <svg {...ICON}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
            ) : (
              <svg {...ICON}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            )}
          </div>
        ))}
        {pics.map((src, i) => (
          <div key={i} style={{ display: "flex", position: "absolute", left: SPOTS[i].left, top: SPOTS[i].top, width: CARD_W, height: CARD_H, borderRadius: 18, boxShadow: "0 12px 28px rgba(43,58,54,0.26)", transform: `rotate(${SPOTS[i].tilt}deg)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={src} width={CARD_W} height={CARD_H} style={{ borderRadius: 18 }} />
          </div>
        ))}
      </div>
    ),
    { ...size, fonts: await loadFonts() },
  );
}
