import { test } from "node:test";
import assert from "node:assert/strict";
import { monthGrid, addMonth } from "../calendar.js";

test("monthGrid：日曜始まりで、1日の曜日まで空きを入れる", () => {
  const g = monthGrid(2026, 9); // 2026-09-01 は火曜
  assert.equal(g.length % 7, 0);
  assert.deepEqual(g.slice(0, 3), [null, null, "2026-09-01"]);
  assert.equal(g.filter(Boolean).length, 30);
  assert.equal(g.filter(Boolean).at(-1), "2026-09-30");
});

test("monthGrid：うるう年の2月と、日曜始まりの月", () => {
  const feb = monthGrid(2028, 2);
  assert.equal(feb.filter(Boolean).at(-1), "2028-02-29");
  const nov = monthGrid(2026, 11); // 2026-11-01 は日曜
  assert.equal(nov[0], "2026-11-01");
});

test("addMonth：年をまたぐ", () => {
  assert.deepEqual(addMonth(2026, 12, 1), [2027, 1]);
  assert.deepEqual(addMonth(2026, 1, -1), [2025, 12]);
  assert.deepEqual(addMonth(2026, 9, 1), [2026, 10]);
});
