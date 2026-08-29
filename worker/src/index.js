const BARAJAS_ICAO = 'LEMD';
const WINDOW_HOURS = 4;
const CACHE_BUCKET_MINUTES = 3; // agrupa peticiones cercanas para no gastar cuota de AeroDataBox
const ALLOWED_ORIGINS = new Set([
  'https://kdtekh.github.io',
  'http://localhost:8791',
]);

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://kdtekh.github.io';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

function pad2(n) { return String(n).padStart(2, '0'); }

// Hora local de Madrid (no la del runtime del Worker, que corre en UTC),
// redondeada hacia abajo a un múltiplo de CACHE_BUCKET_MINUTES para que
// peticiones cercanas en el tiempo compartan la misma ventana y caché.
function madridWindow() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const roundedMinute = Math.floor(Number(parts.minute) / CACHE_BUCKET_MINUTES) * CACHE_BUCKET_MINUTES;

  const from = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${pad2(roundedMinute)}`;

  const fromDate = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${pad2(roundedMinute)}:00`);
  const toDate = new Date(fromDate.getTime() + WINDOW_HOURS * 3600 * 1000);
  const to = `${toDate.getFullYear()}-${pad2(toDate.getMonth() + 1)}-${pad2(toDate.getDate())}T${pad2(toDate.getHours())}:${pad2(toDate.getMinutes())}`;

  return { from, to };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/arrivals') {
      return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
    }

    const { from, to } = madridWindow();
    const cacheKey = new Request(`https://cache.internal/arrivals?from=${from}&to=${to}`, request);
    const cache = caches.default;

    let response = await cache.match(cacheKey);
    if (response) {
      const cached = new Response(response.body, response);
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => cached.headers.set(k, v));
      cached.headers.set('X-Cache', 'HIT');
      return cached;
    }

    const upstreamUrl = `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${BARAJAS_ICAO}/${from}/${to}?direction=Arrival&withLeg=true&withCancelled=true&withCodeshared=true&withLocation=false`;

    const upstream = await fetch(upstreamUrl, {
      headers: {
        'X-RapidAPI-Key': env.AERODATABOX_KEY,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
      },
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'upstream_error', status: upstream.status }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const data = await upstream.text();
    response = new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_BUCKET_MINUTES * 60}`,
        'X-Cache': 'MISS',
        ...corsHeaders(origin),
      },
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
