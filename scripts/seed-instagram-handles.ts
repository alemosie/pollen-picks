// Looks up the owner of every Instagram post linked in the demo issue (fixtures/issue-49.html) and stores it in the shared
// cache (public.instagram_handles), so the public demo shows its tags without any visitor triggering a lookup.
// Posts already cached are skipped, so re-running costs nothing. Dry run by default.
//
//   yarn tsx --env-file=.env.local scripts/seed-instagram-handles.ts           # list what would be looked up
//   yarn tsx --env-file=.env.local scripts/seed-instagram-handles.ts --run     # look up and store (dev database)
//   yarn tsx --env-file=.env.production scripts/seed-instagram-handles.ts --run # same, prod database
//
// Needs APIFY_TOKEN in the same env file. Spends Apify credit: about $0.0023 per post.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cacheHandle, fetchPostOwner, knownHandles } from "../src/lib/instagramHandles";
import { parseChunks } from "../src/lib/pollen/chunks";
import { instagramPostCode, instagramPostKey } from "../src/lib/pollen/url";

async function main() {
  const run = process.argv.includes("--run");
  const html = readFileSync(join(__dirname, "..", "fixtures", "issue-49.html"), "utf8");
  const urls = [...new Set(parseChunks(html).map((c) => c.url).filter((u): u is string => !!instagramPostKey(u)))];
  const known = await knownHandles(urls);
  const todo = urls.filter((u) => !known[instagramPostKey(u)!]);
  console.log(`${urls.length} Instagram post links in the demo issue, ${urls.length - todo.length} already cached, ${todo.length} to look up.`);
  for (const u of urls) console.log(`  ${known[instagramPostKey(u)!] ? "cached " : "missing"} ${instagramPostKey(u)}${known[instagramPostKey(u)!] ? `  @${known[instagramPostKey(u)!]}` : ""}`);
  if (!run) return console.log(todo.length ? "\nDry run. Add --run to look these up." : "\nNothing to do.");

  let done = 0;
  for (const u of todo) {
    const key = instagramPostKey(u)!;
    const code = instagramPostCode(u)!;
    try {
      const handle = await fetchPostOwner(key, code);
      if (handle) {
        await cacheHandle(code, handle);
        done++;
        console.log(`  stored  ${key}  @${handle}`);
      } else console.log(`  no account found for ${key}`);
    } catch (e) {
      console.log(`  failed  ${key}: ${(e as Error).message}`);
    }
  }
  console.log(`\nStored ${done} of ${todo.length}.`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
