// カレンダーの日付計算（純粋関数のみ）
import { localDateStr } from "./core.js";

// 日曜始まり。空きは null、日付は "YYYY-MM-DD"。長さは7の倍数
export function monthGrid(year, month) {
  const first = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(localDateStr(new Date(year, month - 1, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function addMonth(year, month, delta) {
  const d = new Date(year, month - 1 + delta, 1);
  return [d.getFullYear(), d.getMonth() + 1];
}
