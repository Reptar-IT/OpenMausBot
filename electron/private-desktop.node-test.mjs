import assert from "node:assert/strict";
import { test } from "node:test";
import { privateBootEnvironment, privateCompanionRoutes } from "./private-desktop.mjs";

test("managed grants stay stored but do not resume without launch authorization", () => {
  const environments = [{ id: "work", origin: "https://cloud.example.test", team: { id: "team" } }];
  const stored = { activeId: "work", environments };
  assert.deepEqual(privateBootEnvironment(stored, false, "local"), { activeId: "local", environments });
  assert.equal(stored.activeId, "work");
  assert.equal(privateBootEnvironment(stored, true, "local"), stored);
  assert.deepEqual(privateCompanionRoutes(["wifi", "relay", "https"], false), ["wifi"]);
  assert.deepEqual(privateCompanionRoutes(["wifi", "relay"], true), ["wifi", "relay"]);
});
