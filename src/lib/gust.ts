// The pollen gust of the step loader (FlowLoader) as numbers, for drawing a frozen frame of it: four cubic segments that
// run in from the left, make one loop and drift out to the right. Same path as FlowLoader's GUST and the social image's.
const SEGS: [number, number][][] = [
  [[-60, 150], [120, 150], [230, 140], [310, 112]],
  [[310, 112], [400, 80], [470, 30], [420, 10]],
  [[420, 10], [360, -12], [290, 40], [330, 90]],
  [[330, 90], [370, 135], [480, 145], [580, 126]],
  [[580, 126], [680, 108], [770, 84], [860, 96]],
];

/** Point on the gust, t from 0 (far left) to 1 (far right). */
function at(t: number): [number, number] {
  const f = Math.min(0.9999, t) * SEGS.length;
  const s = SEGS[Math.floor(f)];
  const u = f - Math.floor(f);
  const m = 1 - u;
  const c = [m * m * m, 3 * m * m * u, 3 * m * u * u, u * u * u];
  return [0, 1].map((k) => s.reduce((sum, p, j) => sum + p[k] * c[j], 0)) as [number, number];
}

const COLORS = ["var(--color-honey)", "var(--color-coral)", "var(--color-sage)", "var(--color-honey)", "var(--color-ink)"];
const SIZES = [5, 3, 4, 3, 4];
const round = (n: number) => Math.round(n * 10) / 10; // so server and client markup match exactly

/** Grains spread along the gust, each nudged a little off the line so it looks loose, like the loader's. */
export const gustGrains = (count: number, scale = 1) =>
  Array.from({ length: count }, (_, i) => {
    const [x, y] = at(0.02 + (i / count) * 0.96);
    return {
      x: round(x + ((i * 37) % 12) - 6),
      y: round(y + ((i * 53) % 14) - 7),
      r: round(SIZES[i % SIZES.length] * scale),
      color: COLORS[i % COLORS.length],
    };
  });
