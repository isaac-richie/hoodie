import assert from "node:assert/strict";
import test from "node:test";
import { capTier, normalizeTier, scopesForTier, tierPolicySnapshot } from "./product-rules.js";

test("normalizes unknown tiers to guest", () => {
  assert.equal(normalizeTier("team"), "team");
  assert.equal(normalizeTier("pro"), "pro");
  assert.equal(normalizeTier("free"), "free");
  assert.equal(normalizeTier("gold"), "guest");
  assert.equal(normalizeTier(undefined), "guest");
});

test("caps requested api key tier to authenticated user tier", () => {
  assert.equal(capTier("team", "pro"), "pro");
  assert.equal(capTier("pro", "free"), "free");
  assert.equal(capTier("free", "team"), "free");
  assert.equal(capTier("team", "guest"), "free");
});

test("scopes expand by tier", () => {
  assert.deepEqual(scopesForTier("free"), ["scan:read", "user:write"]);
  assert.ok(scopesForTier("pro").includes("alerts:write"));
  assert.ok(scopesForTier("team").includes("team:write"));
});

test("policy snapshot exposes daily quota configuration", () => {
  const policies = tierPolicySnapshot();
  assert.equal(policies.free.dailyScans, 10);
  assert.equal(policies.pro.modules, "all");
});
