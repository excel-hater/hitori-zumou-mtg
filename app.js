// DOM 操作、イベント、保存の呼び出し（ブラウザ専用）
import { createSession, step, isDone, localDateStr, prevDateStr } from "./core.js";
import { EchoResponder } from "./responder.js";
import { SAMPLE } from "./script.js";
import { toMarkdown, exportFilename } from "./export.js";
import * as storage from "./storage.js";

const $ = (id) => document.getElementById(id);
const logEl = $("log");
const form = $("form");
const input = $("text");
const sendBtn = $("send");
const exportBox = $("export");
const exportText = $("export-text");
const exportMsg = $("export-msg");
const helpBox = $("help");

// app.js は respond() を持つオブジェクトにだけ依存する
const responder = new EchoResponder();

let session;
let busy = false;

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
    await wait(300 + Math.random() * 200);
    dots.remove();
    bubble("bot", text);
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
  exportBox.hidden = true;
  showHelp(false);
  session.log.forEach((m) => bubble(m.who, m.text));
  updateInput();
  if (!session.log.length) await run("");
  if (!isDone(session)) input.focus();
}

async function send() {
  const text = input.value.trim();
  if (!text || busy || isDone(session)) return;
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
  if (busy || !confirm("今日の朝会を最初からやり直しますか？")) return;
  storage.removeSession(session.date);
  start();
});

// 使い方：会話例は実際の core と Responder に例の回答を流して作る
function renderSample() {
  const box = $("sample");
  if (box.firstChild) return;
  const r = new EchoResponder({ random: () => 0 });
  let s = step(createSession(localDateStr(), SAMPLE.prev), "", r).session;
  SAMPLE.inputs.forEach((text) => (s = step(s, text, r).session));
  s.log.forEach((m) => bubble(m.who, m.text, "", box));
}

function showHelp(open) {
  helpBox.hidden = !open;
  logEl.hidden = open;
  form.hidden = open;
  if (open) {
    renderSample();
    exportBox.hidden = true;
    helpBox.scrollTop = 0;
  } else {
    logEl.scrollTop = logEl.scrollHeight;
  }
}

$("help-btn").addEventListener("click", () => showHelp(helpBox.hidden));
["help-close", "help-close2"].forEach((id) =>
  $(id).addEventListener("click", () => {
    showHelp(false);
    if (!isDone(session)) input.focus();
  })
);

$("export-btn").addEventListener("click", () => {
  showHelp(false);
  exportText.value = toMarkdown(session);
  exportMsg.textContent = "";
  exportBox.hidden = false;
});

$("close-btn").addEventListener("click", () => {
  exportBox.hidden = true;
});

$("copy-btn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(exportText.value);
    exportMsg.textContent = "コピーしました";
  } catch (e) {
    exportText.focus();
    exportText.select();
    exportText.setSelectionRange(0, exportText.value.length);
    exportMsg.textContent = "選択された文字をコピーしてください";
  }
});

$("download-btn").addEventListener("click", () => {
  const blob = new Blob([exportText.value], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = exportFilename(session);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  exportMsg.textContent = "ダウンロードしました";
});

// 開いたまま日付をまたいだら新しい日の朝会にする
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !busy && session && session.date !== localDateStr()) start();
});

start();
