"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AtSign, Lightbulb, MousePointerClick, Pencil, Repeat, Trophy } from "lucide-react";
import { Reveal } from "@/components/path/PollenPath";

type IconKey = "pencil" | "click" | "trophy" | "at" | "bulb";

type Stage = {
  /** Top-left corner of the box on the 1932-unit canvas. */
  x: number;
  y: number;
  fill: string;
  title: string;
  lines: [string, string];
  icon: IconKey;
  /** How many degrees of the ring the box covers on each side of its centre, so the arrow's hit lands at the box edge. */
  m: number;
};

/** The five stages, clockwise from the top. */
const STAGES: Stage[] = [
  { x: 683, y: 223, fill: "#fffaf3", title: "Your newsletter", lines: ["Content your community", "values"], icon: "pencil", m: 24 },
  { x: 1327, y: 690, fill: "#f5cac3", title: "Readers click", lines: ["They show you", "what they loved"], icon: "click", m: 10.3 },
  { x: 1082, y: 1446, fill: "#fadf9f", title: "You post the top", lines: ["Their clicks become", "your carousel"], icon: "trophy", m: 16.5 },
  { x: 286, y: 1446, fill: "#f9c0bf", title: "Tag them in", lines: ["Auto-tag organizers", "to spread the word further"], icon: "at", m: 16.5 },
  { x: 40, y: 690, fill: "#c5d9d5", title: "New people find you", lines: ["They discover your", "community and subscribe"], icon: "bulb", m: 10.3 },
];

const W = 565;
const H = 230;
const CX = 965;
const CY = 1010;
const R = 675;
const INK = "#2b3a36";
const GRAINS = ["#f6bd60", "#f6bd60", "#f28482", "#f5cac3", "#84a59d"];
/** One lap of the arrow, in milliseconds, and how many laps play before it rests. */
const LAP_MS = 8000;
const LAPS = 2;

/** Lucide paths (24 x 24) for the small icons that drift out of a box when the arrow reaches it. */
const ICON_PATHS: Record<IconKey, string> = {
  pencil:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  click:
    '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>',
  trophy:
    '<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
};

const LIST_ICONS = { pencil: Pencil, click: MousePointerClick, trophy: Trophy, at: AtSign, bulb: Lightbulb } as const;

const BRANCHES = [
  "M958 885 C 890 880 855 820 848 768",
  "M958 885 C 940 840 925 800 922 762",
  "M958 885 C 975 830 980 770 977 724",
  "M958 885 C 995 850 1030 810 1040 777",
  "M960 888 C 1020 895 1070 860 1086 820",
  "M958 885 C 930 960 895 990 898 1050 C 899 1090 900 1110 902 1128",
];
const DOTS: [number, number, number, string][] = [
  [843, 752, 21, "#f6bd60"],
  [920, 748, 21, "#f6bd60"],
  [977, 706, 20, "#f28482"],
  [1042, 762, 21, "#f6bd60"],
  [1090, 803, 21, "#f6bd60"],
];

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(name: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
  const e = document.createElementNS(SVG_NS, name);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e as SVGElement;
}

function ringPoint(deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: CX + R * Math.sin(a), y: CY - R * Math.cos(a) };
}

/** The stage that the arrow reaches after each fifth of the ring, and the angle at which it touches that box's edge. */
const HITS = STAGES.map((_, i) => ({ n: (i + 1) % 5, at: 72 * (i + 1) - STAGES[(i + 1) % 5].m }));

/**
 * How Pollen Picks grows your audience: a loop from your newsletter to your readers' clicks, to the posts, to the people you tag,
 * and back. On wide screens it is a diagram with an arrow that sweeps round once it scrolls into view (two laps, then it rests);
 * on phones the same five stops are a short list, because the diagram's text would be too small to read there.
 */
export function GrowthCycle() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGGElement>(null);
  const fxRef = useRef<SVGGElement>(null);
  const nodeRefs = useRef<(SVGGElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const run = useRef(0);

  const place = useCallback((deg: number) => {
    const p = ringPoint(deg);
    arrowRef.current?.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${deg.toFixed(2)})`);
  }, []);

  const burst = useCallback((s: Stage) => {
    const fx = fxRef.current;
    if (!fx) return;
    const cx = s.x + W / 2;
    const cy = s.y + H / 2;
    for (let i = 0; i < 12; i++) {
      const r = 5 + Math.random() * 4;
      const phi = Math.random() * Math.PI * 2;
      const sx = cx + Math.cos(phi) * W * 0.475;
      const sy = cy + Math.sin(phi) * H * 0.475;
      const dist = 45 + Math.random() * 85;
      const tx = sx + Math.cos(phi) * dist;
      const ty = sy + Math.sin(phi) * dist;
      const c = svgEl("circle", { r, fill: GRAINS[Math.floor(Math.random() * GRAINS.length)], opacity: 0 }, fx);
      c.animate(
        [
          { transform: `translate(${sx}px,${sy}px) scale(0.4)`, opacity: 0.9 },
          { transform: `translate(${tx}px,${ty}px) scale(1)`, opacity: 0.9, offset: 0.35 },
          { transform: `translate(${tx + (Math.random() - 0.5) * 50}px,${ty - 25 - Math.random() * 40}px) scale(0.6)`, opacity: 0 },
        ],
        { duration: 1500 + Math.random() * 1000, delay: Math.random() * 140, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" },
      ).onfinish = () => c.remove();
    }
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < 4; i++) {
      const ph = base + i * (Math.PI / 2) + (Math.random() - 0.5) * 0.5;
      const ex = cx + Math.cos(ph) * W * 0.45;
      const ey = cy + Math.sin(ph) * H * 0.45;
      const d2 = 70 + Math.random() * 60;
      const ix = ex + Math.cos(ph) * d2;
      const iy = ey + Math.sin(ph) * d2 - 25;
      const k = (42 + Math.random() * 14) / 24;
      const rot = (Math.random() - 0.5) * 40;
      const outer = svgEl("g", { opacity: 0 }, fx);
      const inner = svgEl(
        "g",
        { transform: "translate(-12 -12)", fill: "none", stroke: INK, "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round" },
        outer,
      );
      inner.innerHTML = ICON_PATHS[s.icon];
      outer.animate(
        [
          { transform: `translate(${ex}px,${ey}px) rotate(${rot - 15}deg) scale(${k * 0.4})`, opacity: 0 },
          { transform: `translate(${ix}px,${iy}px) rotate(${rot}deg) scale(${k})`, opacity: 0.85, offset: 0.4 },
          { transform: `translate(${ix}px,${iy - 30}px) rotate(${rot + 12}deg) scale(${k * 0.9})`, opacity: 0 },
        ],
        { duration: 1900, delay: i * 90, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" },
      ).onfinish = () => outer.remove();
    }
  }, []);

  const stop = useCallback(() => {
    run.current++;
  }, []);

  const play = useCallback(async () => {
    const id = ++run.current;
    const fx = fxRef.current;
    const arrow = arrowRef.current;
    if (!fx || !arrow) return;
    fx.replaceChildren();
    arrow.setAttribute("opacity", "0");
    place(0);
    await new Promise((r) => setTimeout(r, 300));
    if (id !== run.current) return;
    arrow.setAttribute("opacity", "1");
    for (let lap = 0; lap < LAPS; lap++) {
      const fired = [false, false, false, false, false];
      const ok = await new Promise<boolean>((resolve) => {
        const t0 = performance.now();
        const frame = (now: number) => {
          if (id !== run.current) return resolve(false);
          const p = Math.min(1, (now - t0) / LAP_MS);
          const deg = 360 * p;
          place(deg);
          HITS.forEach((h, i) => {
            if (fired[i] || deg < h.at) return;
            fired[i] = true;
            nodeRefs.current[h.n]?.animate(
              [{ transform: "scale(1)" }, { transform: "scale(1.05)", offset: 0.35 }, { transform: "scale(1)" }],
              { duration: 560, easing: "ease-out" },
            );
            burst(STAGES[h.n]);
            if (h.n === 0) {
              dotRefs.current.forEach((c, j) =>
                c?.animate(
                  [
                    { transform: "scale(1) translateY(0)" },
                    { transform: "scale(1.55) translateY(-7px)", offset: 0.5 },
                    { transform: "scale(1) translateY(0)" },
                  ],
                  { duration: 650, delay: j * 90, iterations: 2, easing: "ease-in-out" },
                ),
              );
            }
          });
          if (p < 1) requestAnimationFrame(frame);
          else resolve(true);
        };
        requestAnimationFrame(frame);
      });
      if (!ok) return;
    }
    // Rest on the still picture.
    arrow.setAttribute("opacity", "0");
  }, [burst, place]);

  // Start when the diagram is mostly in view; never when motion is reduced or the diagram is hidden (phones).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let io: IntersectionObserver | undefined;
    if (!reduced) {
      io = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting || wrap.offsetParent === null) return;
          io?.disconnect();
          void play();
        },
        { threshold: 0.5 },
      );
      io.observe(wrap);
    }
    return () => {
      io?.disconnect();
      stop();
    };
  }, [play, stop]);

  return (
    <section id="how-it-grows" aria-labelledby="how-it-grows-title" className="mx-auto max-w-6xl px-6 pb-4 pt-12 sm:pb-8 sm:pt-12">
      <Reveal>
        <h2 id="how-it-grows-title" className="mb-4 text-center text-3xl leading-tight sm:text-5xl">
          How it helps <span className="pp-squig">everyone</span> grow
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-balance text-center text-lg leading-relaxed lg:mb-0">
          This is community-driven content creation. Your readers&rsquo; clicks help you choose what to post, and tagging the people behind it brings new readers back to you.{" "}
          <b>No AI needed &mdash; just your words powering organic growth.</b>
        </p>
      </Reveal>

      {/* Wide screens: the diagram. */}
      <Reveal>
        <div ref={wrapRef} className="mx-auto hidden w-full max-w-[36rem] lg:block">
          <svg
            viewBox="0 150 1932 1640"
            role="img"
            aria-label="Pollen Picks cycle: your newsletter, readers click, you post the top, tag them in, new people find you, and back to your newsletter."
            className="block aspect-[1932/1640] h-auto w-full overflow-visible"
          >
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f6bd60" strokeWidth={20} strokeLinecap="round" strokeDasharray="0 40" />
            <g ref={arrowRef} opacity={0}>
              <path d="M46 0 L-30 -42 L-30 42 Z" fill="#f28482" stroke="#f28482" strokeWidth={16} strokeLinejoin="round" />
            </g>
            {STAGES.map((s, i) => {
              const cx = s.x + W / 2;
              return (
                <g
                  key={s.title}
                  ref={(g) => {
                    nodeRefs.current[i] = g;
                  }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                >
                  <rect x={s.x} y={s.y} width={W} height={H} rx={72} fill={s.fill} stroke={INK} strokeWidth={7} />
                  <text x={cx} y={s.y + 93} textAnchor="middle" fontSize={52} fill={INK} className="font-display">
                    {s.title}
                  </text>
                  {s.lines.map((ln, j) => (
                    <text key={ln} x={cx} y={s.y + 151 + j * 46} textAnchor="middle" fontSize={38} fill="#4a5b57">
                      {ln}
                    </text>
                  ))}
                  <circle cx={s.x + 33} cy={s.y + 17} r={43} fill={INK} />
                  <text x={s.x + 33} y={s.y + 34} textAnchor="middle" fontSize={46} fill="#f7ede2" className="font-display">
                    {i + 1}
                  </text>
                </g>
              );
            })}
            <g aria-hidden>
              {BRANCHES.map((d) => (
                <path key={d} d={d} fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
              ))}
              {DOTS.map(([x, y, r, fill], i) => (
                <circle
                  key={i}
                  ref={(c) => {
                    dotRefs.current[i] = c;
                  }}
                  cx={x}
                  cy={y}
                  r={r}
                  fill={fill}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              ))}
            </g>
            <text x={CX} y={1243} textAnchor="middle" fontSize={112} fill={INK} className="font-display">
              Pollen Picks
            </text>
            <text x={CX} y={1302} textAnchor="middle" fontSize={46} fill="#4a5b57">
              Organic growth,
            </text>
            <text x={CX} y={1357} textAnchor="middle" fontSize={46} fill="#4a5b57">
              guided by your community
            </text>
            <g ref={fxRef} aria-hidden />
          </svg>
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => void play()}
              className="rounded-full px-4 py-1.5 text-sm font-semibold underline decoration-[3px] decoration-transparent underline-offset-[6px] transition hover:decoration-coral"
            >
              Replay
            </button>
          </div>
        </div>
      </Reveal>

      {/* Phones and tablets: the same five stops as a list, since the diagram's text would be too small. */}
      <GrowthList />
    </section>
  );
}

/**
 * The phone and tablet version: five cards, two thirds wide, stepping right, left, right, left, right, joined by a curvy dotted
 * coral line that runs behind them and ends at the "back to your newsletter" mark. No motion: the line is the point. It is measured
 * from the real card positions, so it follows whatever height the text wraps to.
 */
function GrowthList() {
  const olRef = useRef<HTMLOListElement>(null);
  const [line, setLine] = useState<{ w: number; h: number; d: string } | null>(null);

  const measure = useCallback(() => {
    const ol = olRef.current;
    if (!ol || ol.offsetParent === null) return;
    const w = ol.clientWidth;
    const h = ol.offsetHeight;
    const cards = Array.from(ol.querySelectorAll<HTMLElement>(":scope > li")).slice(0, STAGES.length);
    const endEl = ol.querySelector<HTMLElement>("[data-end]");
    if (!w || !endEl || cards.length < 2) return;
    // Cards are two thirds wide, so their centres sit a third and two thirds across.
    const cx = (i: number) => (i % 2 === 0 ? (2 * w) / 3 : w / 3);
    const top = (i: number) => cards[i].offsetTop;
    const bot = (i: number) => cards[i].offsetTop + cards[i].offsetHeight;
    const pull = Math.max(24, (top(1) - bot(0)) * 0.8);
    const or = ol.getBoundingClientRect();
    const er = endEl.getBoundingClientRect();
    const ex = er.left + er.width / 2 - or.left;
    const ey = er.top + er.height / 2 - or.top;
    let d = "";
    for (let i = 0; i < cards.length; i++) {
      const [x2, y2] = i === cards.length - 1 ? [ex, ey] : [cx(i + 1), top(i + 1)];
      d += `M${cx(i)} ${bot(i)} C${cx(i)} ${bot(i) + pull} ${x2} ${y2 - pull} ${x2} ${y2} `;
    }
    setLine({ w, h, d });
  }, []);

  // Measure once the list is shown (it is hidden on wide screens) and again whenever its size changes.
  useEffect(() => {
    const ol = olRef.current;
    if (!ol) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(ol);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <ol ref={olRef} className="relative mx-auto grid max-w-md list-none gap-12 p-0 lg:hidden">
      {line && (
        <svg aria-hidden width={line.w} height={line.h} className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible">
          <path d={line.d} fill="none" stroke="#f28482" strokeWidth={4} strokeLinecap="round" strokeDasharray="0 10" />
        </svg>
      )}
      {STAGES.map((s, i) => {
        const Icon = LIST_ICONS[s.icon];
        return (
          <li key={s.title} className="relative z-10 m-0">
            <Reveal delay={0.05 * i}>
              <div
                className={`relative w-2/3 rounded-3xl border-[3px] border-ink px-4 py-3 ${i % 2 === 0 ? "ml-auto" : "mr-auto"}`}
                style={{ background: s.fill }}
              >
                <span className="absolute -right-3 -top-3 flex size-9 items-center justify-center rounded-full bg-ink font-display text-lg text-cream">{i + 1}</span>
                <span className="block font-display text-lg leading-tight">
                  <Icon aria-hidden className="mr-1.5 inline size-5 align-[-3px]" />
                  {s.title}
                </span>
                <span className="mt-1 block text-base leading-snug">{s.lines.join(" ")}</span>
              </div>
            </Reveal>
          </li>
        );
      })}
      <li className="relative z-10 m-0 flex items-center justify-center gap-2 text-base font-semibold">
        <span data-end className="flex size-9 items-center justify-center rounded-full bg-[#f9d3cf]">
          <Repeat aria-hidden className="size-5" />
        </span>
        And back to your newsletter
      </li>
    </ol>
  );
}
