/* ============================================================
   Cloudflare Worker — EMERALD REEF OKINAWA 予約カレンダー用プロキシ
   ------------------------------------------------------------
   役割: Googleカレンダーの「公開iCalフィード」をサーバー側で取得し、
         CORSヘッダを付けてそのまま返すだけの軽量プロキシ。
         これにより、無料の外部CORSプロキシ（不安定）に頼らず、
         自前の安定したエンドポイントから空き状況を取得できる。

   デプロイ手順は README-cloudflare-worker.md を参照。
   無料枠: 1日10万リクエストまで（このサイトには十分すぎる）。

   ※ ここに書かれているカレンダーIDは「公開カレンダー」のIDであり
      秘密情報ではありません（サイトの index.html にも記載済み）。
      対象カレンダーを固定しているため、第三者が任意URLの取得に
      悪用できない（オープンプロキシではない）。
   ============================================================ */

const ICAL_URL =
  'https://calendar.google.com/calendar/ical/' +
  'bae4673fc1586cd7d77b696a07915989913ec8da83407e71ec4866749306b115%40group.calendar.google.com' +
  '/public/basic.ics';

export default {
  async fetch(request) {
    const CORS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };

    // プリフライト対応
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    try {
      const upstream = await fetch(ICAL_URL, {
        // Cloudflareのエッジで5分キャッシュ（Googleへの負荷軽減＆高速化）
        cf: { cacheTtl: 300, cacheEverything: true },
        headers: { 'User-Agent': 'EmeraldReefCalendarProxy/1.0' },
      });

      if (!upstream.ok) {
        return new Response('upstream error ' + upstream.status, {
          status: 502,
          headers: CORS,
        });
      }

      const body = await upstream.text();
      return new Response(body, {
        headers: {
          ...CORS,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (e) {
      return new Response('proxy error', { status: 502, headers: CORS });
    }
  },
};
