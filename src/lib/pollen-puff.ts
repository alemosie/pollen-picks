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
