import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../test/setup"; // first: sets the env and the fake network
import { latestStoredSlideUrls, pruneStoredSlides, removeAllSlidesOf, SLIDE_RETENTION_DAYS, slidePublicUrl, storeSlide } from "./slideStore";

// The stored slides of a send (db/supabase/0026): content-hash names, public addresses, and everything that removes them. The bucket is the fake's in-memory map.
const png = (n: number) => ({ bytes: Buffer.from(`png-${n}`), type: "image/png" as const });
const DAY = 86_400_000;
const NOW = Date.parse("2026-11-20T12:00:00Z");
const row = (over: Record<string, unknown>) => ({ id: Math.floor(Math.random() * 1e9), user_id: "u1", mode: "now", slide_paths: null, slide_paths_small: null, created_at: new Date(NOW).toISOString(), ...over });
const posts = (rows: Record<string, unknown>[]) => fakes.supabase.tables.set("post_history", rows);

beforeEach(() => fakes.reset());

describe("storing slides", () => {
  test("the name is the image's hash under the user's folder, so the same slide stored twice is one file", async () => {
    const a = await storeSlide("u1", png(1));
    const b = await storeSlide("u1", png(1));
    assert.equal(a, b);
    assert.match(a, /^u\/u1\/[0-9a-f]{40}\.png$/);
    assert.equal(fakes.supabase.files.size, 1);
    await storeSlide("u1", png(2));
    assert.equal(fakes.supabase.files.size, 2);
  });
  test("a JPEG gets .jpg", async () => {
    assert.match(await storeSlide("u1", { bytes: Buffer.from("j"), type: "image/jpeg" }), /\.jpg$/);
  });
  test("the public address is the bucket's", async () => {
    const path = await storeSlide("u1", png(1));
    assert.equal(slidePublicUrl(path), `http://db.test/storage/v1/object/public/slides/${path}`);
  });
});

describe("removing slides", () => {
  test("deleting an account's slides takes all of them (more than one page) and nobody else's", async () => {
    for (let i = 0; i < 130; i++) await storeSlide("u1", png(i));
    await storeSlide("u2", png(1000));
    await removeAllSlidesOf("u1");
    assert.deepEqual([...fakes.supabase.files.keys()].map((k) => k.split("/")[1]), ["u2"]);
  });
  test("an account with none is fine", async () => {
    await removeAllSlidesOf("nobody");
  });
});

describe("feedback: the latest send's slides", () => {
  test("the newest row that has stored slides, as public addresses", async () => {
    posts([
      row({ id: 1, created_at: new Date(NOW - 2 * DAY).toISOString(), slide_paths: ["u/u1/old.png"] }),
      row({ id: 2, created_at: new Date(NOW - DAY).toISOString(), slide_paths: ["u/u1/a.png", "u/u1/b.png"] }),
      row({ id: 3, created_at: new Date(NOW).toISOString(), slide_paths: null }),
      row({ id: 4, user_id: "u2", created_at: new Date(NOW).toISOString(), slide_paths: ["u/u2/x.png"] }),
    ]);
    assert.deepEqual(await latestStoredSlideUrls("u1"), [slidePublicUrl("u/u1/a.png"), slidePublicUrl("u/u1/b.png")]);
  });
  test("none stored: empty", async () => {
    posts([row({ slide_paths: null })]);
    assert.deepEqual(await latestStoredSlideUrls("u1"), []);
  });
});

describe("retention", () => {
  const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
  const over = ago(SLIDE_RETENTION_DAYS + 1);
  const left = async () => [...fakes.supabase.files.keys()].sort();
  const paths = async (n: number) => storeSlide("u1", png(n));

  test("a published, deleted or failed post loses its slides after 30 days; the paths are forgotten", async () => {
    const sent = await paths(1), removed = await paths(2), failed = await paths(3);
    posts([
      row({ id: 1, status: "sent", created_at: over, slide_paths: [sent] }),
      row({ id: 2, status: "removed", created_at: over, slide_paths: [removed] }),
      row({ id: 3, status: "failed", created_at: over, slide_paths: [failed] }),
    ]);
    await pruneStoredSlides("u1", NOW);
    assert.deepEqual(await left(), []);
    for (const r of fakes.supabase.tables.get("post_history") as Record<string, unknown>[]) assert.equal(r.slide_paths, null);
  });
  test("a draft that is still a draft, and a scheduled post, keep theirs however old they are", async () => {
    const draft = await paths(1), scheduled = await paths(2);
    posts([row({ id: 1, status: "draft", mode: "draft", created_at: ago(400), slide_paths: [draft] }), row({ id: 2, status: "scheduled", mode: "draft", created_at: ago(400), slide_paths: [scheduled] })]);
    await pruneStoredSlides("u1", NOW);
    assert.deepEqual(await left(), [draft, scheduled].sort());
  });
  test("a draft published in Buffer long after it was sent: the 30 days count from when it was last checked, not from sending", async () => {
    const p = await paths(1);
    posts([row({ id: 1, status: "sent", mode: "draft", created_at: ago(200), checked_at: ago(2), slide_paths: [p] })]);
    await pruneStoredSlides("u1", NOW);
    assert.deepEqual(await left(), [p]);
    posts([row({ id: 1, status: "sent", mode: "draft", created_at: ago(200), checked_at: ago(31), slide_paths: [p] })]);
    await pruneStoredSlides("u1", NOW);
    assert.deepEqual(await left(), []);
  });
  test("a file that a post still in play lists is kept", async () => {
    const shared = await paths(1);
    posts([row({ id: 1, status: "sent", created_at: over, slide_paths: [shared] }), row({ id: 2, status: "draft", mode: "draft", created_at: over, slide_paths: [shared] })]);
    await pruneStoredSlides("u1", NOW);
    assert.deepEqual(await left(), [shared]);
    assert.equal((fakes.supabase.tables.get("post_history") as Record<string, unknown>[]).find((r) => r.id === 1)!.slide_paths, null);
  });
  test("a recently sent post, and an unclear one, are untouched", async () => {
    const recent = await paths(1), unknown = await paths(2);
    posts([row({ id: 1, status: "sent", slide_paths: [recent] }), row({ id: 2, status: "unknown", created_at: over, slide_paths: [unknown] })]);
    await pruneStoredSlides("u1", NOW);
    assert.deepEqual(await left(), [recent, unknown].sort());
  });
});
