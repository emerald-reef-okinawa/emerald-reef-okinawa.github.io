# 空き状況カレンダー用 Cloudflare Worker セットアップ手順

予約カレンダーの「空き状況」を、無料の外部CORSプロキシ（不安定）ではなく
**自前の安定したエンドポイント**から取得するための設定です。

- 費用: **無料**（Cloudflare無料枠 = 1日10万リクエスト。当サイトには十分）
- 所要時間: 約5分
- 効果: カレンダーが「チェック中」のまま固まる問題をほぼ解消

---

## 手順

### 1. Cloudflareアカウントを作成（無料）
[https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) でメールアドレス登録するだけ。
（独自ドメインの登録は不要です）

### 2. Worker を作成
1. ダッシュボード左メニューの **「Workers & Pages」** を開く
2. **「Create application」→「Create Worker」** をクリック
3. 名前を入力（例: `er-calendar`）→ **「Deploy」**

### 3. コードを貼り付けてデプロイ
1. デプロイ後の画面で **「Edit code」** をクリック
2. エディタの中身を**すべて削除**し、このリポジトリの
   [`cloudflare-worker.js`](cloudflare-worker.js) の中身を**全部コピペ**
3. 右上の **「Deploy」** をクリック

### 4. URLをコピー
デプロイ完了画面に表示される URL をコピーします。
例: `https://er-calendar.あなたの名前.workers.dev`

ブラウザでそのURLを開いて、`BEGIN:VCALENDAR` で始まるテキストが表示されれば成功です。

### 5. サイトに設定
`index.html` の次の行に、コピーしたURLを貼り付けます。

```js
const GCAL_WORKER_URL = '';
```
↓
```js
const GCAL_WORKER_URL = 'https://er-calendar.あなたの名前.workers.dev';
```

そのあと、ターミナルで多言語ページを再生成します。

```bash
node build-i18n.js
```

最後に変更をコミット＆プッシュすれば反映されます。

> **このURLの貼り付け＋再生成は、URLさえ教えていただければこちらで対応できます。**
> 手順4でコピーしたURLを送ってください。

---

## 補足

- **動作の仕組み**: Worker未設定（URLが空）でも、従来どおり無料CORSプロキシで動作します。
  URLを設定すると Worker を**最優先**で使い、失敗時のみ無料プロキシにフォールバックします。
- **秘密情報ではありません**: Worker内のカレンダーIDは「公開カレンダー」のIDで、
  もともと公開情報です。対象カレンダーを固定しているため、第三者が任意URLの取得に
  悪用すること（オープンプロキシ化）はできません。
- **セキュリティを高めたい場合**: `cloudflare-worker.js` の
  `'Access-Control-Allow-Origin': '*'` を
  `'Access-Control-Allow-Origin': 'https://emerald-reef-okinawa.com'` に変更すると、
  自サイトからのみ利用可能になります（任意）。
