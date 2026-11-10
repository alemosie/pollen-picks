import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cleanLinkedinFormat, DEFAULT_LINKEDIN_FORMAT, LINKEDIN_FORMATS } from "./linkedinFormat";

describe("LinkedIn format", () => {
  test("LinkedIn's own carousel, the PDF, is the default", () => {
    assert.equal(DEFAULT_LINKEDIN_FORMAT, "pdf");
    assert.deepEqual([...LINKEDIN_FORMATS], ["pdf", "images"]);
  });
  test("only the two known formats are kept; anything else reads as the default", () => {
    assert.equal(cleanLinkedinFormat("images"), "images");
    assert.equal(cleanLinkedinFormat("pdf"), "pdf");
    for (const v of [undefined, null, "", "PDF", "gif", 1, {}]) assert.equal(cleanLinkedinFormat(v), "pdf");
  });
});
