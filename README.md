# ひとり朝会

一人で仕事をする人が、毎朝ボットと「朝会」をするための Web アプリです。
決まった順番で質問され、答えるとオウム返しで応じます。進行がいつも同じであること自体に価値がある、という考えで作っています。

公開 URL: https://excel-hater.github.io/hitori-zumou-mtg/

## 使い方

1. ページを開くと朝会が始まります
2. 質問に答えます（Enter で送信、Shift+Enter で改行。送信ボタンでも送れます）
   - 昨日やったこと
   - 今日やること（3つまで。1行に1つか、「、」や「,」で区切る）
   - 詰まっていること（なければ「なし」）
   - 今の気分（1〜5。全角数字でも可）
3. 最後に今日やることを復唱して終わります
4. 「書き出し」から Markdown をコピー、またはダウンロード（`asakai-YYYY-MM-DD.md`）できます

- 🔇 を押して 🔊 にすると、アヒルが口をパクパクさせながら質問を読み上げます（はじめはオフ。アヒルをタップするともう一度読みます）
  - 端末に入っている日本語の声（macOS の Kyoko、Windows の Haruka など）だけを使い、文字を外部に送りません
  - 日本語の声がない端末では、読み上げずに口だけ動きます
- 「使い方」で会話の例と、書き出し・記録の保存についての説明を見られます
- 1日1セッションです。途中でページを閉じたりリロードしても続きから再開します
- 前日の記録があれば、最初に「昨日の予定」を表示します
- 「やり直し」で当日の朝会を最初からやり直せます（確認あり）
- 記録はこのブラウザの localStorage にだけ保存され、外部には送信しません。プライベートブラウズなどで保存できないときは、画面上部に「このブラウザでは記録が保存されません」と表示されます（会話は最後まで進められます）

## 特徴

- ビルド不要の素の HTML / CSS / JavaScript（ES2020 まで、ES Modules）
- 外部通信ゼロ（CDN・Web フォント・解析なし）。合計 約28KB
- 対応ブラウザ：iPadOS 15 以降の Safari、Chrome 100 以降

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面の骨組み |
| `style.css` | スタイル（ライト／ダークは `prefers-color-scheme`） |
| `app.js` | DOM 操作、イベント、保存の呼び出し（ブラウザ専用） |
| `core.js` | 状態機械（純粋関数のみ） |
| `script.js` | 朝会の質問定義と、使い方で見せる会話例の回答（データのみ） |
| `responder.js` | 返答生成（`EchoResponder`） |
| `storage.js` | localStorage ラッパ（使えなければメモリに退避） |
| `voice.js` | 音声の読み上げ（端末内の日本語の声だけを使う） |
| `export.js` | セッションを Markdown に変換 |
| `test/*.test.js` | `node --test` 用のテスト |

返答は `respond(stepId, userText, session) -> string` を持つオブジェクトなら何でも差し替えられます（`app.js` の `responder`）。

## ローカルで動かす

ES Modules は `file://` では動かないので、HTTP サーバ経由で開きます。

```sh
python3 -m http.server 8000
# http://localhost:8000/ を開く
```

## テスト

依存パッケージはありません。Node.js 22 以降で:

```sh
node --test
```

## GitHub Pages で公開する

リポジトリのルートをそのまま公開します（Actions は使いません。`.nojekyll` を置いてあります）。

1. GitHub のリポジトリを開き、**Settings → Pages**
2. **Build and deployment** の Source で **Deploy from a branch** を選ぶ
3. Branch を **main**、フォルダを **/ (root)** にして **Save**
4. 1〜2 分後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で開けます

`gh` CLI が使える場合は次の1行でも設定できます。

```sh
gh api repos/{owner}/{repo}/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

## ライセンス

MIT
