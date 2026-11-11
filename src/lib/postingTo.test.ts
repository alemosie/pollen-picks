import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitScope, seedSelection, splitNetworks, toggleNetwork } from "./postingTo";

const ch = (id: string, service: string, name = id) => ({ id, name, service });
const channels = [ch("ig1", "instagram"), ch("ig2", "instagram"), ch("li", "linkedin"), ch("bs", "bluesky"), ch("tt", "tiktok")];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("fitScope", () => {
  it("is the ticked usable channels only", () => {
    assert.deepEqual(ids(fitScope(channels, new Set(["li", "ig2"]))), ["ig2", "li"]);
  });
  it("leaves out a network that is not ticked, so its limits don't apply", () => {
    assert.ok(!fitScope(channels, new Set(["li"])).some((c) => c.service === "bluesky"));
  });
  it("falls back to every usable channel when none is ticked, and never includes an unsupported network", () => {
    assert.deepEqual(ids(fitScope(channels, new Set())), ["ig1", "ig2", "li", "bs"]);
  });
  it("ignores a ticked id that is not a usable channel", () => {
    assert.deepEqual(ids(fitScope(channels, new Set(["tt", "gone"]))), ["ig1", "ig2", "li", "bs"]);
  });
});

describe("seedSelection", () => {
  const usable = ["ig1", "ig2", "li", "bs"];
  it("starts from the channels of the last send", () => {
    assert.deepEqual([...seedSelection(usable, ["li", "ig1"])].sort(), ["ig1", "li"]);
  });
  it("drops channels that are no longer connected", () => {
    assert.deepEqual([...seedSelection(usable, ["li", "removed"])], ["li"]);
  });
  it("starts from everything with no send yet, or when none of its channels is left", () => {
    assert.deepEqual([...seedSelection(usable, undefined)], usable);
    assert.deepEqual([...seedSelection(usable, [])], usable);
    assert.deepEqual([...seedSelection(usable, ["removed"])], usable);
  });
});

describe("splitNetworks", () => {
  it("puts networks with a ticked channel first, A to Z, and the rest in Other", () => {
    assert.deepEqual(splitNetworks(channels, new Set(["li", "ig2"])), { on: ["instagram", "linkedin"], off: ["bluesky"] });
  });
  it("counts a network as on when only one of its channels is ticked", () => {
    assert.deepEqual(splitNetworks(channels, new Set(["ig2"])).on, ["instagram"]);
  });
  it("lists everything as Other when nothing is ticked, and never lists an unsupported network", () => {
    assert.deepEqual(splitNetworks(channels, new Set()), { on: [], off: ["bluesky", "instagram", "linkedin"] });
  });
});

describe("toggleNetwork", () => {
  const start = new Set(["ig1", "li"]);
  it("turns every channel of the network on, and touches nothing else", () => {
    assert.deepEqual([...toggleNetwork(channels, start, "bluesky", true)].sort(), ["bs", "ig1", "li"]);
    assert.deepEqual([...toggleNetwork(channels, new Set(["li"]), "instagram", true)].sort(), ["ig1", "ig2", "li"]);
  });
  it("turns every channel of the network off, even when only some were ticked", () => {
    assert.deepEqual([...toggleNetwork(channels, start, "instagram", false)], ["li"]);
  });
  it("does not change the set it was given", () => {
    toggleNetwork(channels, start, "instagram", false);
    assert.deepEqual([...start].sort(), ["ig1", "li"]);
  });
  it("moves a network between Posting to and Unselected channels", () => {
    const off = toggleNetwork(channels, start, "linkedin", false);
    assert.deepEqual(splitNetworks(channels, off), { on: ["instagram"], off: ["bluesky", "linkedin"] });
    assert.deepEqual(splitNetworks(channels, toggleNetwork(channels, off, "bluesky", true)).on, ["bluesky", "instagram"]);
  });
});
