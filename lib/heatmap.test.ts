import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HEATMAP_MAX,
  HEATMAP_STOPS,
  colorForBehind,
  heatmapGradient,
} from "./heatmap";

describe("colorForBehind", () => {
  it("uses dark green for the column leader", () => {
    const [r, g, b] = HEATMAP_STOPS[0].rgb;
    assert.equal(colorForBehind(0).background, `rgb(${r} ${g} ${b})`);
    assert.equal(colorForBehind(0).color, "#ffffff");
  });

  it("stays in the green family for quotes within 1 LKR of the leader", () => {
    const close = colorForBehind(0.5).background;
    const leader = colorForBehind(0).background;
    const pack = colorForBehind(2).background;
    assert.notEqual(close, leader);
    assert.notEqual(close, pack);
    assert.match(close, /^rgb\((\d+) (\d+) (\d+)\)$/);
    const [, red, green, blue] = close.match(/^rgb\((\d+) (\d+) (\d+)\)$/)!;
    assert.ok(Number(green) > Number(red));
    assert.ok(Number(green) > Number(blue));
  });

  it("uses muted sand for the typical pack, not neon yellow or purple", () => {
    const [r, g, b] = HEATMAP_STOPS[2].rgb;
    assert.equal(colorForBehind(2).background, `rgb(${r} ${g} ${b})`);
    assert.equal(colorForBehind(2).color, "#14532d");
  });

  it("uses deep crimson for quotes 8+ LKR behind", () => {
    const [r, g, b] = HEATMAP_STOPS[HEATMAP_STOPS.length - 1].rgb;
    assert.equal(colorForBehind(HEATMAP_MAX).background, `rgb(${r} ${g} ${b})`);
    assert.equal(colorForBehind(30).background, `rgb(${r} ${g} ${b})`);
    assert.equal(colorForBehind(30).color, "#ffffff");
  });

  it("clamps negative values to the leader colour", () => {
    assert.equal(colorForBehind(-2).background, colorForBehind(0).background);
  });
});

describe("heatmapGradient", () => {
  it("builds a top-to-bottom sequential legend", () => {
    const gradient = heatmapGradient();
    assert.match(gradient, /^linear-gradient\(to bottom,/);
    assert.equal(gradient.includes("purple"), false);
  });

  it("can draw the same scale left to right for a compact mobile legend", () => {
    const gradient = heatmapGradient("to right");
    assert.match(gradient, /^linear-gradient\(to right,/);
  });
});
