/**
 * Ghillie SEPA Proxy — Cloudflare Worker
 * ========================================
 * Deploy: dash.cloudflare.com → Workers & Pages → Create Worker → paste this code → Deploy
 * You'll get a URL like: https://ghillie-sepa-proxy.YOUR-SUBDOMAIN.workers.dev
 * Then update WORKER_URL in the app to point to it.
 *
 * Routes:
 *   GET /levels?ts_id=55822010          → live river level data (3 days)
 *   GET /discover?station_no=14990      → find tsId for a station by stId
 *   GET /health                         → returns ok + timestamp
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const SEPA = 'https://timeseries.sepa.org.uk/KiWIS/KiWIS?service=kisters&type=queryServices&datasource=0';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const { pathname, searchParams } = new URL(request.url);

    try {
      if (pathname === '/levels') {
        const tsId = searchParams.get('ts_id');
        if (!tsId) return err(400, 'Missing ts_id');
        const url = `${SEPA}&request=getTimeseriesValues&ts_id=${tsId}&period=P3D&returnfields=Timestamp,Value&format=json`;
        return json(await sepa(url, ctx));
      }

      if (pathname === '/discover') {
        const stNo = searchParams.get('station_no');
        if (!stNo) return err(400, 'Missing station_no');
        const url = `${SEPA}&request=getTimeseriesList&format=json&station_no=${stNo}&stationparameter_name=Stage&returnfields=ts_id,station_no,station_name,ts_name`;
        return json(await sepa(url, ctx));
      }

      if (pathname === '/health') {
        return json({ status: 'ok', ts: new Date().toISOString() });
      }

      return err(404, 'Routes: /levels?ts_id=... or /discover?station_no=...');
    } catch (e) {
      return err(500, e.message);
    }
  }
};

async function sepa(url, ctx) {
  // Check Cloudflare cache first (15 min TTL)
  const cache = caches.default;
  const cacheKey = new Request(url);
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Ghillie/1.0 (fishing conditions app)' }
  });
  if (!resp.ok) throw new Error(`SEPA ${resp.status}`);
  const data = await resp.json();

  // Cache the response for 15 minutes
  ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=900' }
  })));

  return data;
}

const json = d => new Response(JSON.stringify(d), { headers: CORS });
const err  = (s, m) => new Response(JSON.stringify({ error: m }), { status: s, headers: CORS });
