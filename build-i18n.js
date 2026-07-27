/* ============================================================
   build-i18n.js — index.html から各言語の静的ページを自動生成する
   ------------------------------------------------------------
   使い方:  node build-i18n.js
   生成物:  en.html / zh.html / ko.html （ルート直下）
   index.html を更新したら、このコマンドを実行して再生成する。
   （生成された *.html は手で編集しない。必ずこのスクリプトで生成する）

   なぜルート直下に置くか:
     画像などのアセットは相対パス（例: skindiving.webp）で参照しているため、
     /en/ 等のサブフォルダに置くと /en/skindiving.webp を探して全画像が壊れる。
     ルート直下の en.html / zh.html / ko.html なら相対パスがそのまま機能する。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'index.html');

/* 各言語の設定。head 内の文言は静的クローラ向け。
   （JS実行後は T[lang].page_title 等で上書きされるが、両方とも同じ言語になる） */
const LANGS = [
  {
    code: 'en', file: 'en.html', htmlLang: 'en', ogLocale: 'en_US', brand: 'EMERALD REEF OKINAWA',
    title: 'Emerald Reef Okinawa | Private Snorkeling, Blue Cave &amp; Sea Turtle Tours',
    desc: 'Emerald Reef Okinawa runs fully private snorkeling, Blue Cave and sea turtle tours in Okinawa\'s clear emerald sea. Free hotel transfer and free photos included. Serving Naha to Onna Village.',
    keywords: 'emerald reef okinawa, okinawa snorkeling, blue cave okinawa, okinawa marine activities, skin diving okinawa, private snorkeling tour okinawa, naha snorkeling tour, sea turtle snorkeling okinawa',
    ogTitle: 'Emerald Reef Okinawa | Private Snorkeling &amp; Blue Cave Tours',
    ogDesc: 'Dive into Okinawa\'s clear emerald sea. Fully private tours, free hotel transfer and free photos included. Serving Naha to Onna Village.'
  },
  {
    code: 'zh', file: 'zh.html', htmlLang: 'zh-Hans', ogLocale: 'zh_CN', brand: '翡翠礁冲绳 Emerald Reef Okinawa',
    title: '翡翠礁冲绳 Emerald Reef Okinawa | 包场浮潜・蓝洞・海龟体验',
    desc: '翡翠礁冲绳（Emerald Reef Okinawa）在冲绳清澈的翡翠海域提供完全包场浮潜、蓝洞与海龟体验。含免费接送、免费赠送照片。那霸〜恩纳村对应。',
    keywords: 'emerald reef okinawa, 冲绳浮潜, 蓝洞 冲绳, 冲绳海上活动, 自由潜水 冲绳, 包场浮潜 冲绳, 那霸浮潜, 海龟浮潜 冲绳',
    ogTitle: '翡翠礁冲绳 Emerald Reef Okinawa | 包场浮潜・蓝洞体验',
    ogDesc: '畅游冲绳清澈的翡翠海域。完全包场・免费接送・免费赠送照片。那霸〜恩纳村对应。'
  },
  {
    code: 'ko', file: 'ko.html', htmlLang: 'ko', ogLocale: 'ko_KR', brand: '에메랄드 리프 오키나와 Emerald Reef Okinawa',
    title: '에메랄드 리프 오키나와 Emerald Reef Okinawa | 전세 스노클링・블루케이브・바다거북 체험',
    desc: '에메랄드 리프 오키나와(Emerald Reef Okinawa)는 오키나와의 맑은 에메랄드빛 바다에서 완전 전세 스노클링・블루케이브・바다거북 체험을 제공합니다. 무료 픽업・사진 데이터 무료 증정. 나하〜온나손 대응.',
    keywords: 'emerald reef okinawa, 오키나와 스노클링, 블루케이브 오키나와, 오키나와 마린액티비티, 스킨다이빙 오키나와, 전세 스노클링 오키나와, 나하 스노클링, 바다거북 스노클링 오키나와',
    ogTitle: '에메랄드 리프 오키나와 | 전세 스노클링・블루케이브 체험',
    ogDesc: '오키나와의 맑은 에메랄드빛 바다로. 완전 전세・무료 픽업・사진 데이터 무료 증정. 나하〜온나손 대응.'
  }
];

const BASE = 'https://emerald-reef-okinawa.com';
const src = fs.readFileSync(SRC, 'utf8');

function applyOne(find, replace, html, { required = true, all = false } = {}) {
  if (all) {
    if (!html.includes(find)) {
      if (required) throw new Error('[build-i18n] 置換対象が見つかりません: ' + find);
      return html;
    }
    return html.split(find).join(replace);
  }
  const idx = html.indexOf(find);
  if (idx === -1) {
    if (required) throw new Error('[build-i18n] 置換対象が見つかりません:\n  ' + find);
    return html;
  }
  if (html.indexOf(find, idx + 1) !== -1) {
    throw new Error('[build-i18n] 置換対象が複数あり曖昧です: ' + find.slice(0, 60));
  }
  return html.replace(find, replace);
}

for (const L of LANGS) {
  let html = src;
  const edits = [
    ['<html lang="ja">', `<html lang="${L.htmlLang}">`],
    ['<title>エメラルドリーフ沖縄 | 沖縄シュノーケル・青の洞窟・スキンダイビング体験</title>',
      `<title>${L.title}</title>`],
    ['<meta name="description" content="沖縄の透き通ったエメラルドグリーンの海で完全貸切シュノーケル・青の洞窟・スキンダイビング体験。完全送迎付き・写真データ無料プレゼント。那覇〜恩納村対応。" />',
      `<meta name="description" content="${L.desc}" />`],
    ['<meta name="keywords" content="沖縄 シュノーケル, 青の洞窟 シュノーケル, 沖縄 マリンアクティビティ, スキンダイビング 沖縄, 完全貸切 ツアー, 沖縄 体験 観光, okinawa snorkeling, blue cave okinawa" />',
      `<meta name="keywords" content="${L.keywords}" />`],
    ['<link rel="canonical" href="https://emerald-reef-okinawa.com/" />',
      `<link rel="canonical" href="${BASE}/${L.file}" />`],
    ['<meta property="og:title" content="エメラルドリーフ沖縄 | 沖縄シュノーケル・青の洞窟体験" />',
      `<meta property="og:title" content="${L.ogTitle}" />`],
    ['<meta property="og:description" content="沖縄の透き通ったエメラルドグリーンの海へ。完全貸切・完全送迎・写真データ無料プレゼント付き。那覇〜恩納村対応。" />',
      `<meta property="og:description" content="${L.ogDesc}" />`],
    ['<meta property="og:url" content="https://emerald-reef-okinawa.com" />',
      `<meta property="og:url" content="${BASE}/${L.file}" />`],
    ['<meta property="og:locale" content="ja_JP" />',
      `<meta property="og:locale" content="${L.ogLocale}" />`],
    // 自言語の alternate を ja_JP に入れ替え（自言語が primary、日本語が alternate に）
    [`<meta property="og:locale:alternate" content="${L.ogLocale}" />`,
      '<meta property="og:locale:alternate" content="ja_JP" />'],
    ['<meta name="twitter:title" content="エメラルドリーフ沖縄 | 沖縄シュノーケル・青の洞窟体験" />',
      `<meta name="twitter:title" content="${L.ogTitle}" />`],
    ['<meta name="twitter:description" content="沖縄の透き通ったエメラルドグリーンの海へ。完全貸切・完全送迎・写真データ無料プレゼント付き。" />',
      `<meta name="twitter:description" content="${L.ogDesc}" />`],
    ['"inLanguage": "ja"', '"inLanguage": "' + L.htmlLang + '"', { all: true }],
    ["let curLang = localStorage.getItem('lang') || 'ja';",
      `let curLang = '${L.code}';  /* ${L.file} は常にこの言語で初期表示（build-i18n.js が設定） */`],
    /* 最後に実行: 残りのブランド表記（og:site_name / application-name / 構造化データの name 等）を
       その言語のブランド名に一括置換する。※必ずタイトル等の個別置換より後に置くこと。 */
    ['エメラルドリーフ沖縄', L.brand, { all: true, required: false }],
  ];

  for (const [find, replace, opts] of edits) {
    html = applyOne(find, replace, html, opts || {});
  }

  html = html.replace('<head>',
    `<head>\n  <!-- ⚠ このファイルは build-i18n.js が index.html から自動生成します。手で編集しないこと。 -->`);

  fs.writeFileSync(path.join(__dirname, L.file), html, 'utf8');
  console.log(`[build-i18n] 生成: ${L.file} (lang=${L.htmlLang})`);
}

console.log('[build-i18n] 完了。');
