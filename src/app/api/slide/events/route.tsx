import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { KitColors } from "@/lib/brand";
import { planSlides } from "@/lib/slides/plan";
import { renderSlide } from "@/lib/slides/render";
import type { Kit, Slide, SlideItem } from "@/lib/slides/types";

// Amsterdam Parent Project site palette (css/tailwind.css) and logo (public/static/images/logo/light.png).
const APP_COLORS: KitColors = {
  background: "#263d34", // dark green (from the brand palette)
  text: "#303633", // charcoal
  accent: "#e1ad37", // goldenrod
  card: "#f0dfd0", // dark-white
  chip: "#3f6455", // soft-green
  highlight: "#1a3e31", // green
};
const logo = (f: string) => `data:image/png;base64,${readFileSync(join(process.cwd(), "src", "assets", "brand", f)).toString("base64")}`;
const KIT: Kit = {
  name: "Amsterdam Parent Project",
  colors: APP_COLORS,
  attribution: false,
  logo: logo("app-logo.png"),
  logoOnAccent: logo("app-logo-on-gold.png"),
  logoOnBackground: logo("app-logo-dark.png"), // cream strokes, for the dark green background
  onBackground: "#f7eee6", // brand-white
  nameOnBackground: "#e1ad37", // goldenrod
  swipe: true,
  fonts: { display: "Quicksand", body: "Quicksand" }, // the site's font
  nameLines: ["Amsterdam", "Parent Project"],
  coverTitleSize: 136,
};

const FYP = { logo: logo("fyp-logo.png"), logoAspect: 680 / 221 }; // First Year Program logo (site: public/email-images/fyp-logo.png)

// Luma event cover images, shown on the title slide in file-name order (src/assets/brand/events/*.jpg|png). Optional.
const eventsDir = join(process.cwd(), "src", "assets", "brand", "events");
const eventImage = (f: string) => `data:image/${f.endsWith("png") ? "png" : "jpeg"};base64,${readFileSync(join(eventsDir, f)).toString("base64")}`;
const COVER_IMAGES = existsSync(eventsDir) ? readdirSync(eventsDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort().map(eventImage) : [];
const IMG = (f: string) => (existsSync(join(eventsDir, f)) ? eventImage(f) : undefined);

const MAMASOCIAL = { partnerLogo: logo("mamasocial-logo.png"), partnerAspect: 732 / 65 };

// One-off: events carousel for the Amsterdam Parent Project Luma calendar (attribution off), one event per slide.
const EVENTS: SlideItem[] = [
  { title: "Community Call", ...FYP, image: IMG("1-fyp.jpg"), when: "Fri 6 Nov · 10:00", place: "Online · €5", blurb: "Our monthly call for families with babies under 1. This month: Postpartum transformation — the physical and emotional changes that occur within new parents' bodies and minds." },
  { title: "Rembrandtpark Walk", image: IMG("2-walk.jpg"), when: "Fri 13 Nov · 10:30", place: "Patio, Orteliuskade 5", blurb: "An autumn-leaves walk with the Spring/Summer 2026 group. Babies, dogs and solo parents welcome." },
  { title: "Postpartum Transformation", ...FYP, image: IMG("1-fyp.jpg"), when: "Sat 14 Nov · 10:00", place: "Online · €25", blurb: "An expert discussion with a postpartum doula and therapist about the physical and emotional transformation in both parents after birth: bounce-back culture, how your body changes to adapt to the new demands of parenthood, and where the line is between feeling \u201cnormal\u201d and \u201cnot normal.\u201d" },
  { title: "Autumn/Winter 2026-2027 Hang", image: IMG("3-hang.jpg"), when: "Sun 15 Nov · 10:30", place: "OBA Oosterdok library · Free", blurb: "Our regular meetup for families due this current Autumn/Winter. Come meet the first newborns of the group!" },
  { title: "Birth Stories", ...FYP, ...MAMASOCIAL, image: IMG("4-birth.jpg"), when: "Sat 28 Nov · 11:00", place: "Westerpark · €15", blurb: "A therapist-led gathering for new moms and dads in Amsterdam to talk about their birth experiences. Whether your story was joyful, overwhelming, complicated (or all of the above) we'll provide the space for all of us to discuss our pregnancy, birth, and new parenthood journeys together. In collaboration with MamaSocial." },
];

export async function GET(req: NextRequest) {
  const planned = planSlides(EVENTS, { newsletter: "Amsterdam Parent Project", heading: "What's on in November" });
  const cover = planned[0];
  if (cover.kind === "cover") { cover.subtitle = "5 events for new and expecting parents, hosted by Amsterdam Parent Project"; if (COVER_IMAGES.length) cover.images = COVER_IMAGES; }
  const last = planned[planned.length - 1];
  if (last.kind === "closing") { last.title = "Join us"; last.line = "Register on Luma:"; last.link = "luma.com/amsterdamparentproject"; last.more = 0; last.cta = "Register · Link in bio"; last.dark = true; if (COVER_IMAGES.length) last.images = COVER_IMAGES; }
  const picks: Slide[] = EVENTS.map((it, i) => ({ kind: "picks", items: [it], page: i + 1, pages: EVENTS.length }));
  const slides: Slide[] = [cover, ...picks, last];
  const n = Number(req.nextUrl.searchParams.get("n") ?? 0);
  if (!(n >= 0 && n < slides.length)) return NextResponse.json({ count: slides.length }, { status: 400 });
  return renderSlide(slides[n], KIT);
}
