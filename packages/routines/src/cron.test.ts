import assert from "node:assert/strict";
import { test } from "node:test";
import { cronMatches } from "./cron.js";

test("matches exact minute and hour", () => {
  const d = new Date(2026, 7, 14, 9, 30, 0);
  assert.equal(cronMatches("30 9 * * *", d), true);
  assert.equal(cronMatches("0 9 * * *", d), false);
});

test("matches weekday range", () => {
  const friday = new Date(2026, 7, 14, 8, 0, 0);
  assert.equal(friday.getDay(), 5);
  assert.equal(cronMatches("0 8 * * 1-5", friday), true);
  const sunday = new Date(2026, 7, 16, 8, 0, 0);
  assert.equal(cronMatches("0 8 * * 1-5", sunday), false);
});

test("matches step", () => {
  const d = new Date(2026, 7, 14, 9, 0, 0);
  assert.equal(cronMatches("*/15 9 * * *", d), true);
  d.setMinutes(7);
  assert.equal(cronMatches("*/15 9 * * *", d), false);
});
