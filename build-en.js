/* ============================================================
   build-en.js — index.html から英語版 en.html を自動生成する
   ------------------------------------------------------------
   使い方:  node build-en.js
   index.html を更新したら、このコマンドを実行して en.html を再生成する。
   （en.html は手で編集しない。必ずこのスクリプトで生成する）

   なぜ en.html をルート直下に置くか:
     画像などのアセットは相対パス（例: skindiving.webp）で参照しているため、
     /en/ サブフォルダに置くと /en/skindiving.webp を探して全画像が壊れる。
     ルート直下の en.html なら相対パスがそのまま機能する。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'index.html');
const OUT = path.join(__dirname, 'en.html');

let html = fs.readFileSync(SRC, 'utf8');

/* 置換定義: {find, replace, required(省略時true), all(全件置換)} */
const edits = [
  /* --- <html> 言語 --- */
  { find: '<html lang="ja">', replace: '<html lang="en">' },

  /* --- <title> --- */
  { find: '<title>エメラルドリーフ沖縄 | 沖縄シュノーケル・青の洞窟・スキンダイビング体験</title>',
    replace: '<title>Emerald Reef Okinawa | Private Snorkeling, Blue Cave &amp; Sea Turtle Tours</title>' },

  /* --- meta description --- */
  { find: '<meta name="description" content="沖縄の透き通ったエメラルドグリーンの海で完全貸切シュノーケル・青の洞窟・スキンダイビング体験。完全送迎付き・写真最大20枚プレゼント。那覇〜恩納村対応。" />',
    replace: '<meta name="description" content="Emerald Reef Okinawa runs fully private snorkeling, Blue Cave and sea turtle tours in Okinawa\'s clear emerald sea. Free hotel transfer and up to 20 photos included. Serving Naha to Onna Village." />' },

  /* --- meta keywords --- */
  { find: '<meta name="keywords" content="沖縄 シュノーケル, 青の洞窟 シュノーケル, 沖縄 マリンアクティビティ, スキンダイビング 沖縄, 完全貸切 ツアー, 沖縄 体験 観光, okinawa snorkeling, blue cave okinawa" />',
    replace: '<meta name="keywords" content="emerald reef okinawa, okinawa snorkeling, blue cave okinawa, okinawa marine activities, skin diving okinawa, private snorkeling tour okinawa, naha snorkeling tour, sea turtle snorkeling okinawa" />' },

  /* --- canonical（自分自身=/en.html を指す） --- */
  { find: '<link rel="canonical" href="https://emerald-reef-okinawa.com/" />',
    replace: '<link rel="canonical" href="https://emerald-reef-okinawa.com/en.html" />' },

  /* --- OGP --- */
  { find: '<meta property="og:title" content="エメラルドリーフ沖縄 | 沖縄シュノーケル・青の洞窟体験" />',
    replace: '<meta property="og:title" content="Emerald Reef Okinawa | Private Snorkeling &amp; Blue Cave Tours" />' },
  { find: '<meta property="og:description" content="沖縄の透き通ったエメラルドグリーンの海へ。完全貸切・完全送迎・写真最大20枚付き。那覇〜恩納村対応。" />',
    replace: '<meta property="og:description" content="Dive into Okinawa\'s clear emerald sea. Fully private tours, free hotel transfer and up to 20 photos included. Serving Naha to Onna Village." />' },
  { find: '<meta property="og:url" content="https://emerald-reef-okinawa.com" />',
    replace: '<meta property="og:url" content="https://emerald-reef-okinawa.com/en.html" />' },
  { find: '<meta property="og:locale" content="ja_JP" />',
    replace: '<meta property="og:locale" content="en_US" />' },
  { find: '<meta property="og:locale:alternate" content="en_US" />',
    replace: '<meta property="og:locale:alternate" content="ja_JP" />' },

  /* --- Twitter --- */
  { find: '<meta name="twitter:title" content="エメラルドリーフ沖縄 | 沖縄シュノーケル・青の洞窟体験" />',
    replace: '<meta name="twitter:title" content="Emerald Reef Okinawa | Private Snorkeling &amp; Blue Cave Tours" />' },
  { find: '<meta name="twitter:description" content="沖縄の透き通ったエメラルドグリーンの海へ。完全貸切・完全送迎・写真最大20枚付き。" />',
    replace: '<meta name="twitter:description" content="Dive into Okinawa\'s clear emerald sea. Fully private tours, free hotel transfer and up to 20 photos included." />' },

  /* --- 構造化データ: 言語を en に --- */
  { find: '"inLanguage": "ja"', replace: '"inLanguage": "en"', all: true },

  /* --- 初期表示言語を英語に固定（localStorageに依存せず必ず英語で表示） --- */
  { find: "let curLang = localStorage.getItem('lang') || 'ja';",
    replace: "let curLang = 'en';  /* en.html は常に英語で初期表示（build-en.js が設定） */" },
];

let applied = 0;
for (const e of edits) {
  const required = e.required !== false;
  if (e.all) {
    if (!html.includes(e.find)) {
      if (required) throw new Error('[build-en] 置換対象が見つかりません: ' + e.find);
      console.warn('[build-en] (任意) 見つからずスキップ: ' + e.find);
      continue;
    }
    const n = html.split(e.find).length - 1;
    html = html.split(e.find).join(e.replace);
    applied += n;
    console.log(`[build-en] OK x${n}: ${e.find.slice(0, 50)}`);
  } else {
    const idx = html.indexOf(e.find);
    if (idx === -1) {
      if (required) throw new Error('[build-en] 置換対象が見つかりません:\n  ' + e.find);
      console.warn('[build-en] (任意) 見つからずスキップ: ' + e.find.slice(0, 50));
      continue;
    }
    if (html.indexOf(e.find, idx + 1) !== -1) {
      throw new Error('[build-en] 置換対象が複数あり曖昧です: ' + e.find.slice(0, 50));
    }
    html = html.replace(e.find, e.replace);
    applied++;
    console.log(`[build-en] OK: ${e.find.slice(0, 50)}`);
  }
}

/* 自動生成の目印（編集禁止コメント）を <head> 直後に挿入 */
html = html.replace('<head>',
  '<head>\n  <!-- ⚠ このファイルは build-en.js が index.html から自動生成します。手で編集しないこと。 -->');

fs.writeFileSync(OUT, html, 'utf8');
console.log(`\n[build-en] 完了: ${applied} 箇所を置換し en.html を生成しました。`);
