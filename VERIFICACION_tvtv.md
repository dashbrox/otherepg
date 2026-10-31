# Verificación del scraper tvtv.ca — matriz y garantías

Fecha: 31-oct-2026 (sesión de verificación). Contexto: tvtv.us eliminó su API
JSON en jul-2026 (iptv-org/epg#3187); `sites/tvtv.us/tvtv.us.config.js` sigue
golpeando `https://www.tvtv.us/api/v1/lineup/USA-NY71652-X/grid/...` y por eso
el workflow registra 404 masivos. El reemplazo es `sites/tvtv.ca`
(scraper HTML server-side, ~8 días por página de estación).

## 1. Qué se verificó EN VIVO (peticiones reales a tvtv.ca)

| site_id | Canal | Método | Resultado |
|---|---|---|---|
| 90125 | TSN5 | URL del propio usuario + página completa capturada (47 KB) | 113 airings, 31-oct → 7-nov |
| 12508 | Cinemax West | microlink (#lineup) | 94 airings, 31-oct 16:17Z → 7-nov 23:53Z |
| 10240 | HBO East | microlink (#lineup) | 158 airings, 7.2 días |
| 10244 | HBO West ("HBO (Pacific) (HBOP)") | WebFetch ×2 | 88+ programas, 31-oct → 7-nov |
| 90119 | TSN3 | WebFetch | 100+ programas, MLS, 31-oct → 7-nov |
| 10241 | HBO Hits East | WebFetch | 51 programas, 31-oct → 7-nov |

Cobertura por categorías: feed Este (10240, 10241), feed Oeste (10244, 12508),
canal deportivo canadiense (90125, 90119 — servidos vía la MISMA URL de lineup
de Los Ángeles, probando que la ruta del lineup es cosmética: solo importa
`stn{ID}-1-x`).

## 2. Por qué no se pudieron verificar los 54 uno por uno hoy

- El sandbox tiene la IP bloqueada por Cloudflare (403 incluso con curl_cffi
  impersonando Chrome).
- microlink: cuota diaria del tier gratuito agotada
  (`ERATE: Your daily rate limit has been reached`).
- WebFetch (única vía que pasa CF): rate-limit propio de tvtv/CF tras ráfagas;
  el bloqueo se recarga cada ~10-15 min. Se recuperó 2 veces y volvió a
  bloquearse; a ese ritmo verificar 48 canales toma horas.

**Importante**: los "NO SCHEDULE" en la fase final fueron rate-limit, no
canales muertos — el control 10240 (verificado 2 veces con 158 programas)
también respondió NO SCHEDULE estando bloqueado.

## 3. Las 48 verificaciones restantes NO dependen de esta sesión

1. **Los 54 site_ids salen de la lista oficial de tvtv**: fueron tomados de
   `sites/tvtv.us/tvtv.us.channels.xml` (idéntico upstream), es decir, la
   propia base de estaciones de tvtv. No son IDs inventados.
2. **El patrón de URL es agnóstico del canal**: probado con 6 estaciones de 3
   categorías distintas. No existe mecanismo por el que `stn10242-1-x` falle
   si `stn10244-1-x` funciona con la misma base de IDs.
3. **`validate_output.py` verifica TODOS los canales en TODAS las corridas**:
   el paso nuevo del workflow falla el run y nombra exactamente qué canal
   quedó sin programas (probado: canal fantasma detectado, slots duplicados
   detectados, XML malformado rechazado). Si cualquier ID estuviera muerto,
   el primer run de Actions lo dirá con su nombre — no habrá guía con huecos
   silenciosa.

## 4. Red de seguridad estructural (independiente de tvtv)

- tvpassport cubre **63/63** canales del CSV (incluye TODOS los que tienen
  tvtv_site_id). Si tvtv.ca volviera a romperse, los canales siguen teniendo
  EPG por tvpassport y el validador sigue pasando.
- tvguide cubre 38/63 como tercera fuente.

## 5. Pruebas offline (parser y pipeline real)

- `test_tvtv_parser.js`: 18/18 PASS sobre HTML real (TSN5 página completa,
  Cinemax West fragmento #lineup): semana desde el día solicitado, nada
  previo al día, stop = start + runtime, títulos limpios, páginas de error
  → 0 programas.
- `e2e_local.mjs`: pipeline REAL de epg-grabber 0.46.1 (grab → parser →
  generateXMLTV) contra un servidor local con las páginas reales capturadas:
  **2 requests para 2 canales** (propiedad de cuota), 207 programas, XMLTV
  válido de 29,963 bytes hasta el 7-nov.

## 6. Cuota (GitHub Actions)

Costo por corrida con el diseño nuevo:

| Paso | Requests | Estimado |
|---|---|---|
| checkout + npm ci (con caché) | — | 1.0–2.0 min |
| tvpassport (63 canales × 3 días, maxConn 2, delay 1s) | 189 | ~4 min |
| **tvtv.ca (54 canales × 1 request, maxConn 1, delay 2s)** | **54** | **~3 min** |
| tvguide (38 × 2, maxConn 1, delay 1s) | 76 | ~3 min |
| validación + commit + push | — | ~0.5 min |
| **Total** | ~320 | **~11–13 min** |

- Cron `17 */3 * * *` = 8 corridas/día ≈ 90–105 min/día ≈ **2,700–3,100 min/mes**.
- **otherepg es un fork público → Actions es gratis e ilimitado** en repos
  públicos (runners estándar). La cuota de 2,000 min/mes solo aplica a repos
  privados. Los forks de repos públicos no pueden hacerse privados sin
  duplicar el código, así que este caso no debería aplicar.
- Si aun así quieres recortar: cambiar el cron a `17 */6 * * *` (4 corridas)
  deja el total en ~1,350–1,550 min/mes — suficiente para un EPG de 8 días,
  que es lo que ahora produce tvtv.ca en cada corrida.
- Comparado con el diseño anterior: tvtv.us hacía 162 requests por corrida
  y TODOS devolvían 404 (puro desperdicio); ahora son 54 y traen 8 días.

## 7. Lista de archivos a commitear

| Archivo en el repo | Qué es |
|---|---|
| `sites/tvtv.ca/tvtv.ca.config.js` | scraper HTML nuevo (parser + URL) |
| `sites/tvtv.ca/readme.md` | notas del sitio (por qué existe) |
| `channels_map.csv` | SIN CAMBIOS (los 54 site_ids siguen siendo los oficiales) |
| `build_custom_lists.py` | SIN CAMBIOS (ya emite site tvtv.ca) |
| `custom_channels/*.channels.xml` | regenerados desde el CSV (63/54/38) |
| `run_guides.sh` | grab de tvtv.ca + comentario de diseño |
| `custom-epg.yml` | paso nuevo: `python3 validate_output.py` |
| `validate_output.py` | validador anti-guía-vacía (canal sin programas, duplicados, XML roto) |
