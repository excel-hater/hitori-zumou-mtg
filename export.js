// セッションを Markdown に変換
const oneLine = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .join(" / ");

export function toMarkdown(session) {
  const a = session.answers || {};
  const lines = [
    `# 朝会 ${session.date}`,
    "",
    `- 昨日：${oneLine(a.yesterday)}`,
    "- 今日：",
    ...(a.today || []).map((t) => `  - [ ] ${t}`),
    `- 詰まり：${oneLine(a.blocker)}`,
    `- 気分：${a.mood ? `${a.mood}/5` : ""}`,
  ];
  return lines.join("\n") + "\n";
}

// その日の朝会の内容。自分で編集して保存したものを優先する
export function contentOf(session) {
  return session.edited != null ? session.edited : toMarkdown(session);
}

// カレンダーで印を付けるか（あいさつだけの日は付けない）
export function hasContent(session) {
  const a = session.answers || {};
  return !!(session.edited || session.memo || a.yesterday || (a.today && a.today.length) || a.blocker || a.mood);
}

export function exportFilename(session) {
  return `asakai-${session.date}.md`;
}
