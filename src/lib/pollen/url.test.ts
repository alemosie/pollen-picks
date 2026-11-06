import assert from "node:assert/strict";
import { test } from "node:test";
import { hostOf, instagramHandle, instagramPostCode, instagramPostKey, instagramTag, looseKey, normalizeUrl } from "./url";

test("normalizeUrl drops tracking and tidies the link", () => {
  assert.equal(normalizeUrl("https://www.Example.com/Path/?utm_source=x&b=2&a=1#top"), "https://example.com/Path?a=1&b=2");
  assert.equal(normalizeUrl("http://example.com/x/"), "https://example.com/x");
  assert.equal(normalizeUrl("example.com/x"), "https://example.com/x");
  assert.equal(normalizeUrl("https://example.com"), "https://example.com");
});

test("normalizeUrl drops beehiiv's and email tools' own parameters", () => {
  assert.equal(normalizeUrl("https://x.com/e?_bhlid=abc&last_resource_guid=1&bhcl_id=2"), "https://x.com/e");
  assert.equal(normalizeUrl("https://x.com/e?id=7&fbclid=zzz&mc_cid=1"), "https://x.com/e?id=7");
  assert.equal(normalizeUrl("https://x.com/e?utm_campaign=a&UTM_Medium=b"), "https://x.com/e");
});

test("normalizeUrl keeps the parameters that make a different page", () => {
  assert.notEqual(normalizeUrl("https://x.com/event?id=1"), normalizeUrl("https://x.com/event?id=2"));
  assert.equal(normalizeUrl("https://x.com/event?b=2&a=1"), normalizeUrl("https://x.com/event?a=1&b=2"));
});

test("normalizeUrl rejects what is not a web link", () => {
  assert.equal(normalizeUrl(""), null);
  assert.equal(normalizeUrl("   "), null);
  assert.equal(normalizeUrl("mailto:a@b.com"), null);
  assert.equal(normalizeUrl("tel:+31123456"), null);
});

test("Instagram links collapse to what identifies them", () => {
  assert.equal(normalizeUrl("https://www.instagram.com/p/DemVpYZoY-v/?igsh=abc&img_index=2"), "https://instagram.com/p/DemVpYZoY-v");
  assert.equal(normalizeUrl("https://instagram.com/reels/AbC_1/"), "https://instagram.com/reel/AbC_1");
  assert.equal(normalizeUrl("https://instagram.com/SomeAccount/?hl=en"), "https://instagram.com/someaccount");
});

test("hostOf and looseKey", () => {
  assert.equal(hostOf("https://www.example.com/a?b=1"), "example.com");
  assert.equal(hostOf("mailto:a@b.c"), null);
  assert.equal(looseKey("https://x.com/e?id=1"), "https://x.com/e");
  assert.equal(looseKey("https://x.com/e"), "https://x.com/e");
});

test("instagramHandle: accounts yes, posts and pages no", () => {
  assert.equal(instagramHandle("https://www.instagram.com/amsterdamparentproject/"), "amsterdamparentproject");
  assert.equal(instagramHandle("instagram.com/Some.Account?igsh=1"), "some.account");
  assert.equal(instagramHandle("https://instagram.com/p/DemVpYZoY-v/"), null);
  assert.equal(instagramHandle("https://instagram.com/explore/tags/fun/"), null);
  assert.equal(instagramHandle("https://example.com/someone"), null);
  assert.equal(instagramHandle(null), null);
  assert.equal(instagramHandle("https://instagram.com/has spaces"), null);
});

test("an account's own post link counts as the account", () => {
  assert.equal(instagramHandle("https://instagram.com/someone/p/DemVpYZoY-v/"), "someone");
});

test("post links: key, shortcode, and the tag from a looked-up owner", () => {
  const url = "https://www.instagram.com/p/DemVpYZoY-v/?igsh=1";
  assert.equal(instagramPostKey(url), "https://instagram.com/p/DemVpYZoY-v");
  assert.equal(instagramPostCode(url), "DemVpYZoY-v");
  assert.equal(instagramPostKey("https://instagram.com/someone"), null);
  assert.equal(instagramTag(url), null);
  assert.equal(instagramTag(url, { "https://instagram.com/p/DemVpYZoY-v": "theowner" }), "theowner");
  assert.equal(instagramTag("https://instagram.com/direct.account"), "direct.account");
});
