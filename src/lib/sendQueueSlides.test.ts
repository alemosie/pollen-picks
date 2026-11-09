import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../test/setup"; // first: sets the env and the fake network
import { buildContext, type Claimed } from "./sendQueue";
import { slidePublicUrl } from "./slideStore";

// A send's slides are drawn and stored once. Every later try of the same send (a channel Buffer rate-limited, the next channel of the same batch)
// is given the stored ones: nothing is drawn again from highlights, a style or a page that may have changed since.
const claimed = (over: Partial<Claimed> = {}): Claimed => ({
  id: 1, user_id: "u1", batch_id: "b1", channel_id: "c1", service: "linkedin", mode: "draft", source: "link:abc", picks: [1000029], template: "", caption: "Hi", attempts: 1, ...over,
});

beforeEach(() => fakes.reset());

describe("buildContext with slides already stored", () => {
  test("uses the stored addresses and draws nothing (the issue isn't even loaded)", async () => {
    const ctx = await buildContext(claimed({ slide_paths: ["u/u1/a.png", "u/u1/b.png"], slide_paths_small: ["u/u1/a.jpg", "u/u1/b.jpg"] }));
    assert.deepEqual(ctx, {
      images: [slidePublicUrl("u/u1/a.png"), slidePublicUrl("u/u1/b.png")],
      smallImages: [slidePublicUrl("u/u1/a.jpg"), slidePublicUrl("u/u1/b.jpg")],
    });
    assert.equal(fakes.strays.length, 0, "no request went anywhere else");
  });
  test("no small copies stored: only the full-size ones", async () => {
    const ctx = await buildContext(claimed({ slide_paths: ["u/u1/a.png"], slide_paths_small: null }));
    assert.deepEqual(ctx, { images: [slidePublicUrl("u/u1/a.png")] });
  });
});
