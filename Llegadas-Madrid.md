# Llegadas Madrid — Chamartín, Atocha y Barajas

Progressive Web App de un solo panel con las próximas llegadas de tren a
Chamartín y Atocha, y de vuelo a Barajas. Pensada para gente que solo
necesita consultar "¿a qué hora llega?" sin abrir tres apps distintas.

**Demo:** https://kdtekh.github.io/llegadas-madrid/

## Características

- Tres paneles (Chamartín, Atocha, Barajas) con horario previsto, origen,
  vía/terminal y estado (en hora / retraso en minutos / cancelado).
- Datos en vivo, con auto-refresco cada 60 s.
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

### Vuelos — [AeroDataBox](https://rapidapi.com/aedbx-aedbx/api/aerodatabox) (RapidAPI)

Requiere una clave gratuita propia (plan BASIC, ~600 peticiones/mes).
Sin clave configurada, el panel de Barajas muestra datos de ejemplo con
un aviso visible de "modo demostración" — nunca oculta que son datos
falsos.

Para activarlo: abre la app → pestaña **Ajustes** → pega tu clave de
RapidAPI → Guardar. La clave se guarda solo en el `localStorage` de tu
navegador; nunca viaja a ningún servidor propio ni se sube al repositorio.

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
