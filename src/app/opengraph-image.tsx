import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DEFAULT_COLORS } from "@/lib/brand";
import { loadDemoIssue } from "@/lib/demo";
import { planSlides, stripEmoji } from "@/lib/slides/plan";
import { slideItemsFor } from "@/lib/slides/items";
import { loadFonts, renderSlide } from "@/lib/slides/render";
import type { Slide, SlideItem } from "@/lib/slides/types";

// The social preview (Open Graph) image. Platforms crop this 1.91:1 image differently (LinkedIn and Slack show ~3:2,
// some feeds go square), so everything sits in one centered column inside the middle 600px (x 300-900) with nothing bleeding off the edges.
export const alt = "Pollen Picks: let your words travel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const { background, text, accent, highlight } = DEFAULT_COLORS;

/** Satori can't draw emoji without fetching them, so the preview drops them. */
const clean = (i: SlideItem): SlideItem => ({
  ...i,
  title: stripEmoji(i.title),
  group: i.group ? stripEmoji(i.group) : i.group,
  when: i.when ? stripEmoji(i.when) : i.when,
  place: i.place ? stripEmoji(i.place) : i.place,
  blurb: i.blurb ? stripEmoji(i.blurb) : i.blurb,
});

const lockupSrc = async () => `data:image/png;base64,${(await readFile(join(process.cwd(), "public/brand/pollen-picks-lockup-light.png"))).toString("base64")}`;

/** The landing page's coral squiggle under "travel" (same path as the hero in page.tsx), drawn in pixels because Satori has no non-scaling strokes. */
function Squiggle({ fs }: { fs: number }) {
  const w = Math.round((196.5 * fs) / 76); // width of "travel" in Madimi One at this size
  const sx = w / 220;
  const sy = (fs / 72) * (16 / 24); // the hero's squiggle is 16px tall under a 72px headline
  const pt = (x: number, y: number) => `${(x * sx).toFixed(1)} ${(y * sy + 4).toFixed(1)}`;
  const d = `M${pt(3, 14)} C${pt(40, 3)} ${pt(70, 22)} ${pt(110, 12)} S${pt(180, 4)} ${pt(217, 13)}`;
  return (
    <svg width={w} height={Math.round(24 * sy + 8)} viewBox={`0 0 ${w} ${Math.round(24 * sy + 8)}`} style={{ position: "absolute", left: 0, bottom: -Math.round(0.167 * fs) - 4 }}>
      <path d={d} fill="none" stroke={highlight} strokeWidth={(6 * fs) / 72} strokeLinecap="round" />
    </svg>
  );
}

function Words({ top, big }: { top: number; big: boolean }) {
  const fs = big ? 88 : 76;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", left: 300, top, width: 600, textAlign: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "Madimi One", fontSize: fs, lineHeight: 1.04 }}>
        <div style={{ display: "flex" }}>Let your words</div>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", position: "relative" }}>
            travel
            <Squiggle fs={fs} />
          </div>
          .
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 30, fontSize: big ? 30 : 27, fontWeight: 500, lineHeight: 1.3 }}>
        <div style={{ display: "flex" }}>Any newsletter or blog, turned into</div>
        <div style={{ display: "flex" }}>carousel posts via Buffer.</div>
      </div>
    </div>
  );
}

const ICON = { width: 44, height: 44, viewBox: "0 0 24 24", fill: "none", stroke: text, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const SLIDE_W = 140;
const SLIDE_H = 175;

export default async function Image() {
  const issue = loadDemoIssue();
  const c = issue.chunks.find((x) => /halloween brunch/i.test(x.title));
  const name = stripEmoji(issue.newsletter);
  // The two slides in the app's picture format: the cover with its picture as the whole background, the pick with a picture banner on its card (a paper-pumpkin photo to match the Halloween brunch).
  const pond = `data:image/jpeg;base64,${(await readFile(join(process.cwd(), "src/assets/brand/events/2-walk.jpg"))).toString("base64")}`;
  const pumpkins = `data:image/jpeg;base64,${(await readFile(join(process.cwd(), "src/assets/og/halloween-pumpkins.jpg"))).toString("base64")}`;
  const [cover, picks] = planSlides(slideItemsFor(issue.chunks, c ? [c.id] : []).map(clean), { newsletter: name, showTags: false });
  const slides: Slide[] = [
    { ...cover, photo: pond, photoMode: "background" } as Slide,
    picks.kind === "picks" ? { ...picks, items: picks.items.map((it) => ({ ...it, bg: accent, photo: pumpkins })) } : picks,
  ];
  const kit = { name, colors: DEFAULT_COLORS };
  // Render each slide to a PNG at full size first: scaling live slide markup inside another image clips its text.
  const pics = await Promise.all(
    slides.map(async (sl) => `data:image/png;base64,${Buffer.from(await (await renderSlide(sl, kit)).arrayBuffer()).toString("base64")}`),
  );
  const lockup = await lockupSrc();
  return new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: 1200, height: 630, background, fontFamily: "DM Sans", color: text }}>
        <div style={{ display: "flex", justifyContent: "center", position: "absolute", left: 300, top: 40, width: 600 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={lockup} width={120} height={55} />
        </div>
        <Words top={112} big={false} />
        {/* One tidy row: a source, a short run of pollen, the finished slides. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", left: 300, top: 418, width: 600, height: SLIDE_H }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 88, height: 88, borderRadius: 22, background: highlight }}>
            <svg {...ICON}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
          </div>
          <div style={{ display: "flex", alignItems: "center", margin: "0 26px" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: "flex", width: 10, height: 10, borderRadius: 5, background: accent, marginLeft: i ? 14 : 0 }} />
            ))}
          </div>
          {pics.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img key={i} src={src} width={SLIDE_W} height={SLIDE_H} style={{ borderRadius: 14, marginLeft: i ? 18 : 0, boxShadow: "0 8px 20px rgba(43,58,54,0.16)" }} />
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: await loadFonts() },
  );
}
