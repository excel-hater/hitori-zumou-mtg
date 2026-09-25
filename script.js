// 朝会の質問定義（データのみ）
// input: null = 入力なしで次へ / "text" 自由文 / "list" 分割して最大 max 件 / "mood" 1〜5
// {prevToday} {today} は core.js が差し込む
export const STEPS = [
  { id: "greet", prompt: "おはようございます。朝会を始めましょう", input: null },
  {
    id: "yesterday",
    preface: "昨日の予定：{prevToday}",
    prompt: "昨日やったことは？",
    input: "text",
  },
  {
    id: "today",
    prompt: "今日やることを3つまで。1行に1つか、読点で区切ってください",
    input: "list",
    max: 3,
    retry: "やることを1つ以上書いてください",
  },
  {
    id: "blocker",
    prompt: "詰まっていること、気がかりなことは？（なければ『なし』）",
    input: "text",
  },
  {
    id: "mood",
    prompt: "今の気分を1〜5で",
    input: "mood",
    retry: "1〜5の数字で教えてください",
  },
  {
    id: "recap",
    prompt: "今日やること：\n{today}\n17時にまた開いてね",
    input: null,
  },
  { id: "done", prompt: "今日の朝会は終わりました", input: null, final: true },
];

// 「使い方」で見せる会話例の回答。実際の core.js と Responder に流して表示する
export const SAMPLE = {
  prev: { answers: { today: ["見積書の作成", "経費の精算"] } },
  inputs: [
    "見積書を作ってA社に送った",
    "請求書の発行\nB社への返信\n週報を書く",
    "B社からの返事がまだ来ない",
    "4",
  ],
};
