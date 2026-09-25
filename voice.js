// 音声読み上げ（Web Speech API）。DOM には触らない
// 外部通信ゼロのため、端末内で合成する日本語の声（localService）だけを使う

export function pickVoice(voices) {
  return (voices || []).find((v) => v.localService && /^ja/i.test(v.lang)) || null;
}

export function createSpeaker({ onStart, onStop, onVoices }) {
  const synth = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
  // 端末内の声は読み込み直後には出てこないことがある
  if (synth && synth.addEventListener && onVoices) synth.addEventListener("voiceschanged", onVoices);
  const keep = []; // 読み上げ中に回収されて onend が来なくなるのを防ぐ
  let timer = 0;

  // 声は後から増えることがあるので毎回選び直す
  const voice = () => (synth ? pickVoice(synth.getVoices()) : null);

  // onend は来ないことがあるので、speaking を見て終わりを判定する
  function watch() {
    if (timer) return;
    onStart();
    timer = setInterval(() => {
      if (synth.speaking || synth.pending) return;
      clearInterval(timer);
      timer = 0;
      keep.length = 0;
      onStop();
    }, 250);
  }

  function utter(text, v) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.voice = v;
    keep.push(u);
    return u;
  }

  return {
    supported: !!synth,
    hasVoice: () => !!voice(),
    talking: () => timer !== 0,
    speak(text) {
      const v = voice();
      if (!v) return;
      const u = utter(text, v);
      u.onstart = watch;
      synth.speak(u);
    },
    cancel() {
      if (synth) synth.cancel();
    },
    // タップの処理の中で呼び、以降の読み上げを許可させる（mac の Safari 向け）
    unlock() {
      const v = voice();
      if (!v) return;
      const u = utter(" ", v);
      u.volume = 0;
      synth.speak(u);
    },
  };
}
