import assert from "node:assert/strict";
import test from "node:test";
import { bandColor, computeConfidence, scoreToband } from "./score.js";

test("maps score ranges to the expected risk band", () => {
  assert.equal(scoreToband(0), "low");
  assert.equal(scoreToband(26), "some_risk");
  assert.equal(scoreToband(60), "high");
  assert.equal(scoreToband(99), "extreme");
});

test("reports confidence from completion ratio", () => {
  assert.equal(computeConfidence(31, 31), "high");
  assert.equal(computeConfidence(25, 31), "medium");
  assert.equal(computeConfidence(20, 31), "low");
});

test("returns stable colors for each band", () => {
  assert.equal(bandColor("low"), "#00C805");
  assert.equal(bandColor("some_risk"), "#FFB020");
  assert.equal(bandColor("high"), "#FF3B30");
  assert.equal(bandColor("extreme"), "#8B1E1A");
});
