# Llegadas Madrid — Chamartín, Atocha y Barajas

Progressive Web App de un solo panel con las próximas llegadas de tren a
Chamartín y Atocha, y de vuelo a Barajas. Pensada para gente que solo
necesita consultar "¿a qué hora llega?" sin abrir tres apps distintas.

**Demo:** https://kdtekh.github.io/llegadas-madrid/

## Características

- Tres paneles (Chamartín, Atocha, Barajas) con horario previsto, hora
  estimada real si hay retraso, origen, vía/terminal y estado (en hora /
  retraso en minutos / cancelado / llegado).
- Datos en vivo. Sin refresco automático de fondo (para no gastar batería
  ni datos sin que nadie mire): pide datos frescos al entrar en una
  pestaña o al pulsar ⟳ (hay uno junto al reloj y otro en cada panel).
  En Chamartín y Atocha, además de los próximos trenes (lo único que da
  el panel oficial), conserva localmente los que ya han llegado en los
  últimos 30 minutos.
- Buscador por número de tren/vuelo.
- Favoritos (⭐), persistentes entre sesiones.
- Instalable como app ("Añadir a pantalla de inicio") gracias a un
  manifest y un service worker con caché offline.
- Diseño de alto contraste, letra grande, estilo panel de estación.
- Un único `index.html` sin build ni dependencias — HTML/CSS/JS vanilla.

## Fuentes de datos

### Trenes — [RadarDeTrenes](https://radardetrenes.com/docs)

API pública y gratuita sobre datos abiertos de Renfe/Adif (**CC BY 4.0**).
No requiere clave. Endpoint usado: `GET /stations/{codigo}/board-renfe`
(códigos: Chamartín `17000`, Atocha `60000`).

### Vuelos — [AeroDataBox](https://rapidapi.com/aedbx-aedbx/api/aerodatabox) (RapidAPI), vía un proxy propio

`index.html` no llama a AeroDataBox directamente ni pide ninguna clave a
quien usa la app. Llama a un pequeño **Cloudflare Worker** (`worker/`)
que:

- Guarda la clave de AeroDataBox como secreto (`AERODATABOX_KEY`), nunca
  en el código ni en el repositorio.
- Calcula la ventana horaria en hora local de Madrid (Europe/Madrid),
  evitando el desfase de zona horaria que da `Date.toISOString()`.
- Cachea la respuesta ~5 minutos en Workers KV (caché **global**, no por
  centro de datos — con la Cache API normal de Workers, peticiones
  seguidas podían caer en colos distintos y no acertar), así que aunque
  varias personas pulsen ⟳ a la vez, la clave gratuita (~600
  peticiones/mes) no se agota.

Sin el proxy disponible, el panel de Barajas cae a datos de ejemplo con
un aviso visible de "modo demostración" — nunca oculta que son datos
falsos.

Desplegar el proxy (una vez, con [wrangler](https://developers.cloudflare.com/workers/wrangler/)):

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create ARRIVALS_CACHE   # una vez; copia el id a wrangler.toml
npx wrangler secret put AERODATABOX_KEY           # pega tu clave cuando la pida
npx wrangler deploy
```

## Desarrollo local

No hace falta build. Basta con servir la carpeta con cualquier servidor
estático (el service worker necesita `http://` o `https://`, no `file://`):

```bash
python3 -m http.server 8000
```

## Despliegue

Se sirve como sitio estático desde GitHub Pages (rama `master`, raíz del
repo). Cualquier plataforma de hosting estático (Netlify, Vercel,
Cloudflare Pages) serviría igual, ya que no hay backend.

## Roadmap pendiente

- Notificaciones locales cuando cambia el estado de un favorito.
- Mapa en vivo usando el streaming SSE de RadarDeTrenes (`/fleet/stream`).
- Panel de salidas, además de llegadas.
- Versión nativa (Kotlin/Compose) si en algún momento hace falta más
  integración con el sistema (widgets, notificaciones push) de la que
  permite una PWA.

## Atribución

- Trenes: datos de Renfe/Adif vía RadarDeTrenes — **CC BY 4.0**.
- Vuelos: [AeroDataBox](https://www.aerodatabox.com/).
