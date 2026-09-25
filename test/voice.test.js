import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVoice, createSpeaker } from "../voice.js";

const v = (name, lang, localService) => ({ name, lang, localService });
const google = v("Google 日本語", "ja-JP", false);
const haruka = v("Microsoft Haruka", "ja-JP", true);
const kyoko = v("Kyoko", "ja_JP", true);
const zira = v("Microsoft Zira", "en-US", true);

test("pickVoice：端末内の日本語の声を選ぶ", () => {
  assert.equal(pickVoice([google, zira, haruka]), haruka);
});

test("pickVoice：ネット経由の声しかなければ null", () => {
  assert.equal(pickVoice([google, zira]), null);
});

test("pickVoice：ja_JP 表記も拾う", () => {
  assert.equal(pickVoice([zira, kyoko]), kyoko);
});

test("pickVoice：英語だけ・空・未定義なら null", () => {
  assert.equal(pickVoice([zira]), null);
  assert.equal(pickVoice([]), null);
  assert.equal(pickVoice(undefined), null);
});

test("speechSynthesis がない環境でも落ちない", () => {
  const sp = createSpeaker({ onStart() {}, onStop() {} });
  assert.equal(sp.supported, false);
  assert.equal(sp.hasVoice(), false);
  assert.equal(sp.talking(), false);
  assert.doesNotThrow(() => {
    sp.speak("こんにちは");
    sp.cancel();
    sp.unlock();
  });
});
