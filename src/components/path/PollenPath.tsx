"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** A very slight wave: ~3px either way, one swing every ~140px. Drawn in real pixels, from y=18 (the first dot) down to h. */
function wavePath(h: number) {
  const n = Math.max(1, Math.round((h - 18) / 140));
  const step = (h - 18) / n;
  let d = `M12 18 Q 18 ${18 + step / 2} 12 ${18 + step}`;
  for (let i = 2; i <= n; i++) d += ` T 12 ${18 + step * i}`;
  return d;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The branch: a rail down the left edge that grows as you scroll. Stops hang off it on twigs. */
export function PathRail({ children, className = "" }: { children: ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const grown = useRef<SVGPathElement>(null);
  const base = useRef<SVGPathElement>(null);
  const svgs = useRef<(SVGSVGElement | null)[]>([]);
  const dot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastH = 0;
    let first = true;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const update = () => {
      raf = 0;
      const el = wrap.current;
      const g = grown.current;
      const b = base.current;
      if (!el || !g || !b) return;
      // The branch ends at the last stop's dot.
      const stops = el.querySelectorAll<HTMLElement>("[data-stop]");
      const last = stops[stops.length - 1];
      const h = Math.round(last ? last.offsetTop + 18 : el.offsetHeight);
      if (h !== lastH) {
        lastH = h;
        // Drawn in real pixels (no stretching), so the line stays thin and even and a dash can grow it with a round tip.
        const d = wavePath(h);
        svgs.current.forEach((svg) => svg?.setAttribute("viewBox", `0 0 24 ${h}`));
        svgs.current.forEach((svg) => svg && (svg.style.height = `${h}px`));
        g.setAttribute("d", d);
        b.setAttribute("d", d);
        // Sit each stop's dot on the wave.
        const total = b.getTotalLength();
        stops.forEach((st) => {
          const y = st.offsetTop + 18;
          let lo = 0;
          let hi = total;
          for (let i = 0; i < 18; i++) {
            const mid = (lo + hi) / 2;
            if (b.getPointAtLength(mid).y < y) lo = mid;
            else hi = mid;
          }
          const node = st.querySelector<HTMLElement>(".pp-node");
          if (node) node.style.marginLeft = `${b.getPointAtLength(hi).x - 12}px`;
        });
      }
      const r = el.getBoundingClientRect();
      const line = window.innerHeight * 0.6;
      const p = Math.min(1, Math.max(0, (line - r.top) / h));
      g.style.strokeDashoffset = String(1 - p);

      // A dot rides the tip of the growing line.
      const tip = g.getPointAtLength(g.getTotalLength() * p);
      const d = dot.current;
      if (d) {
        d.style.opacity = p > 0 && p < 1 ? "1" : p >= 1 ? "1" : "0";
        d.style.transform = `translate(${tip.x - 12}px, ${tip.y}px)`;
      }
      // Stops light up (gold, with a little wiggle) as the dot reaches them; scrolling back un-lights them.
      stops.forEach((st) => {
        const reachedNow = calm || tip.y >= st.offsetTop + 18 - 1;
        const was = st.dataset.reached === "true";
        if (reachedNow === was) return;
        st.dataset.reached = String(reachedNow);
        const node = st.querySelector<HTMLElement>(".pp-node");
        if (reachedNow && node && !first && !calm) {
          node.classList.remove("pp-wiggle");
          void node.offsetWidth;
          node.classList.add("pp-wiggle");
        }
      });
      first = false;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const D = wavePath(1000);
  return (
    <div ref={wrap} className={`relative ${className}`}>
      {[0, 1].map((i) => (
        <svg
          key={i}
          ref={(el) => {
            svgs.current[i] = el;
          }}
          aria-hidden
          viewBox="0 0 24 1000"
          className="pointer-events-none absolute top-0 left-[10px] w-6 -translate-x-1/2"
          style={{ height: "100%" }}
        >
          {i === 0 ? (
            <path ref={base} d={D} fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-[#dcd3c6]" />
          ) : (
            <path ref={grown} d={D} fill="none" strokeWidth="2.5" strokeLinecap="round" pathLength={1} strokeDasharray="1 2" strokeDashoffset={1} className="stroke-ink" />
          )}
        </svg>
      ))}
      <span
        ref={dot}
        aria-hidden
        className="pointer-events-none absolute left-[10px] top-0 z-20 -ml-[7px] -mt-[7px] size-3.5 rounded-full bg-coral opacity-0"
      />
      {children}
    </div>
  );
}

type State = "init" | "hidden" | "shown";

/** Fades its children up once they scroll into view (content already in view never flickers). */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("init");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting || reduced()) {
          setState("shown");
          io.disconnect();
        } else {
          setState((s) => (s === "init" ? "hidden" : s));
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp = Tag as "div";
  return (
    <Comp ref={ref} data-state={state} className={`pp-reveal ${className}`} style={{ "--d": `${delay}s` } as CSSProperties}>
      {children}
    </Comp>
  );
}

/** One stop on the branch: a dot on the rail, a twig leaning right, and the content. The dot turns coral once you reach it. */
export function Stop({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section data-stop data-reached="false" className={`relative pb-24 pl-10 pr-0 md:pl-12 md:pr-6 ${className}`}>
      <span aria-hidden className="pp-node absolute left-[10px] top-2 z-10 size-5 -translate-x-1/2 rounded-full" />
      {/* The label is kept for screen readers; visually the headline leads. */}
      <p className="sr-only">{label}</p>
      <div className="sm:-mt-3">{children}</div>
    </section>
  );
}

/** A honey dot (and two softer ones) that trails the cursor. Fine pointers only, never with reduced motion. */
export function PollenCursor() {
  const dots = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (reduced() || !window.matchMedia("(pointer: fine)").matches) return;
    const target = { x: -100, y: -100 };
    const pos = [0, 1, 2].map(() => ({ x: -100, y: -100 }));
    const rates = [0.28, 0.16, 0.09];
    let raf = 0;
    let seen = false;
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!seen) {
        seen = true;
        pos.forEach((p) => {
          p.x = e.clientX;
          p.y = e.clientY;
        });
        dots.current.forEach((d) => d && (d.style.opacity = "1"));
      }
    };
    const tick = () => {
      pos.forEach((p, i) => {
        p.x += (target.x - p.x) * rates[i];
        p.y += (target.y - p.y) * rates[i];
        const d = dots.current[i];
        if (d) d.style.transform = `translate3d(${p.x - 7}px, ${p.y - 7}px, 0)`;
      });
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const styles = [
    "size-3.5 bg-honey",
    "size-2.5 bg-honey/70",
    "size-2 bg-coral/60",
  ];
  return (
    <div aria-hidden className="pointer-events-none fixed left-0 top-0 z-50 hidden [@media(pointer:fine)]:block">
      {styles.map((s, i) => (
        <span
          key={i}
          ref={(el) => {
            dots.current[i] = el;
          }}
          className={`absolute left-0 top-0 rounded-full ${s}`}
          style={{ transform: "translate3d(-100px,-100px,0)", opacity: 0 }}
        />
      ))}
    </div>
  );
}
