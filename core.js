// 状態機械（純粋関数のみ。DOM と localStorage に触らない）
import { STEPS } from "./script.js";

const pad = (n) => String(n).padStart(2, "0");

// toISOString() は UTC になるのでローカル時刻の年月日から組み立てる
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function prevDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d - 1));
}

export function createSession(dateStr, prevSession) {
  const prevToday = (prevSession && prevSession.answers && prevSession.answers.today) || [];
  return {
    date: dateStr,
    stepIndex: 0,
    answers: { yesterday: "", today: [], blocker: "", mood: null },
    log: [],
    prevToday: prevToday.slice(),
  };
}

export function currentStep(session) {
  return STEPS[Math.min(session.stepIndex, STEPS.length - 1)];
}

export function isDone(session) {
  return !!currentStep(session).final;
}

function fill(text, session) {
  return text
    .replace("{prevToday}", session.prevToday.join(" / "))
    .replace("{today}", session.answers.today.map((t, i) => `${i + 1}. ${t}`).join("\n"));
}

export function currentPrompt(session) {
  return fill(currentStep(session).prompt, session);
}

// 現在のステップで表示するメッセージ（前置き＋質問）
function promptMessages(session) {
  const s = currentStep(session);
  const out = [];
  if (s.preface && s.id === "yesterday" && session.prevToday.length) {
    out.push(fill(s.preface, session));
  }
  out.push(currentPrompt(session));
  return out;
}

export function splitToday(text, max = 3) {
  return String(text)
    .split(/\r?\n|[、,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function parseMood(text) {
  const s = String(text)
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  return /^[1-5]$/.test(s) ? Number(s) : null;
}

// 入力を解釈する。不正なら undefined
function parseInput(s, text) {
  if (s.input === "list") {
    const items = splitToday(text, s.max);
    return items.length ? items : undefined;
  }
  if (s.input === "mood") {
    const m = parseMood(text);
    return m === null ? undefined : m;
  }
  return text;
}

// 新しい session と、表示すべきボットの発言を返す（元の session は書き換えない）
export function step(session, userText, responder, now = Date.now()) {
  const s = currentStep(session);
  if (s.final) return { session, botMessages: [] };

  const next = {
    ...session,
    answers: { ...session.answers, today: session.answers.today.slice() },
    log: session.log.slice(),
  };
  const botMessages = [];
  const say = (text) => {
    botMessages.push(text);
    next.log.push({ who: "bot", text, t: now });
  };

  if (s.input) {
    const text = String(userText == null ? "" : userText).trim();
    if (!text) return { session, botMessages: [] };
    next.log.push({ who: "me", text, t: now });
    const value = parseInput(s, text);
    if (value === undefined) {
      say(s.retry || currentPrompt(session));
      return { session: next, botMessages };
    }
    next.answers[s.id] = value;
    say(responder.respond(s.id, text, next));
    next.stepIndex += 1;
  } else if (session.log.length) {
    // 入力なしのステップで既に表示済みなら先へ進むだけ
    next.stepIndex += 1;
  }

  // 入力待ちか done に着くまで、入力なしのステップを流す
  for (;;) {
    promptMessages(next).forEach(say);
    const cur = currentStep(next);
    if (cur.input || cur.final) break;
    next.stepIndex += 1;
  }
  return { session: next, botMessages };
}
