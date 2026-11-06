// Runs Lighthouse on every page and prints one table: Performance / Accessibility / Best practices / SEO, plus what each page loses points on.
// Full HTML reports go to lighthouse-reports/ (open them for the details).
//
//   Build and start the real thing first (a dev server scores far worse than what visitors get):
//     yarn build && yarn start            (serves http://localhost:3003)
//   Then, in another terminal:
//     node scripts/lighthouse-all.mjs                       public pages and the demo
//     node scripts/lighthouse-all.mjs --signed-in "name=value"   also the pages behind the Buffer login
//     node scripts/lighthouse-all.mjs --desktop             desktop instead of phone scoring
//     node scripts/lighthouse-all.mjs --base https://pollenpicks.com   test a deployed site instead
//     node scripts/lighthouse-all.mjs /pick /history        only these paths
//     node scripts/lighthouse-all.mjs --base https://site.netlify.app --signed-in "pp_session=..." \
//       "/pick?mode=own%3Apub_...%3Apost_..." "/design?mode=...&picks=1,2,3"      paths may carry a query string (quote them: & is a shell operator)
//
// For --signed-in, log in in your browser, open DevTools > Application > Cookies, and pass the session cookie as "name=value"
// (it is called pp_session; several cookies can be joined with "; ").
// Needs Chrome installed. Lighthouse itself is fetched by npx the first time.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  return args.splice(i, 2)[1] ?? null;
};
const desktop = args.includes("--desktop");
if (desktop) args.splice(args.indexOf("--desktop"), 1);
let base = (flag("--base") ?? "http://localhost:3003").replace(/\/$/, "");
const cookie = flag("--signed-in");

const PUBLIC = ["/", "/login", "/privacy", "/feedback", "/demo/source", "/demo/pick", "/demo/write", "/demo/design", "/demo/send"];
const SIGNED_IN = ["/source", "/pick", "/write", "/design", "/send", "/history", "/settings", "/beehiiv/setup"];
// A full URL is accepted too: its origin becomes the base, so you can paste addresses straight from the browser.
const only = args.map((a) => {
  if (!/^https?:\/\//i.test(a)) return a;
  const u = new URL(a);
  base = u.origin;
  return u.pathname + u.search;
}).filter((a) => a.startsWith("/"));
const paths = only.length ? only : [...PUBLIC, ...(cookie ? SIGNED_IN : [])];

mkdirSync("lighthouse-reports", { recursive: true });
const rows = [];
for (const path of paths) {
  const pathname = path.split("?")[0];
  const query = path.includes("?") ? "-" + createHash("sha1").update(path).digest("hex").slice(0, 6) : "";
  const name = (pathname === "/" ? "home" : pathname.slice(1).replace(/\//g, "-")) + query + (desktop ? "-desktop" : "-mobile");
  const out = `lighthouse-reports/${name}`;
  process.stdout.write(`${path} ... `);
  try {
    execFileSync(
      "npx",
      [
        "--yes", "lighthouse@12", base + path,
        "--output=json", "--output=html", `--output-path=${out}`,
        "--only-categories=performance,accessibility,best-practices,seo",
        "--chrome-flags=--headless=new --ignore-certificate-errors",
        "--quiet",
        ...(desktop ? ["--preset=desktop"] : []),
        ...(cookie && SIGNED_IN.includes(pathname) ? [`--extra-headers=${JSON.stringify({ Cookie: cookie })}`] : []),
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    const r = JSON.parse(readFileSync(`${out}.report.json`, "utf8"));
    const score = (k) => Math.round((r.categories[k]?.score ?? 0) * 100);
    const lost = Object.values(r.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "manual" && a.scoreDisplayMode !== "notApplicable")
      .filter((a) => r.categories.accessibility.auditRefs.some((x) => x.id === a.id) || r.categories.seo.auditRefs.some((x) => x.id === a.id) || r.categories["best-practices"].auditRefs.some((x) => x.id === a.id))
      .map((a) => a.title);
    const finalPath = new URL(r.finalDisplayedUrl).pathname;
    rows.push({ path, perf: score("performance"), a11y: score("accessibility"), bp: score("best-practices"), seo: score("seo"), lost, redirected: finalPath !== pathname ? finalPath : null });
    console.log("done");
  } catch (e) {
    rows.push({ path, error: String(e.stderr || e.message).split("\n")[0] });
    console.log("failed");
  }
}

console.log(`\n${"page".padEnd(18)} perf  a11y  best  seo`);
for (const r of rows) {
  if (r.error) console.log(`${r.path.padEnd(18)} ERROR: ${r.error}`);
  else console.log(`${r.path.padEnd(18)} ${String(r.perf).padStart(4)}  ${String(r.a11y).padStart(4)}  ${String(r.bp).padStart(4)}  ${String(r.seo).padStart(3)}${r.redirected ? `   (redirected to ${r.redirected}: probably not signed in)` : ""}`);
}
const issues = rows.filter((r) => r.lost?.length);
if (issues.length) {
  console.log("\nLosing points on (accessibility, SEO and best practices):");
  for (const r of issues) console.log(`  ${r.path}\n${r.lost.map((t) => `    - ${t}`).join("\n")}`);
}
console.log("\nReports: lighthouse-reports/*.report.html");
