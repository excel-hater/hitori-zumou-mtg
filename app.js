// DOM 操作、イベント、保存の呼び出し（ブラウザ専用）
import { createSession, step, isDone, localDateStr, prevDateStr } from "./core.js";
import { EchoResponder } from "./responder.js";
import { SAMPLE } from "./script.js";
import { toMarkdown, exportFilename, contentOf, hasContent } from "./export.js";
import * as storage from "./storage.js";
import { createSpeaker } from "./voice.js";
import { monthGrid, addMonth } from "./calendar.js";

const $ = (id) => document.getElementById(id);
const logEl = $("log");
const form = $("form");
const input = $("text");
const sendBtn = $("send");
const editText = $("edit-text");
const editMsg = $("edit-msg");
const memoEl = $("memo");
const panels = { help: $("help"), calendar: $("calendar"), editor: $("editor") };

// app.js は respond() を持つオブジェクトにだけ依存する
const responder = new EchoResponder();

let session;
let busy = false;

// 音声：初期はオフ。設定は hitori-asakai:settings に保存する
const duck = $("duck");
const voiceBtn = $("voice-btn");
const talk = (on) => duck.classList.toggle("talking", on);
let voiceOn = !!storage.loadSettings().voice;
const updateVoiceNotice = () => ($("voice-notice").hidden = !voiceOn || speaker.hasVoice());
const speaker = createSpeaker({ onStart: () => talk(true), onStop: () => talk(false), onVoices: updateVoiceNotice });
const canSpeak = () => voiceOn && speaker.hasVoice();

function updateVoice() {
  voiceBtn.hidden = !speaker.supported;
  voiceBtn.textContent = voiceOn ? "🔊" : "🔇";
  voiceBtn.setAttribute("aria-pressed", String(voiceOn));
  voiceBtn.title = "音声の読み上げ（" + (voiceOn ? "オン" : "オフ") + "）";
}

function lastBotText() {
  const m = session.log.filter((x) => x.who === "bot").pop();
  return m ? m.text : "";
}

function bubble(who, text, extra, box = logEl) {
  const el = document.createElement("div");
  el.className = "msg " + who + (extra ? " " + extra : "");
  el.textContent = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ボットの発言は「…」を出してから 300〜500ms 遅らせて表示する
async function showBot(messages) {
  for (const text of messages) {
    const dots = bubble("bot", "…", "typing");
    talk(true);
    await wait(300 + Math.random() * 200);
    dots.remove();
    bubble("bot", text);
    talk(speaker.talking()); // 読み始めたら onStart で再び口が動く
    if (canSpeak()) speaker.speak(text);
  }
}

function updateInput() {
  const done = isDone(session);
  input.disabled = done || busy;
  sendBtn.disabled = done || busy;
  input.placeholder = done ? "今日の朝会は終わりました" : "ここに入力（Enter で送信、Shift+Enter で改行）";
}

async function run(text) {
  const r = step(session, text, responder);
  if (r.session === session) return false;
  session = r.session;
  storage.saveSession(session);
  busy = true;
  updateInput();
  try {
    await showBot(r.botMessages);
  } finally {
    busy = false;
    updateInput();
  }
  return true;
}

async function start() {
  const today = localDateStr();
  session = storage.loadSession(today) || createSession(today, storage.loadSession(prevDateStr(today)));
  $("date").textContent = "朝会 " + today;
  $("notice").hidden = storage.isPersistent();
  logEl.textContent = "";
  showPanel(null);
  session.log.forEach((m) => bubble(m.who, m.text));
  updateInput();
  if (!session.log.length) await run("");
  if (!isDone(session)) input.focus();
}

async function send() {
  const text = input.value.trim();
  if (!text || busy || isDone(session)) return;
  // タップ（Enter）の処理の中で呼ぶ。前の読み上げを止め、次の読み上げを許可させる
  speaker.cancel();
  if (canSpeak()) speaker.unlock();
  input.value = "";
  autosize();
  bubble("me", text);
  await run(text);
  if (!isDone(session)) input.focus();
}

function autosize() {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + 2 + "px";
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  send();
});

input.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;
  if (e.isComposing || e.keyCode === 229) return; // IME 変換確定の Enter は送信しない
  e.preventDefault();
  send();
});

input.addEventListener("input", autosize);

$("reset-btn").addEventListener("click", () => {
  if (busy || !confirm("今日の会話を最初からやり直しますか？（編集した内容は消え、メモは残ります）")) return;
  const { date, memo } = session;
  storage.removeSession(date);
  if (memo) storage.saveSession({ ...createSession(date, storage.loadSession(prevDateStr(date))), memo });
  start();
});

// ---- パネル（使い方・カレンダー・編集）。開いている間は会話ログと入力欄を隠す ----
let panel = null;

function showPanel(name) {
  panel = name;
  Object.keys(panels).forEach((k) => (panels[k].hidden = k !== name));
  logEl.hidden = !!name;
  form.hidden = !!name;
  duck.parentNode.hidden = !!name; // パネル中はアヒルを隠して場所を空ける
  speaker.cancel();
  if (name) panels[name].scrollTop = 0;
  else logEl.scrollTop = logEl.scrollHeight;
}

function closePanel() {
  showPanel(null);
  if (!isDone(session)) input.focus();
}

const fmtDate = (d) => Number(d.slice(5, 7)) + "月" + Number(d.slice(8)) + "日";

// 今日なら会話中の session、それ以外は保存済みのもの（なければ空の記録を作る）
function getDay(date) {
  if (date === session.date) return session;
  return storage.loadSession(date) || createSession(date, null);
}

function putDay(s) {
  if (s.date === session.date) session = s;
  storage.saveSession(s);
}

// 使い方：会話例は実際の core と Responder に例の回答を流して作る
function renderSample() {
  const box = $("sample");
  if (box.firstChild) return;
  const r = new EchoResponder({ random: () => 0 });
  let s = step(createSession(localDateStr(), SAMPLE.prev), "", r).session;
  SAMPLE.inputs.forEach((text) => (s = step(s, text, r).session));
  s.log.forEach((m) => bubble(m.who, m.text, "", box));
}

$("help-btn").addEventListener("click", () => {
  if (panel === "help") return closePanel();
  renderSample();
  showPanel("help");
});
["help-close", "help-close2", "cal-close"].forEach((id) => $(id).addEventListener("click", closePanel));

voiceBtn.addEventListener("click", () => {
  voiceOn = !voiceOn;
  const settings = storage.loadSettings();
  settings.voice = voiceOn;
  storage.saveSettings(settings);
  updateVoice();
  speaker.cancel();
  updateVoiceNotice();
  // クリックの処理の中で読むので、最初の1回でも鳴る
  if (canSpeak()) speaker.speak(lastBotText());
});

duck.addEventListener("click", () => {
  speaker.cancel();
  if (canSpeak()) speaker.speak(lastBotText());
  else if (!busy) {
    talk(true);
    setTimeout(() => talk(false), 800);
  }
});

// ---- 編集 ----
let editDate = null;
let editFrom = null; // 閉じたときに戻る先（"calendar" か null）

function openEditor(date, from) {
  editDate = date;
  editFrom = from;
  $("editor-title").textContent = fmtDate(date) + "の朝会を編集";
  editText.value = contentOf(getDay(date));
  editMsg.textContent = "";
  showPanel("editor");
}

$("edit-btn").addEventListener("click", () => (panel === "editor" ? closePanel() : openEditor(session.date, null)));

$("editor-close").addEventListener("click", () => {
  if (editText.value !== contentOf(getDay(editDate)) && !confirm("保存していない変更があります。閉じますか？")) return;
  if (editFrom === "calendar") openCalendar(editDate);
  else closePanel();
});

$("save-btn").addEventListener("click", () => {
  putDay({ ...getDay(editDate), edited: editText.value });
  editMsg.textContent = "保存しました";
});

$("regen-btn").addEventListener("click", () => {
  if (!confirm("編集した内容を消して、会話の内容から作り直しますか？")) return;
  const s = { ...getDay(editDate), edited: null };
  putDay(s);
  editText.value = toMarkdown(s);
  editMsg.textContent = "会話の内容から作り直しました";
});

$("copy-btn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editText.value);
    editMsg.textContent = "コピーしました";
  } catch (e) {
    editText.focus();
    editText.select();
    editText.setSelectionRange(0, editText.value.length);
    editMsg.textContent = "選択された文字をコピーしてください";
  }
});

$("download-btn").addEventListener("click", () => {
  const blob = new Blob([editText.value], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = exportFilename({ date: editDate });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  editMsg.textContent = "ダウンロードしました";
});

// ---- カレンダー ----
let calY;
let calM;
let calSel;

function openCalendar(date) {
  [calY, calM] = date.split("-").map(Number);
  selectDay(date);
  showPanel("calendar");
}

function renderCalendar() {
  $("cal-month").textContent = calY + "年" + calM + "月";
  const today = localDateStr();
  const saved = storage.listSessionDates();
  const grid = $("cal-grid");
  grid.textContent = "";
  monthGrid(calY, calM).forEach((d) => {
    const b = document.createElement("button");
    b.type = "button";
    if (!d) {
      b.className = "blank";
      b.disabled = true;
    } else {
      b.textContent = Number(d.slice(8));
      b.dataset.date = d;
      b.disabled = d > today; // 未来の日は選べない
      const s = saved.has(d) ? getDay(d) : null;
      b.classList.toggle("has", !!s && hasContent(s));
      b.classList.toggle("today", d === today);
      b.classList.toggle("sel", d === calSel);
      b.setAttribute("aria-label", fmtDate(d) + (s && hasContent(s) ? "（記録あり）" : ""));
    }
    grid.appendChild(b);
  });
}

function selectDay(date) {
  calSel = date;
  const s = getDay(date);
  $("day-title").textContent = fmtDate(date) + (date === localDateStr() ? "（今日）" : "");
  // メモだけの日は、空のテンプレートではなく「記録はありません」と出す
  const body = hasContent({ ...s, memo: "" }) ? contentOf(s) : "";
  $("day-content").textContent = body || "記録はありません";
  memoEl.value = s.memo || "";
  $("day-msg").textContent = "";
  renderCalendar();
}

$("cal-btn").addEventListener("click", () => (panel === "calendar" ? closePanel() : openCalendar(session.date)));

$("cal-grid").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-date]");
  if (b && !b.disabled) selectDay(b.dataset.date);
});

[["cal-prev", -1], ["cal-next", 1]].forEach(([id, delta]) =>
  $(id).addEventListener("click", () => {
    [calY, calM] = addMonth(calY, calM, delta);
    renderCalendar();
  })
);

$("memo-save").addEventListener("click", () => {
  putDay({ ...getDay(calSel), memo: memoEl.value });
  selectDay(calSel);
  $("day-msg").textContent = "メモを保存しました";
});

$("day-edit").addEventListener("click", () => openEditor(calSel, "calendar"));

// 開いたまま日付をまたいだら新しい日の朝会にする
document.addEventListener("visibilitychange", () => {
  if (document.hidden) speaker.cancel();
  if (!document.hidden && !busy && session && session.date !== localDateStr()) start();
});

updateVoice();
start();
