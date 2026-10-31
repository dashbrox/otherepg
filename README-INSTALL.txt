ACTUALIZACION PARA dashbrox/otherepg — TVTV.us LINEUP
====================================================

Lineup predeterminado:
https://www.tvtv.us/10080/lineup/luUSA-NY63086-X/

IMPORTANTE: esta actualización está preparada específicamente para
https://github.com/dashbrox/otherepg y se integra como una CUARTA guía
independiente. No sustituye la guía tvtv.ca actual y no modifica las
fuentes TV Passport ni TV Guide.

ESTADO VERIFICADO DEL REPOSITORIO
---------------------------------
El repositorio ya contiene:
- sites/tvtv.us/tvtv.us.config.js usando /partial/source/{timestamp}/{stationId}
- sites/tvtv.us/tvtv.us.adapter.js usando FlareSolverr para Cloudflare
- package.json con cheerio y csv-parser
- channels_map.csv con la columna tvtv_site_id

Por eso este paquete añade solamente los archivos de integración que faltan.
No reemplaces run_guides.sh, build_custom_lists.py, validate_output.py,
custom-epg.yml ni filter-epg-us.yml.

ARCHIVOS A COPIAR A LA RAÍZ DEL REPOSITORIO
-----------------------------------------
1. .github/workflows/tvtv-us-lineup.yml                 (NUEVO)
2. scripts/commands/epg/tvtv-us-lineup.js                (NUEVO)
3. validate_tvtv_us.py                                  (NUEVO)

El script lee channels_map.csv, toma los valores de tvtv_site_id, consulta
el template#channels-template del lineup y genera
custom_channels/tvtv.us.channels.xml únicamente con los canales que están
en ESE lineup y que también aparecen en tu mapa.

El workflow arranca FlareSolverr, descubre canales, ejecuta el grabber existente
con sites/tvtv.us/tvtv.us.config.js, valida el XMLTV y publica:
custom-guides/tvtv-us.xml.gz

INSTALACIÓN
-----------
1. Descarga y descomprime este ZIP.
2. Copia las carpetas .github y scripts, y el archivo validate_tvtv_us.py,
   a la raíz de dashbrox/otherepg. Conserva los archivos que ya existen.
3. Haz commit y push a la rama master.
4. Abre GitHub > Actions > Generate TVTV.us lineup guide.
5. Pulsa Run workflow. Para la primera prueba deja el lineup predeterminado
   y selecciona 2 días.
6. Revisa los pasos Discover channels, Scrape TVTV.us, Validate XMLTV y
   Publish TVTV.us guide.

URL DEL RESULTADO (después de una ejecución exitosa)
---------------------------------------------------
https://raw.githubusercontent.com/dashbrox/otherepg/master/custom-guides/tvtv-us.xml.gz

La guía actual de TVTV.ca sigue en custom-guides/tvtv.xml.gz; no se sobrescribe.

IMPORTANTE SOBRE LA EJECUCIÓN
----------------------------
- No se ha podido ejecutar el scraper contra Cloudflare desde este entorno.
  La primera ejecución real de GitHub Actions es la prueba de aceptación.
- Si Cloudflare bloquea la IP del runner, el workflow fallará y NO publicará
  una guía vacía.
- Si un tvtv_site_id de channels_map.csv no aparece en el lineup NY63086,
  ese canal se omitirá y quedará listado en output/tvtv-us-lineup-report.json.
- Se usa el mismo grupo de concurrencia `epg-custom-guides` que custom-epg.yml
  para evitar que ambos workflows escriban custom-guides al mismo tiempo.
- El workflow de TVTV.us se programa una vez al día a las 07:43 UTC
  (01:43 en America/Mexico_City). También puede ejecutarse manualmente.
