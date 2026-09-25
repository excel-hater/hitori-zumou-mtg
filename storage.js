// localStorage ラッパ。使えないときはメモリに退避し、例外は外に出さない
const PREFIX = "hitori-asakai:";
const memory = new Map();
let persistent = probe();

function probe() {
  try {
    const k = PREFIX + "probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}

function read(key) {
  if (persistent) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      if (v !== null) return JSON.parse(v);
    } catch (e) {
      // 壊れた値や読み出し失敗はメモリ側を見る
    }
  }
  return memory.has(key) ? JSON.parse(memory.get(key)) : null;
}

function write(key, value) {
  const json = JSON.stringify(value);
  memory.set(key, json);
  if (!persistent) return;
  try {
    localStorage.setItem(PREFIX + key, json);
  } catch (e) {
    persistent = false; // 容量超過など。以降はメモリのみ
  }
}

function remove(key) {
  memory.delete(key);
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    // 何もしない
  }
}

export const isPersistent = () => persistent;
export const loadSession = (date) => read("session:" + date);
export const saveSession = (session) => write("session:" + session.date, session);
export const removeSession = (date) => remove("session:" + date);
export const loadSettings = () => read("settings") || {};
export const saveSettings = (settings) => write("settings", settings);
