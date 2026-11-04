// The hero's pollen scatter, reusable from any element: pollen flies out from it, drifts across the page and fades.
const COLORS = ["#f6bd60", "#f6bd60", "#f28482", "#f5cac3", "#84a59d"];

export function pollenBurst(from: Element, count = 34) {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden";
  document.body.appendChild(layer);

  let left = count;
  for (let k = 0; k < count; k++) {
    const size = 7 + Math.random() * 9;
    const el = document.createElement("span");
    el.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;border-radius:9999px;background:${COLORS[Math.floor(Math.random() * COLORS.length)]};will-change:transform,opacity`;
    layer.appendChild(el);
    const tx = window.innerWidth * (0.03 + Math.random() * 0.94);
    const ty = window.innerHeight * (0.05 + Math.random() * 0.9);
    const s = 0.35 + Math.random() * 0.5;
    const driftX = (Math.random() - 0.5) * 120;
    const driftY = -30 - Math.random() * 90;
    const place = (px: number, py: number, sc: number) => `translate(${px - size / 2}px, ${py - size / 2}px) scale(${sc})`;
    el.animate(
      [
        { transform: place(x, y, 1), opacity: 1, easing: "cubic-bezier(.12,.8,.2,1)" },
        { transform: place(tx, ty, s), opacity: 1, offset: 0.3 },
        { transform: place(tx + driftX, ty + driftY, s * 0.8), opacity: 0 },
      ],
      { duration: 3200 + Math.random() * 2600, fill: "forwards" },
    ).onfinish = () => {
      el.remove();
      if (--left === 0) layer.remove();
    };
  }
}

/** A small, soft scatter around one element (a few grains that float up and fade): for quiet "this is ready" moments. */
export function pollenPuff(from: Element, count = 12) {
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden";
  document.body.appendChild(layer);

  let left = count;
  for (let k = 0; k < count; k++) {
    const size = 4 + Math.random() * 5;
    const el = document.createElement("span");
    el.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;border-radius:9999px;background:${COLORS[Math.floor(Math.random() * COLORS.length)]};will-change:transform,opacity`;
    layer.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const dist = 22 + Math.random() * 38;
    const tx = x + Math.cos(angle) * dist;
    const ty = y + Math.sin(angle) * dist;
    const place = (px: number, py: number, sc: number) => `translate(${px - size / 2}px, ${py - size / 2}px) scale(${sc})`;
    el.animate(
      [
        { transform: place(x, y, 0.4), opacity: 0.9, easing: "cubic-bezier(.2,.8,.3,1)" },
        { transform: place(tx, ty, 1), opacity: 0.9, offset: 0.35 },
        { transform: place(tx + (Math.random() - 0.5) * 24, ty - 18 - Math.random() * 26, 0.6), opacity: 0 },
      ],
      { duration: 1300 + Math.random() * 900, fill: "forwards", delay: Math.random() * 120 },
    ).onfinish = () => {
      el.remove();
      if (--left === 0) layer.remove();
    };
  }
}
