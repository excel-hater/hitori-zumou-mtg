// DOM 操作、イベント、保存の呼び出し（ブラウザ専用）
import { createSession, step, isDone, localDateStr, prevDateStr } from "./core.js";
import { EchoResponder } from "./responder.js";
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

// app.js は respond() を持つオブジェクトにだけ依存する
const responder = new EchoResponder();

let session;
let busy = false;

function bubble(who, text, extra) {
  const el = document.createElement("div");
  el.className = "msg " + who + (extra ? " " + extra : "");
  el.textContent = text;
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
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

$("export-btn").addEventListener("click", () => {
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
