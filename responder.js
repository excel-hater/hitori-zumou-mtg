// 返答生成。app.js は respond(stepId, userText, session) -> string だけに依存する
// （v2 で LLMResponder に差し替える想定）

const MAX = 30;

export function truncate(text, max = MAX) {
  const chars = Array.from(String(text).replace(/\s*\n\s*/g, " ").trim());
  return chars.length > max ? chars.slice(0, max).join("") + "…" : chars.join("");
}

const NONE = /^(なし|無し|ない|ないです|特になし|とくになし|特にない|ありません|特にありません|何もない|なにもない|none|no|nothing)$/i;

const TEMPLATES = {
  yesterday: ["{text}、お疲れさまでした", "{text}をやったんですね", "昨日は{text}。いいですね"],
  today: ["{text}ですね。了解です", "今日は{text}。いきましょう"],
  blockerNone: ["順調そうですね", "何もないのはいいことですね"],
  blocker: ["{text}が気がかりなんですね", "{text}、覚えておきましょう"],
  moodLow: ["無理せずいきましょう", "ゆっくりいきましょう"],
  moodMid: ["まずまずですね", "ふつうの日も大事です"],
  moodHigh: ["いい調子ですね", "その調子でいきましょう"],
};

export class EchoResponder {
  constructor({ random = Math.random } = {}) {
    this.random = random;
  }

  pick(list, text) {
    const i = Math.min(list.length - 1, Math.floor(this.random() * list.length));
    return list[i].replace("{text}", truncate(text));
  }

  respond(stepId, userText, session) {
    const answers = (session && session.answers) || {};
    switch (stepId) {
      case "today":
        return this.pick(TEMPLATES.today, (answers.today || []).join("、") || userText);
      case "blocker": {
        const plain = String(userText).trim().replace(/[。．.！!、\s]+$/g, "");
        return NONE.test(plain)
          ? this.pick(TEMPLATES.blockerNone)
          : this.pick(TEMPLATES.blocker, userText);
      }
      case "mood": {
        const m = answers.mood;
        return this.pick(m <= 2 ? TEMPLATES.moodLow : m >= 4 ? TEMPLATES.moodHigh : TEMPLATES.moodMid);
      }
      case "yesterday":
        return this.pick(TEMPLATES.yesterday, userText);
      default:
        return this.pick(["{text}ですね"], userText);
    }
  }
}
