import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../test/setup"; // first: sets the env and the fake network
import { deleteAccount } from "./accountDelete";
import { storeSlide } from "./slideStore";

describe("deleting an account and the stored slides", () => {
  beforeEach(() => fakes.reset());

  test("removes the account's stored slide files (and only theirs), and the images shared through its feedback", async () => {
    await storeSlide("u1", { bytes: Buffer.from("a"), type: "image/png" });
    await storeSlide("u2", { bytes: Buffer.from("b"), type: "image/png" });
    fakes.supabase.tables.set("feedback", [
      { id: 1, user_id: "u1", slide_images: ["http://db.test/storage/v1/object/public/slides/u/u1/x.png"], loved: "nice" },
      { id: 2, user_id: "u2", slide_images: ["http://db.test/storage/v1/object/public/slides/u/u2/y.png"] },
    ]);
    await deleteAccount("u1");
    assert.deepEqual([...fakes.supabase.files.keys()].map((k) => k.split("/")[1]), ["u2"]);
    const fb = fakes.supabase.tables.get("feedback") as Record<string, unknown>[];
    assert.equal(fb[0].slide_images, null);
    assert.equal(fb[0].user_id, null, "the answers stay, no longer linked");
    assert.equal(fb[0].loved, "nice");
    assert.ok(fb[1].slide_images, "someone else's is untouched");
  });
});
