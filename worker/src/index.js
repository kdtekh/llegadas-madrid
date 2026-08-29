const BARAJAS_ICAO = 'LEMD';
const WINDOW_HOURS = 4;
// Agrupa peticiones cercanas en un mismo "bucket" para no gastar cuota de
// AeroDataBox. Se cachea en Workers KV (global de verdad) en vez de la
// Cache API de Workers (que es por centro de datos: comprobado que
// peticiones seguidas podían caer en colos distintos y fallar la caché).
const CACHE_BUCKET_MINUTES = 5;
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

  const bucketKey = `arrivals:${parts.year}${parts.month}${parts.day}${parts.hour}${pad2(roundedMinute)}`;

  return { from, to, bucketKey };
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

    const { from, to, bucketKey } = madridWindow();

    const cached = await env.ARRIVALS_CACHE.get(bucketKey);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          ...corsHeaders(origin),
        },
      });
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

    // TTL con margen sobre la duración del bucket: si el reloj del cliente
    // se desfasa unos segundos del bucket calculado aquí, sigue sirviendo
    // desde KV en vez de fallar la lectura por haber expirado justo antes.
    ctx.waitUntil(env.ARRIVALS_CACHE.put(bucketKey, data, { expirationTtl: CACHE_BUCKET_MINUTES * 60 + 60 }));

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        ...corsHeaders(origin),
      },
    });
  },
};
