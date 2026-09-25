import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSession, step, currentPrompt, currentStep, isDone,
  splitToday, parseMood, localDateStr, prevDateStr,
} from "../core.js";
import { EchoResponder, truncate } from "../responder.js";
import { SAMPLE } from "../script.js";
import { toMarkdown, exportFilename, contentOf, hasContent } from "../export.js";

const fixed = () => new EchoResponder({ random: () => 0 });

// 新しいセッションを作り、最初の入力待ち（yesterday）まで進める
function begin(prev = null) {
  return step(createSession("2026-09-25", prev), "", fixed());
}

function runAll(inputs, prev = null) {
  let { session } = begin(prev);
  const all = [];
  for (const text of inputs) {
    const r = step(session, text, fixed());
    session = r.session;
    all.push(...r.botMessages);
  }
  return { session, all };
}

test("開始するとあいさつと yesterday の質問が出る", () => {
  const { session, botMessages } = begin();
  assert.equal(botMessages[0], "おはようございます。朝会を始めましょう");
  assert.equal(botMessages.at(-1), "昨日やったことは？");
  assert.equal(currentStep(session).id, "yesterday");
  assert.equal(currentPrompt(session), "昨日やったことは？");
  assert.deepEqual(session.log.map((m) => m.who), ["bot", "bot"]);
});

test("全ステップを通して done に到達する", () => {
  const { session, all } = runAll(["資料作成", "A、B", "なし", "4"]);
  assert.equal(currentStep(session).id, "done");
  assert.ok(isDone(session));
  assert.deepEqual(session.answers, {
    yesterday: "資料作成", today: ["A", "B"], blocker: "なし", mood: 4,
  });
  assert.ok(all.some((m) => m.includes("17時にまた開いてね")));
  assert.ok(all.some((m) => m.includes("1. A") && m.includes("2. B")));
  assert.equal(all.at(-1), "今日の朝会は終わりました");
});

test("session は編集内容とメモを持ち、step の後も残る", () => {
  const s0 = createSession("2026-09-25", null);
  assert.equal(s0.edited, null);
  assert.equal(s0.memo, "");
  let { session } = step({ ...s0, edited: "# 手で書いた", memo: "メモ" }, "", fixed());
  session = step(session, "資料作成", fixed()).session;
  assert.equal(session.edited, "# 手で書いた");
  assert.equal(session.memo, "メモ");
});

test("done の後に入力しても何も起きない", () => {
  const { session } = runAll(["x", "A", "なし", "3"]);
  const r = step(session, "もう一回", fixed());
  assert.equal(r.session, session);
  assert.deepEqual(r.botMessages, []);
});

test("step は元の session を書き換えない", () => {
  const { session } = begin();
  const snapshot = JSON.stringify(session);
  const r = step(session, "昨日のこと", fixed());
  assert.equal(JSON.stringify(session), snapshot);
  assert.notEqual(r.session, session);
  assert.equal(r.session.stepIndex, session.stepIndex + 1);
});

test("空の入力は無視する", () => {
  const { session } = begin();
  const r = step(session, "   ", fixed());
  assert.equal(r.session, session);
  assert.deepEqual(r.botMessages, []);
});

test("ユーザーの発言とボットの返答がログに残る", () => {
  const { session } = begin();
  const r = step(session, "資料作成", fixed(), 1234);
  const tail = r.session.log.slice(2);
  assert.deepEqual(tail[0], { who: "me", text: "資料作成", t: 1234 });
  assert.equal(tail[1].who, "bot");
  assert.equal(tail[1].text, "資料作成、お疲れさまでした");
  assert.equal(tail.at(-1).text, currentPrompt(r.session));
});

test("today の分割：改行・読点・カンマ・4件以上は3件", () => {
  assert.deepEqual(splitToday("A\nB\nC"), ["A", "B", "C"]);
  assert.deepEqual(splitToday("A、B、C"), ["A", "B", "C"]);
  assert.deepEqual(splitToday("A,B, C"), ["A", "B", "C"]);
  assert.deepEqual(splitToday("A，B"), ["A", "B"]);
  assert.deepEqual(splitToday("A\r\nB、C,D"), ["A", "B", "C"]);
  assert.deepEqual(splitToday(" A 、、\n B "), ["A", "B"]);
  assert.deepEqual(splitToday("、、"), []);
});

test("today が区切り文字だけなら再質問", () => {
  let { session } = begin();
  session = step(session, "x", fixed()).session;
  const r = step(session, "、、", fixed());
  assert.equal(currentStep(r.session).id, "today");
  assert.equal(r.botMessages.length, 1);
});

test("mood の検証：全角を受け付ける、範囲外や文字は null", () => {
  assert.equal(parseMood("4"), 4);
  assert.equal(parseMood("４"), 4);
  assert.equal(parseMood(" 1 "), 1);
  assert.equal(parseMood("５"), 5);
  assert.equal(parseMood("0"), null);
  assert.equal(parseMood("6"), null);
  assert.equal(parseMood("45"), null);
  assert.equal(parseMood("よい"), null);
  assert.equal(parseMood("3.5"), null);
});

test("mood が範囲外なら再質問し、正しい値で先へ進む", () => {
  let { session } = runAll(["x", "A", "なし"]);
  assert.equal(currentStep(session).id, "mood");
  for (const bad of ["0", "6", "元気"]) {
    const r = step(session, bad, fixed());
    assert.equal(currentStep(r.session).id, "mood");
    assert.match(r.botMessages[0], /1〜5/);
    assert.equal(r.session.log.at(-2).text, bad); // 誤入力もログに残る
    session = r.session;
  }
  const ok = step(session, "４", fixed());
  assert.equal(ok.session.answers.mood, 4);
  assert.ok(isDone(ok.session));
});

test("前日セッションがあれば yesterday の前に昨日の予定を出す", () => {
  const prev = { date: "2026-09-24", answers: { today: ["A", "B", "C"] } };
  const withPrev = begin(prev).botMessages;
  const without = begin(null).botMessages;
  assert.ok(withPrev.includes("昨日の予定：A / B / C"));
  assert.ok(!without.some((m) => m.startsWith("昨日の予定")));
  assert.equal(withPrev.length, without.length + 1);
  // 予定が空の前日セッションなら出さない
  const empty = { date: "2026-09-24", answers: { today: [] } };
  assert.equal(begin(empty).botMessages.length, without.length);
});

test("localDateStr はローカル時刻で日付を作る", () => {
  assert.equal(localDateStr(new Date(2026, 8, 5, 0, 30)), "2026-09-05");
  assert.equal(localDateStr(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
  assert.equal(prevDateStr("2026-03-01"), "2026-02-28");
  assert.equal(prevDateStr("2026-01-01"), "2025-12-31");
});

test("使い方の会話例は最後まで進み、再質問が出ない", () => {
  let { session } = begin(SAMPLE.prev);
  for (const text of SAMPLE.inputs) session = step(session, text, fixed()).session;
  assert.ok(isDone(session));
  const who = session.log.map((m) => m.who);
  assert.equal(who.filter((w) => w === "me").length, SAMPLE.inputs.length);
  assert.ok(session.log.some((m) => m.text.startsWith("昨日の予定：")));
});

// ---- responder.js ----

test("EchoResponder：テンプレートは乱数で選ばれる", () => {
  const s = createSession("2026-09-25", null);
  const a = new EchoResponder({ random: () => 0 }).respond("yesterday", "掃除", s);
  const b = new EchoResponder({ random: () => 0.99 }).respond("yesterday", "掃除", s);
  assert.equal(a, "掃除、お疲れさまでした");
  assert.notEqual(a, b);
  assert.ok(b.includes("掃除"));
});

test("EchoResponder：blocker が「なし」系なら順調そう", () => {
  const r = fixed();
  const s = createSession("2026-09-25", null);
  for (const t of ["なし", "無し", "特になし", "ないです", "なし。"]) {
    assert.equal(r.respond("blocker", t, s), "順調そうですね", t);
  }
  assert.ok(r.respond("blocker", "締切が近い", s).includes("締切が近い"));
});

test("EchoResponder：mood に応じて返答が変わる", () => {
  const r = fixed();
  const s = (mood) => ({ ...createSession("2026-09-25", null), answers: { mood } });
  assert.equal(r.respond("mood", "1", s(1)), "無理せずいきましょう");
  assert.equal(r.respond("mood", "2", s(2)), "無理せずいきましょう");
  assert.equal(r.respond("mood", "5", s(5)), "いい調子ですね");
  assert.equal(r.respond("mood", "4", s(4)), "いい調子ですね");
});

test("長い入力は先頭30文字で切って…をつける", () => {
  const long = "あ".repeat(40);
  assert.equal(truncate(long), "あ".repeat(30) + "…");
  assert.equal(truncate("あ".repeat(30)), "あ".repeat(30));
  assert.equal(truncate("一行目\n二行目"), "一行目 二行目");
  const reply = fixed().respond("yesterday", long, createSession("2026-09-25", null));
  assert.ok(reply.includes("あ".repeat(30) + "…"));
  assert.ok(!reply.includes("あ".repeat(31)));
});

// ---- export.js ----

test("Markdown 出力の形式", () => {
  const { session } = runAll(["資料作成", "A\nB", "なし", "４"]);
  assert.equal(toMarkdown(session), [
    "# 朝会 2026-09-25",
    "",
    "- 昨日：資料作成",
    "- 今日：",
    "  - [ ] A",
    "  - [ ] B",
    "- 詰まり：なし",
    "- 気分：4/5",
    "",
  ].join("\n"));
  assert.equal(exportFilename(session), "asakai-2026-09-25.md");
});

test("Markdown：途中のセッションと複数行の回答", () => {
  let { session } = begin();
  session = step(session, "一行目\n二行目", fixed()).session;
  const md = toMarkdown(session);
  assert.ok(md.includes("- 昨日：一行目 / 二行目\n"));
  assert.ok(md.includes("- 今日：\n- 詰まり：\n- 気分：\n"));
});

test("contentOf：編集した内容があればそれを、なければ会話から作る", () => {
  const { session } = runAll(["資料作成", "A", "なし", "3"]);
  assert.equal(contentOf(session), toMarkdown(session));
  assert.equal(contentOf({ ...session, edited: "# 自分で書いた\n" }), "# 自分で書いた\n");
  assert.equal(contentOf({ ...session, edited: "" }), "");
  // edited がない古い記録
  const old = { ...session };
  delete old.edited;
  assert.equal(contentOf(old), toMarkdown(session));
});

test("hasContent：回答・編集・メモのどれかがあれば true", () => {
  const { session } = begin(); // あいさつだけ
  assert.equal(hasContent(session), false);
  assert.equal(hasContent(step(session, "資料作成", fixed()).session), true);
  assert.equal(hasContent({ ...session, memo: "メモ" }), true);
  assert.equal(hasContent({ ...session, edited: "# 朝会" }), true);
  assert.equal(hasContent({ date: "2026-09-01" }), false); // 欠けた古い記録でも落ちない
});
