/* ============================================================
   build-blog.js — index.html のブログ記事（DEFAULT_BLOGS）を静的HTMLページに書き出す
   ------------------------------------------------------------
   使い方:  node build-blog.js   （node build-i18n.js を実行すると最後に自動で実行される）
   生成物:  blog/<記事>.html（日本語） / blog/en|zh|ko/<記事>.html / 各言語の blog/index.html
            sitemap.xml（トップ4ページ＋全記事）
   （生成された blog/ と sitemap.xml は手で編集しない。必ずこのスクリプトで生成する）

   なぜ必要か:
     サイト内のブログは JavaScript で表示しているため、検索エンジンや AI のクローラーには
     本文がほとんど見えない。記事ごとに普通の HTML ページを用意して読めるようにする。
     サイト上での見え方（モーダル表示）はこれまでどおり。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BASE = 'https://emerald-reef-okinawa.com';
const OUT = path.join(ROOT, 'blog');
const LINE_URL = 'https://lin.ee/Utszl3P';

const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const a = src.indexOf('const DEFAULT_BLOGS=[');
const b = src.indexOf('\n  ];', a);
if (a < 0 || b < 0) throw new Error('[build-blog] DEFAULT_BLOGS が見つかりません');
// eslint-disable-next-line no-eval
const BLOGS = eval(src.slice(a + 'const DEFAULT_BLOGS='.length, b + 4)).filter(p => p.published);

/* 言語ごとの設定。dir はサイトルートからのブログの置き場所、home はその言語のトップ */
const LANGS = {
  ja: { html: 'ja', dir: 'blog', home: '/', brand: 'エメラルドリーフ沖縄', blog: 'ブログ', all: '記事一覧',
        listTitle: '沖縄の海のブログ', listDesc: '沖縄シュノーケル・青の洞窟・ウミガメ・スキンダイビングについて、北谷・恩納村で完全貸切ツアーをしている現地ガイドが書いた記事の一覧です。',
        ctaTtl: '完全貸切で、沖縄の海へ', ctaTxt: 'ホテル送迎・写真データ無料。3歳から参加できます。当日・前日のご予約も空きがあれば大歓迎です。',
        book: 'ツアーと料金を見る', line: 'LINEで相談', related: 'ほかの記事', date: '公開日' },
  en: { html: 'en', dir: 'blog/en', home: '/en.html', brand: 'Emerald Reef Okinawa', blog: 'Blog', all: 'All articles',
        listTitle: 'Okinawa Sea Blog', listDesc: 'Articles on snorkeling, the Blue Cave, sea turtles and skin diving in Okinawa, written by the local guide who runs our fully private tours.',
        ctaTtl: 'A private tour, just your group', ctaTxt: 'Free hotel transfer and free photos. Ages 3 and up. Same-day and next-day bookings are welcome when we have space.',
        book: 'See tours & prices', line: 'Ask on LINE', related: 'More articles', date: 'Published' },
  zh: { html: 'zh-Hant', dir: 'blog/zh', home: '/zh.html', brand: '翡翠礁沖繩 Emerald Reef Okinawa', blog: '部落格', all: '所有文章',
        listTitle: '沖繩海洋部落格', listDesc: '由經營完全包場行程的在地嚮導撰寫，介紹沖繩浮潛、青之洞窟、海龜與自由潛水的文章。',
        ctaTtl: '完全包場，暢遊沖繩的海', ctaTxt: '含飯店接送、免費贈送照片。3歲起即可參加。有空位時也歡迎當天、前一天預約。',
        book: '查看行程與價格', line: '用LINE詢問', related: '其他文章', date: '發布日' },
  ko: { html: 'ko', dir: 'blog/ko', home: '/ko.html', brand: '에메랄드 리프 오키나와 Emerald Reef Okinawa', blog: '블로그', all: '전체 글',
        listTitle: '오키나와 바다 블로그', listDesc: '완전 전세 투어를 운영하는 현지 가이드가 쓴 오키나와 스노클링・블루케이브・바다거북・스킨다이빙 이야기입니다.',
        ctaTtl: '완전 전세로, 오키나와 바다로', ctaTxt: '호텔 픽업・사진 데이터 무료. 3세부터 참가할 수 있습니다. 자리가 있으면 당일・전날 예약도 환영합니다.',
        book: '투어와 요금 보기', line: 'LINE으로 상담', related: '다른 글', date: '게시일' }
};
const ORDER = ['ja', 'en', 'zh', 'ko'];

const slugOf = p => p.id.replace(/^b_(seo_)?/, '').replace(/_/g, '-');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => String(s).replace(/<[^>]+>/g, '');
const urlOf = (lang, slug) => `${BASE}/${LANGS[lang].dir}/${slug ? slug + '.html' : ''}`;

/* その言語で記事が全部そろっているか（足りない言語のページは作らない） */
const hasLang = (p, l) => l === 'ja' || (p.title[l] && p.excerpt[l] && p.blocks.every(bl => bl.lead[l] && bl.body[l]));

const slugs = new Set();
for (const p of BLOGS) {
  const s = slugOf(p);
  if (slugs.has(s)) throw new Error('[build-blog] 記事のURLが重複: ' + s);
  slugs.add(s);
}

const CSS = `
:root{--g-main:#007A6E;--g-dark:#005F52;--g-light:#48CAE4;--text:#1a3530;--sub:#56716b;--bg:#f6fbfa;--card:#fff;--mark:#d7f3ee;--line:#e1ece9}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Noto Sans JP','Hiragino Sans',system-ui,sans-serif;line-height:1.9;font-size:16px}
a{color:var(--g-main)}
.top{background:var(--g-dark);padding:14px 16px}.top a{color:#fff;text-decoration:none;font-family:Cinzel,serif;font-weight:700;letter-spacing:.12em;font-size:.95rem}
.wrap{max-width:760px;margin:0 auto;padding:24px 16px 64px}
.crumb{font-size:.8rem;color:var(--sub);margin-bottom:18px}.crumb a{color:var(--sub)}
h1{font-size:clamp(1.4rem,4.6vw,2rem);line-height:1.5;margin:0 0 10px}
.meta{font-size:.82rem;color:var(--sub);margin-bottom:22px}
.langs{font-size:.8rem;margin:-10px 0 22px}.langs a{margin-right:12px}
.hero{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:12px;display:block;margin-bottom:24px}
.lead{font-size:1.02rem;background:var(--card);border-left:4px solid var(--g-main);padding:14px 18px;border-radius:0 10px 10px 0}
h2{font-size:1.2rem;line-height:1.6;margin:40px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--line)}
.blk img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:10px;margin:6px 0 14px;display:block}
mark{background:linear-gradient(transparent 55%,var(--mark) 55%);color:inherit}
.cta{margin:48px 0 0;background:var(--g-dark);color:#fff;border-radius:14px;padding:26px 22px;text-align:center}
.cta h2{border:0;margin:0 0 8px;padding:0;color:#fff}.cta p{margin:0 0 18px;font-size:.92rem;opacity:.92}
.btn{display:inline-block;margin:4px 6px;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:700;font-size:.92rem}
.btn-w{background:#fff;color:var(--g-dark)}.btn-l{background:#06C755;color:#fff}
.rel{margin-top:44px}.rel ul,.list{list-style:none;padding:0;margin:0}
.rel li{border-bottom:1px solid var(--line)}.rel li a{display:block;padding:11px 2px;text-decoration:none;color:var(--text)}
.list li{background:var(--card);border-radius:12px;margin-bottom:14px;overflow:hidden;border:1px solid var(--line)}
.list a{display:block;padding:16px 18px;text-decoration:none;color:var(--text)}
.list b{display:block;font-size:1.02rem;line-height:1.6;margin-bottom:4px}.list small{color:var(--sub);font-size:.84rem;line-height:1.7;display:block}
footer{text-align:center;font-size:.78rem;color:var(--sub);padding:28px 16px 40px}
`;

function head({ lang, title, desc, canonical, alternates, image, jsonld }) {
  const alt = alternates.map(([l, u]) => `  <link rel="alternate" hreflang="${LANGS[l].html}" href="${u}">`).join('\n');
  const xdef = alternates.find(([l]) => l === 'ja');
  return `<!DOCTYPE html>
<html lang="${LANGS[lang].html}">
<head>
  <!-- ⚠ このファイルは build-blog.js が index.html から自動生成します。手で編集しないこと。 -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${canonical}">
${alt}
${xdef ? `  <link rel="alternate" hreflang="x-default" href="${xdef[1]}">` : ''}
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  ${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
  <link rel="icon" href="/favicon-32.png" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Noto+Sans+JP:wght@400;700&display=swap">
  <style>${CSS}</style>
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>`;
}

const topBar = lang => `<header class="top"><a href="${LANGS[lang].home}">EMERALD REEF OKINAWA</a></header>`;
const foot = lang => `<footer>© EMERALD REEF OKINAWA ・ <a href="${LANGS[lang].home}">${esc(LANGS[lang].brand)}</a></footer>`;
const business = { '@type': 'LocalBusiness', '@id': BASE + '/#business', name: 'エメラルドリーフ沖縄', alternateName: 'EMERALD REEF OKINAWA', url: BASE + '/' };

function articlePage(p, lang, all) {
  const L = LANGS[lang], slug = slugOf(p), url = urlOf(lang, slug);
  const title = p.title[lang], desc = strip(p.excerpt[lang]);
  const langsHere = ORDER.filter(l => hasLang(p, l));
  const alternates = langsHere.map(l => [l, urlOf(l, slug)]);
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BlogPosting', headline: strip(title), description: desc, datePublished: p.date, dateModified: p.date,
      inLanguage: L.html, image: p.mainImage || undefined, url, mainEntityOfPage: url, author: business, publisher: business },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: L.brand, item: BASE + L.home },
      { '@type': 'ListItem', position: 2, name: L.blog, item: urlOf(lang, '') },
      { '@type': 'ListItem', position: 3, name: strip(title), item: url }] }
  ] };
  const otherLangs = langsHere.filter(l => l !== lang)
    .map(l => `<a href="/${LANGS[l].dir}/${slug}.html" hreflang="${LANGS[l].html}">${{ ja: '日本語', en: 'English', zh: '繁體中文', ko: '한국어' }[l]}</a>`).join('');
  const hook = p.hook && p.hook.title && p.hook.title[lang]
    ? `<h2>${p.hook.title[lang]}</h2>\n<p>${p.hook.text[lang] || ''}</p>` : '';
  const blocks = p.blocks.map(bl => `<section class="blk">
<h2>${bl.lead[lang]}</h2>
${bl.image ? `<img src="${esc(bl.image)}" alt="${esc(strip(bl.lead[lang]))}" loading="lazy" width="1200" height="675">` : ''}
<p>${bl.body[lang]}</p>
</section>`).join('\n');
  const rel = all.filter(q => q !== p && hasLang(q, lang))
    .sort((x, y) => (y.category === p.category) - (x.category === p.category) || (y.date > x.date ? 1 : -1)).slice(0, 6)
    .map(q => `<li><a href="/${L.dir}/${slugOf(q)}.html">${q.title[lang]}</a></li>`).join('\n');
  return `${head({ lang, title: `${strip(title)} | ${L.brand}`, desc, canonical: url, alternates, image: p.mainImage, jsonld })}
<body>
${topBar(lang)}
<main class="wrap">
<nav class="crumb"><a href="${L.home}">${esc(L.brand)}</a> › <a href="/${L.dir}/">${L.blog}</a></nav>
<article>
<h1>${title}</h1>
<div class="meta">${L.date}：<time datetime="${p.date}">${p.date.replace(/-/g, '.')}</time></div>
${otherLangs ? `<div class="langs">${otherLangs}</div>` : ''}
${p.mainImage ? `<img class="hero" src="${esc(p.mainImage)}" alt="${esc(strip(title))}" width="1200" height="675">` : ''}
<p class="lead">${p.excerpt[lang]}</p>
${hook}
${blocks}
</article>
<aside class="cta">
<h2>${L.ctaTtl}</h2>
<p>${L.ctaTxt}</p>
<a class="btn btn-w" href="${L.home}#view-booking">${L.book}</a><a class="btn btn-l" href="${LINE_URL}" rel="noopener">${L.line}</a>
</aside>
<nav class="rel"><h2>${L.related}</h2><ul>
${rel}
</ul><p><a href="/${L.dir}/">${L.all} →</a></p></nav>
</main>
${foot(lang)}
</body>
</html>
`;
}

function listPage(lang, posts) {
  const L = LANGS[lang], url = urlOf(lang, '');
  const alternates = ORDER.filter(l => BLOGS.some(p => hasLang(p, l))).map(l => [l, urlOf(l, '')]);
  const jsonld = { '@context': 'https://schema.org', '@type': 'Blog', name: `${L.listTitle} | ${L.brand}`, description: L.listDesc,
    url, inLanguage: L.html, publisher: business,
    blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: strip(p.title[lang]), url: urlOf(lang, slugOf(p)), datePublished: p.date })) };
  const items = posts.map(p => `<li><a href="/${L.dir}/${slugOf(p)}.html"><b>${p.title[lang]}</b><small>${p.date.replace(/-/g, '.')} ・ ${strip(p.excerpt[lang]).slice(0, 90)}…</small></a></li>`).join('\n');
  const otherLangs = alternates.filter(([l]) => l !== lang)
    .map(([l]) => `<a href="/${LANGS[l].dir}/" hreflang="${LANGS[l].html}">${{ ja: '日本語', en: 'English', zh: '繁體中文', ko: '한국어' }[l]}</a>`).join('');
  return `${head({ lang, title: `${L.listTitle} | ${L.brand}`, desc: L.listDesc, canonical: url, alternates, image: null, jsonld })}
<body>
${topBar(lang)}
<main class="wrap">
<nav class="crumb"><a href="${L.home}">${esc(L.brand)}</a> › ${L.blog}</nav>
<h1>${L.listTitle}</h1>
<p class="meta">${L.listDesc}</p>
<div class="langs">${otherLangs}</div>
<ul class="list">
${items}
</ul>
</main>
${foot(lang)}
</body>
</html>
`;
}

/* ---- 書き出し（古いページが残らないよう blog/ は作り直す） ---- */
fs.rmSync(OUT, { recursive: true, force: true });
const sitemapBlog = [];
const byDate = [...BLOGS].sort((x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : 0));
let count = 0;
for (const lang of ORDER) {
  const posts = byDate.filter(p => hasLang(p, lang));
  if (!posts.length) continue;
  const dir = path.join(ROOT, LANGS[lang].dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), listPage(lang, posts), 'utf8');
  for (const p of posts) {
    fs.writeFileSync(path.join(dir, slugOf(p) + '.html'), articlePage(p, lang, byDate), 'utf8');
    count++;
  }
}
for (const p of byDate) {
  const langs = ORDER.filter(l => hasLang(p, l));
  for (const l of langs) sitemapBlog.push({ loc: urlOf(l, slugOf(p)), lastmod: p.date, alts: langs.map(x => [x, urlOf(x, slugOf(p))]) });
}

/* ---- sitemap.xml ---- */
const today = new Date().toISOString().slice(0, 10);
const mainAlts = [['ja', BASE + '/'], ['en', BASE + '/en.html'], ['zh', BASE + '/zh.html'], ['ko', BASE + '/ko.html']];
const listLangs = ORDER.filter(l => BLOGS.some(p => hasLang(p, l)));
const urlXml = (loc, lastmod, alts, pri) => `  <url>
    <loc>${loc}</loc>
${alts.map(([l, u]) => `    <xhtml:link rel="alternate" hreflang="${LANGS[l].html}" href="${u}"/>`).join('\n')}
${alts.some(([l]) => l === 'ja') ? `    <xhtml:link rel="alternate" hreflang="x-default" href="${alts.find(([l]) => l === 'ja')[1]}"/>\n` : ''}    <lastmod>${lastmod}</lastmod>
    <priority>${pri}</priority>
  </url>`;
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- ⚠ build-blog.js が自動生成します。手で編集しないこと。 -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${mainAlts.map(([, u]) => urlXml(u, today, mainAlts, '1.0')).join('\n')}
${listLangs.map(l => urlXml(urlOf(l, ''), today, listLangs.map(x => [x, urlOf(x, '')]), '0.8')).join('\n')}
${sitemapBlog.map(s => urlXml(s.loc, s.lastmod, s.alts, '0.7')).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
console.log(`[build-blog] 記事ページ ${count} 枚（${ORDER.map(l => l + ':' + byDate.filter(p => hasLang(p, l)).length).join(' ')}）＋一覧 ${listLangs.length} 枚、sitemap.xml ${4 + listLangs.length + sitemapBlog.length} URL`);
