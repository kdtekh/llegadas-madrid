# Llegadas Madrid — Chamartín, Atocha y Barajas

Prompt de arranque para Claude Code. Dale este archivo al agente en tu
terminal (`claude` y luego pégale la ruta, o `claude "lee PROYECTO.md y
continúa"`) para que retome el proyecto exactamente donde lo dejamos en el
chat.

## 1. Qué es esto

App para tu padre: un solo panel con las llegadas de Chamartín, Atocha
(tren) y Barajas (vuelo). Nace de un documento de trabajo más ambicioso
(APK nativa Kotlin, roadmap de 4 fases) pero, para el MVP real que usa tu
padre, se optó por una **PWA de un solo archivo HTML** — sin build, sin
Android Studio, instalable con "Añadir a pantalla de inicio". Ya está
construida, probada y funcionando con datos en vivo.

## 2. Estado actual (ya hecho, no repetir)

- App completa en un único `index.html` (abajo, sección 5) — HTML/CSS/JS
  vanilla, sin frameworks ni build step.
- **Trenes: en vivo y verificado.** Endpoint real confirmado contra la
  documentación oficial de RadarDeTrenes (ver sección 3). Probado con
  respuestas reales de Atocha (código 60000).
- **Vuelos: en vivo, requiere clave gratuita del usuario.** AeroDataBox vía
  RapidAPI. Sin clave, muestra datos de ejemplo con aviso visible ("modo
  demostración") — nunca oculta que son datos falsos.
- Favoritos (⭐) y la clave de vuelos persisten entre sesiones con la API
  de almacenamiento del propio artefacto (`window.storage`) — **esto solo
  funciona dentro de un artefacto de Claude.ai**, no en un despliegue web
  normal (ver sección 4, punto 2).
- Auto-refresco cada 60 s, buscador por nº de tren/vuelo, diseño estilo
  panel de estación (split-flap), pensado para legibilidad: letra grande,
  alto contraste, tipografía monoespaciada para horas.
- Probado con Node + jsdom simulando fetch real, cambio de pestañas,
  favoritos y guardado de ajustes — sin errores de sintaxis ni de
  ejecución.

## 3. Contratos de API confirmados (no hace falta volver a investigar)

### Trenes — RadarDeTrenes

- Base: `https://radardetrenes.com/api/v1`
- Sin clave, CORS abierto (`Access-Control-Allow-Origin: *`)
- Límite: 100 peticiones/segundo por IP
- Tablero de una estación: `GET /stations/{codigo}/board-renfe`
  → `{ departures: Departure[], arrivals: Departure[], updatedAt, source, mode }`
- Campos relevantes de `Departure`: `trainCode`, `originName`,
  `destinationName`, `plannedTime` (epoch ms), `delayMinutes`,
  `timeType` (`SCHEDULED`/`ESTIMATED`), `platform` (a veces vacío, ADIF no
  siempre lo publica con antelación), `commercialProduct` (AVE, Alvia,
  Avant, AVLO…)
- Códigos de estación usados: Chamartín `17000`, Atocha `60000`
- Especificación completa: `https://radardetrenes.com/openapi.json` ·
  Documentación humana: `https://radardetrenes.com/docs`
- También expone streaming SSE (`/fleet/stream`) y un servidor MCP
  (`POST /mcp`) — interesantes para v2 (ver roadmap), no usados en el MVP.

### Vuelos — AeroDataBox (RapidAPI)

- `GET https://aerodatabox.p.rapidapi.com/flights/airports/icao/{icao}/{fromLocal}/{toLocal}?direction=Arrival`
- Cabeceras: `X-RapidAPI-Key`, `X-RapidAPI-Host: aerodatabox.p.rapidapi.com`
- ICAO de Barajas: `LEMD`
- Clave gratuita (~600 peticiones/mes):
  `https://rapidapi.com/aedbx-aedbx/api/aerodatabox`
- **Verificado en vivo (2026-08-29)** con la cuenta RapidAPI ya suscrita
  al plan BASIC (gratis) del usuario, contra `/flights/airports/icao/LEMD/...`
  — 200 OK, cientos de llegadas reales. El esquema documentado difería en
  un punto: no existe `arrival.predictedTime`, el campo real es
  `arrival.revisedTime`. `normalizaVuelo()` en `index.html` ya está
  corregido para usarlo y calcular los minutos de retraso a partir de la
  diferencia `revisedTime - scheduledTime`. Estados observados en vivo:
  `Arrived`, `Expected`, `Approaching`, `Delayed` (no se observó ningún
  vuelo cancelado en la ventana probada; se comprueban ambas grafías
  `Cancelled`/`Canceled` por si acaso). Nunca se imprimió la clave real en
  el chat ni se guardó en ningún archivo — se usó y se descartó solo
  dentro del navegador (regla del `CLAUDE.md` del vault).

## 4. Lo que le pido a Claude Code

1. ~~Crea un repo/carpeta de proyecto a partir del código de la sección 5.~~
   **Hecho** (2026-08-29) — repo git local en `~/proyecto-local (ruta omitida)`,
   commit `cdfd662`.
2. ~~**Resuelve la persistencia fuera del artefacto**~~ **Hecho** —
   `index.html` usa `localStorage` (`llegadas-madrid:favoritos`,
   `llegadas-madrid:flight-api-key`) en vez de `window.storage`. Probado
   en navegador real: favoritos y clave sobreviven a un reload.
3. ~~Añade un `manifest.json` real y un service worker mínimo~~ **Hecho** —
   `manifest.json` con iconos propios (`icons/icon-192.png`,
   `icons/icon-512.png`, generados desde `icons/icon.svg`) y
   `service-worker.js` (cache-first para shell/fuentes, network-first con
   fallback a caché para RadarDeTrenes y AeroDataBox). Verificado:
   `caches.keys()` muestra `llegadas-madrid-v1-shell` y `-api` pobladas
   tras cargar la app.
4. ~~Verifica en vivo el endpoint de AeroDataBox~~ **Hecho** (2026-08-29,
   ver sección 3) — `normalizaVuelo()` corregido para el esquema real
   (`revisedTime` en vez de `predictedTime`). Con una clave inválida el
   fallback a modo demo también funciona correctamente (probado).
5. **Pendiente, a petición del usuario** — Por ahora se deja el código
   listo sin desplegar; el usuario decidirá cuándo y dónde (GitHub Pages,
   Netlify, Vercel, Cloudflare Pages) para tener una URL fija.
6. Resto del roadmap (sección 6) sigue sin implementar, tal como se pidió.

No hace falta rehacer el diseño visual ni volver a investigar las APIs:
ambas cosas ya están resueltas y probadas.

## 5. Código fuente actual (`index.html`)

Pégalo tal cual en un `index.html` nuevo:

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Llegadas Madrid — Tren + Vuelo</title>
<link rel="manifest" href="data:application/json;base64,eyJuYW1lIjoiTGxlZ2FkYXMgTWFkcmlkIiwic2hvcnRfbmFtZSI6IkxsZWdhZGFzIiwic3RhcnRfdXJsIjoiLiIsImRpc3BsYXkiOiJzdGFuZGFsb25lIiwiYmFja2dyb3VuZF9jb2xvciI6IiMwYjBjMGEiLCJ0aGVtZV9jb2xvciI6IiMwYjBjMGEifQ==">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Archivo:wght@500;700;900&display=swap');

  :root{
    --bg:#0b0c0a;
    --panel:#141510;
    --panel-raised:#1b1c15;
    --hairline:#2a2b22;
    --flap:#f2a900;
    --flap-dim:#8a6a1f;
    --ink:#f2efe6;
    --ink-dim:#a9a591;
    --ok:#5fb87a;
    --warn:#e0b23e;
    --bad:#e2554f;
    --radius:2px;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:'Archivo',sans-serif;font-size:16px;-webkit-font-smoothing:antialiased;overscroll-behavior-y:contain;}
  body{padding-bottom:84px;min-height:100vh;}
  .mono{font-family:'Space Mono',monospace;}

  /* ---------- Header ---------- */
  header.top{
    position:sticky;top:0;z-index:20;
    background:linear-gradient(180deg,#0b0c0a 80%,rgba(11,12,10,0));
    padding:18px 16px 10px;
  }
  .brand{display:flex;align-items:baseline;justify-content:space-between;}
  .brand h1{
    font-family:'Space Mono',monospace;font-weight:700;font-size:15px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--flap);margin:0;
  }
  .brand .clock{font-family:'Space Mono',monospace;font-size:16px;color:var(--ink-dim);}
  .subtitle{font-size:13px;color:var(--ink-dim);margin-top:4px;letter-spacing:.03em;}

  /* ---------- Station tabs (content) ---------- */
  .station-head{padding:4px 16px 14px;}
  .station-head h2{
    font-family:'Archivo',sans-serif;font-weight:900;font-size:32px;margin:0 0 4px;
    letter-spacing:-.01em;
  }
  .station-head .meta{display:flex;gap:10px;align-items:center;font-size:14px;color:var(--ink-dim);}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--ok);display:inline-block;}
  .dot.stale{background:var(--warn);}
  .dot.err{background:var(--bad);}

  .toolbar{display:flex;gap:8px;padding:0 16px 14px;}
  .toolbar input[type=search]{
    flex:1;background:var(--panel);border:1px solid var(--hairline);color:var(--ink);
    padding:13px 14px;border-radius:var(--radius);font-family:'Space Mono',monospace;font-size:16px;
  }
  .toolbar input::placeholder{color:var(--ink-dim);}
  .iconbtn{
    background:var(--panel);border:1px solid var(--hairline);color:var(--flap);
    width:48px;border-radius:var(--radius);font-size:19px;cursor:pointer;
  }
  .iconbtn:active{background:var(--panel-raised);}

  /* ---------- Board ---------- */
  .board{padding:0 16px;}
  .board-header-row{
    display:grid;grid-template-columns:64px 1fr 64px 84px 40px;gap:10px;
    padding:6px 10px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-dim);
    border-bottom:1px solid var(--hairline);
  }
  .row{
    display:grid;grid-template-columns:64px 1fr 64px 84px 40px;gap:10px;align-items:center;
    padding:16px 10px;border-bottom:1px solid var(--hairline);
  }
  .row.fav{background:rgba(242,169,0,0.06);}
  .row .time{font-family:'Space Mono',monospace;font-weight:700;font-size:21px;color:var(--flap);line-height:1.15;}
  .row .time small{display:block;font-size:11px;color:var(--ink-dim);font-weight:400;margin-top:2px;}
  .row .origin{font-size:16px;line-height:1.3;}
  .row .origin .num{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink-dim);display:block;margin-top:3px;}
  .row .plat{font-family:'Space Mono',monospace;font-size:16px;text-align:center;color:var(--ink);}
  .row .status{font-size:13px;text-align:right;font-weight:700;letter-spacing:.02em;line-height:1.3;}
  .status.ok{color:var(--ok);}
  .status.warn{color:var(--warn);}
  .status.bad{color:var(--bad);}
  .row .star{background:none;border:none;font-size:22px;color:var(--hairline);cursor:pointer;padding:0;}
  .row .star.on{color:var(--flap);}

  .empty, .demo-note{
    text-align:center;color:var(--ink-dim);font-size:15px;padding:34px 20px;line-height:1.55;
  }
  .demo-note{
    background:var(--panel);border:1px dashed var(--hairline);border-radius:var(--radius);
    margin:14px 16px;padding:16px;text-align:left;
  }
  .demo-note b{color:var(--warn);}

  /* ---------- Bottom nav ---------- */
  nav.tabs{
    position:fixed;left:0;right:0;bottom:0;z-index:30;
    display:grid;grid-template-columns:repeat(4,1fr);
    background:var(--panel);border-top:1px solid var(--hairline);
    padding:8px 0 calc(8px + env(safe-area-inset-bottom));
  }
  nav.tabs button{
    background:none;border:none;color:var(--ink-dim);font-family:'Archivo',sans-serif;
    font-size:12px;font-weight:700;letter-spacing:.02em;padding:6px 0;cursor:pointer;
    display:flex;flex-direction:column;align-items:center;gap:5px;text-transform:uppercase;
  }
  nav.tabs button .ic{font-size:20px;}
  nav.tabs button.active{color:var(--flap);}

  /* ---------- Settings ---------- */
  .settings{padding:8px 16px 20px;}
  .field{margin-bottom:18px;}
  .field label{display:block;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim);margin-bottom:7px;}
  .field input, .field select{
    width:100%;background:var(--panel);border:1px solid var(--hairline);color:var(--ink);
    padding:13px 14px;border-radius:var(--radius);font-family:'Space Mono',monospace;font-size:15px;
  }
  .field .hint{font-size:13px;color:var(--ink-dim);margin-top:7px;line-height:1.55;}
  .field .hint a{color:var(--flap);}
  .savebar{
    display:flex;gap:10px;margin-top:6px;
  }
  .btn{
    flex:1;background:var(--flap);color:#141510;border:none;padding:14px;border-radius:var(--radius);
    font-family:'Archivo',sans-serif;font-weight:700;font-size:15px;cursor:pointer;letter-spacing:.02em;
  }
  .btn.ghost{background:none;border:1px solid var(--hairline);color:var(--ink);}
  .savedflag{font-size:14px;color:var(--ok);text-align:center;margin-top:10px;min-height:18px;}

  ::-webkit-scrollbar{display:none;}
</style>
</head>
<body>

<header class="top">
  <div class="brand">
    <h1 id="stationTitleMini">Llegadas Madrid</h1>
    <span class="clock mono" id="clock">--:--</span>
  </div>
  <div class="subtitle">Tren + vuelo en un solo panel</div>
</header>

<main id="view"></main>

<nav class="tabs">
  <button data-tab="chamartin" class="active"><span class="ic">🚆</span>Chamartín</button>
  <button data-tab="atocha"><span class="ic">🚄</span>Atocha</button>
  <button data-tab="barajas"><span class="ic">✈️</span>Barajas</button>
  <button data-tab="ajustes"><span class="ic">⚙️</span>Ajustes</button>
</nav>

<script>
/* =========================================================================
   CONFIG
   =========================================================================
   TRENES: RadarDeTrenes (radardetrenes.com/api/v1), API pública, sin clave,
   CORS abierto, verificada en vivo contra /docs y /openapi.json. El tablero
   oficial de una estación vive en /stations/{codigo}/board-renfe y devuelve
   {departures, arrivals, updatedAt, source, mode}.
   ========================================================================= */
const STATIONS = {
  chamartin: { nombre: 'Chamartín — Clara Campoamor', codigo: '17000' },
  atocha:    { nombre: 'Puerta de Atocha — Almudena Grandes', codigo: '60000' },
};
function TREN_ENDPOINT(codigo){
  return `https://radardetrenes.com/api/v1/stations/${codigo}/board-renfe`;
}
// AeroDataBox (RapidAPI) — API documentada y estable para vuelos.
// Clave gratuita en https://rapidapi.com/aedbx-aedbx/api/aerodatabox
const BARAJAS_ICAO = 'LEMD';
function VUELO_ENDPOINT(icao, fromISO, toISO){
  return `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${icao}/${fromISO}/${toISO}?direction=Arrival&withLeg=true&withCancelled=true&withCodeshared=true&withLocation=false`;
}
const REFRESH_MS = 60000;

/* ========================= estado y almacenamiento ===================== */
let state = { tab:'chamartin', favoritos:{}, flightKey:'', trainsDemo:false, flightsDemo:true };

async function loadPersisted(){
  try{
    const fav = await window.storage.get('favoritos', false);
    if(fav) state.favoritos = JSON.parse(fav.value);
  }catch(e){}
  try{
    const key = await window.storage.get('flight-api-key', false);
    if(key) state.flightKey = key.value;
  }catch(e){}
}
async function saveFavoritos(){
  try{ await window.storage.set('favoritos', JSON.stringify(state.favoritos), false); }catch(e){}
}
async function saveFlightKey(k){
  try{ await window.storage.set('flight-api-key', k, false); state.flightKey = k; }catch(e){}
}

/* ================================ datos ================================= */
function demoTrenes(codigo){
  const base = codigo === '17000'
    ? [
        {hora:'14:12', origen:'Barcelona-Sants', num:'03045', via:'12', estado:'ok', retraso:0},
        {hora:'14:28', origen:'Valladolid-Campo Grande', num:'04512', via:'6', estado:'warn', retraso:8},
        {hora:'14:41', origen:'Irún', num:'00731', via:'4', estado:'ok', retraso:0},
        {hora:'15:05', origen:'A Coruña', num:'00622', via:'2', estado:'bad', retraso:0, cancelado:true},
        {hora:'15:20', origen:'Santander', num:'00815', via:'9', estado:'ok', retraso:0},
      ]
    : [
        {hora:'14:09', origen:'Sevilla-Santa Justa', num:'03102', via:'2', estado:'ok', retraso:0},
        {hora:'14:22', origen:'Valencia-Joaquín Sorolla', num:'02277', via:'10', estado:'warn', retraso:5},
        {hora:'14:36', origen:'Málaga-María Zambrano', num:'03318', via:'5', estado:'ok', retraso:0},
        {hora:'14:50', origen:'Alicante-Terminal', num:'02901', via:'14', estado:'ok', retraso:0},
        {hora:'15:11', origen:'Cuenca-Fernando Zóbel', num:'06044', via:'1', estado:'ok', retraso:0},
      ];
  return base;
}
function demoVuelos(){
  return [
    {hora:'14:15', origen:'Londres-Heathrow', num:'IB3166', via:'T4', estado:'ok', retraso:0},
    {hora:'14:33', origen:'Bogotá', num:'AV018', via:'T4S', estado:'warn', retraso:22},
    {hora:'14:47', origen:'Fráncfort', num:'LH1132', via:'T4', estado:'ok', retraso:0},
    {hora:'15:02', origen:'Ciudad de México', num:'AM020', via:'T4S', estado:'ok', retraso:0},
    {hora:'15:18', origen:'Milán-Malpensa', num:'IB3268', via:'T4', estado:'bad', retraso:0, cancelado:true},
  ];
}

async function fetchTrenes(key){
  const st = STATIONS[key];
  try{
    const res = await fetch(TREN_ENDPOINT(st.codigo), {headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const lista = data.arrivals || [];
    if(!lista.length) throw new Error('respuesta vacía');
    lista.sort((a,b)=> a.plannedTime - b.plannedTime);
    state.trainsDemo = false;
    return lista.map(normalizaTren);
  }catch(e){
    state.trainsDemo = true;
    return demoTrenes(st.codigo);
  }
}
function normalizaTren(x){
  const hora = x.plannedTime
    ? new Date(x.plannedTime).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})
    : '--:--';
  const retraso = x.delayMinutes || 0;
  return {
    hora,
    origen: x.originName || '—',
    num: x.trainCode || '',
    via: x.platform || x.commercialProduct || x.product || '—',
    estado: retraso > 5 ? 'warn' : 'ok',
    retraso,
    cancelado: false,
  };
}
async function fetchVuelos(){
  if(!state.flightKey){ state.flightsDemo = true; return demoVuelos(); }
  try{
    const now = new Date();
    const from = now.toISOString().slice(0,16);
    const to = new Date(now.getTime()+4*3600*1000).toISOString().slice(0,16);
    const res = await fetch(VUELO_ENDPOINT(BARAJAS_ICAO, from, to), {
      headers:{
        'X-RapidAPI-Key': state.flightKey,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
      }
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const lista = data.arrivals || [];
    if(!lista.length) throw new Error('vacío');
    state.flightsDemo = false;
    return lista.map(normalizaVuelo);
  }catch(e){
    state.flightsDemo = true;
    return demoVuelos();
  }
}
function normalizaVuelo(f){
  const prog = f.arrival?.scheduledTime?.local?.slice(11,16) || '--:--';
  const est = f.arrival?.predictedTime?.local?.slice(11,16);
  const retraso = (est && est !== prog) ? 1 : 0;
  return {
    hora: prog,
    origen: f.departure?.airport?.name || '—',
    num: f.number || '',
    via: f.arrival?.terminal || '—',
    estado: f.status === 'Cancelled' ? 'bad' : (retraso ? 'warn' : 'ok'),
    retraso: 0,
    cancelado: f.status === 'Cancelled',
  };
}

/* ================================ render ================================ */
const view = document.getElementById('view');
const titleMini = document.getElementById('stationTitleMini');

function statusLabel(r){
  if(r.cancelado) return 'CANCELADO';
  if(r.estado === 'warn') return `+${r.retraso||''} MIN`.trim();
  return 'EN HORA';
}
function favKeyOf(tab, r){ return tab+'|'+r.num+'|'+r.hora; }

function renderBoard(tab, nombre, rows, isDemo){
  titleMini.textContent = nombre.split(' — ')[0].split('-')[0];
  const filtro = (document.getElementById('buscador')?.value || '').trim().toUpperCase();
  const filtradas = filtro ? rows.filter(r => (r.num||'').toUpperCase().includes(filtro) || (r.origen||'').toUpperCase().includes(filtro)) : rows;

  view.innerHTML = `
    <div class="station-head">
      <h2>${nombre}</h2>
      <div class="meta"><span class="dot ${isDemo?'stale':''}"></span>${isDemo ? 'Modo demostración' : 'Datos en vivo'} · se actualiza cada 60 s</div>
    </div>
    <div class="toolbar">
      <input type="search" id="buscador" placeholder="Buscar nº de tren o vuelo..." value="${filtro}">
      <button class="iconbtn" id="btnRefresh">⟳</button>
    </div>
    ${isDemo ? `<div class="demo-note"><b>Sin conexión a datos reales ahora mismo.</b> Estás viendo horarios de ejemplo. ${tab==='barajas' ? 'Añade tu clave de AeroDataBox en Ajustes para ver vuelos reales.' : 'RadarDeTrenes puede tardar un momento en responder o no tener cobertura puntual — se reintenta cada 60 s automáticamente.'}</div>` : ''}
    <div class="board">
      <div class="board-header-row"><span>Hora</span><span>Origen</span><span style="text-align:center">Vía</span><span style="text-align:right">Estado</span><span></span></div>
      <div id="rows"></div>
      ${filtradas.length === 0 ? '<div class="empty">Sin resultados para esa búsqueda.</div>' : ''}
    </div>
  `;
  const rowsEl = document.getElementById('rows');
  filtradas.forEach(r=>{
    const fk = favKeyOf(tab, r);
    const isFav = !!state.favoritos[fk];
    const div = document.createElement('div');
    div.className = 'row' + (isFav ? ' fav' : '');
    div.innerHTML = `
      <div class="time mono">${r.hora}</div>
      <div class="origin">${r.origen}<span class="num">${r.num}</span></div>
      <div class="plat">${r.via}</div>
      <div class="status ${r.estado}">${statusLabel(r)}</div>
      <button class="star ${isFav?'on':''}" aria-label="favorito">★</button>
    `;
    div.querySelector('.star').addEventListener('click', ()=>{
      if(state.favoritos[fk]) delete state.favoritos[fk]; else state.favoritos[fk] = true;
      saveFavoritos();
      renderCurrent();
    });
    rowsEl.appendChild(div);
  });
  document.getElementById('buscador').addEventListener('input', ()=> renderCurrent(false));
  document.getElementById('btnRefresh').addEventListener('click', ()=> renderCurrent(true));
}

function renderSettings(){
  titleMini.textContent = 'Ajustes';
  view.innerHTML = `
    <div class="settings">
      <div class="station-head" style="padding-left:0;padding-right:0;">
        <h2 style="font-size:24px;">Ajustes</h2>
      </div>
      <div class="field">
        <label>Clave AeroDataBox (RapidAPI) — para vuelos reales de Barajas</label>
        <input type="text" id="flightKeyInput" placeholder="Pega aquí tu clave" value="${state.flightKey || ''}">
        <div class="hint">Gratis (~600 peticiones/mes) en <a href="https://rapidapi.com/aedbx-aedbx/api/aerodatabox" target="_blank">rapidapi.com/aedbx-aedbx/api/aerodatabox</a>. Sin clave, el panel de Barajas muestra horarios de ejemplo.</div>
      </div>
      <div class="savebar">
        <button class="btn" id="btnGuardar">Guardar</button>
        <button class="btn ghost" id="btnBorrarFav">Borrar favoritos</button>
      </div>
      <div class="savedflag" id="savedFlag"></div>
      <div class="field" style="margin-top:26px;">
        <label>Atribución de datos</label>
        <div class="hint">Trenes: Renfe Open Data / Adif (CC BY 4.0) vía RadarDeTrenes. Vuelos: AeroDataBox.</div>
      </div>
    </div>
  `;
  document.getElementById('btnGuardar').addEventListener('click', async ()=>{
    const v = document.getElementById('flightKeyInput').value.trim();
    await saveFlightKey(v);
    document.getElementById('savedFlag').textContent = 'Guardado.';
    setTimeout(()=> document.getElementById('savedFlag').textContent = '', 2000);
  });
  document.getElementById('btnBorrarFav').addEventListener('click', async ()=>{
    state.favoritos = {};
    await saveFavoritos();
    document.getElementById('savedFlag').textContent = 'Favoritos borrados.';
    setTimeout(()=> document.getElementById('savedFlag').textContent = '', 2000);
  });
}

let cache = { chamartin:null, atocha:null, barajas:null };

async function renderCurrent(forceReload){
  const tab = state.tab;
  if(tab === 'ajustes'){ renderSettings(); return; }

  document.querySelectorAll('nav.tabs button').forEach(b=> b.classList.toggle('active', b.dataset.tab === tab));

  if(tab === 'barajas'){
    if(forceReload || !cache.barajas) cache.barajas = await fetchVuelos();
    renderBoard('barajas', 'Adolfo Suárez Madrid-Barajas', cache.barajas, state.flightsDemo);
  } else {
    if(forceReload || !cache[tab]) cache[tab] = await fetchTrenes(tab);
    renderBoard(tab, STATIONS[tab].nombre, cache[tab], state.trainsDemo);
  }
}

document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.tab = btn.dataset.tab;
    renderCurrent(false);
  });
});

function tickClock(){
  const d = new Date();
  document.getElementById('clock').textContent =
    d.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
}

(async function init(){
  await loadPersisted();
  tickClock();
  setInterval(tickClock, 15000);
  await renderCurrent(true);
  setInterval(()=> renderCurrent(true), REFRESH_MS);
})();
</script>
</body>
</html>
```

## 6. Roadmap pendiente (del documento original, no urgente)

- Notificaciones locales cuando cambia el estado de un favorito
  (Notification API / Web Push si se despliega como PWA real)
- Mapa en vivo de trenes usando `/api/v1/fleet` o `/fleet/stream` (SSE)
- Salidas además de llegadas
- Widget de pantalla de inicio (limitado en PWA; nativo si se migra a
  Kotlin/Compose más adelante)
- Si en algún momento se quiere una APK nativa de verdad (Play Store,
  widgets, mejor integración): Kotlin + Jetpack Compose, reutilizando los
  mismos dos endpoints. Requiere Android Studio, que no está disponible en
  el entorno de chat — ese paso solo se puede dar aquí, en tu máquina.

## 7. Atribución (no lo quites de la interfaz)

- Trenes: datos de Renfe/ADIF vía RadarDeTrenes — CC BY 4.0, cita
  obligatoria.
- Vuelos: AeroDataBox.
