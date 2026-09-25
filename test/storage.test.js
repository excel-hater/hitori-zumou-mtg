import { test } from "node:test";
import assert from "node:assert/strict";

// storage.js は読み込み時に localStorage を確かめるので、先に偽物を入れておく
const data = new Map();
globalThis.localStorage = {
  getItem: (k) => (data.has(k) ? data.get(k) : null),
  setItem: (k, v) => data.set(k, String(v)),
  removeItem: (k) => data.delete(k),
  key: (i) => [...data.keys()][i] ?? null,
  get length() { return data.size; },
};
const storage = await import("../storage.js");

test("listSessionDates：保存した日付だけを返す", () => {
  storage.saveSession({ date: "2026-09-20" });
  storage.saveSession({ date: "2026-09-25" });
  storage.saveSettings({ voice: true });
  data.set("other-app:session:2026-01-01", "{}");
  assert.equal(storage.isPersistent(), true);
  assert.deepEqual([...storage.listSessionDates()].sort(), ["2026-09-20", "2026-09-25"]);
  storage.removeSession("2026-09-20");
  assert.deepEqual([...storage.listSessionDates()], ["2026-09-25"]);
});
