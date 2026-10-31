# Tres guías EPG con canales personalizados

Este paquete prepara tres listas independientes para `epg-grabber`:

- TV Passport (`tvpassport.com`)
- TVTV.us (`tvtv.us`)
- TV Guide (`tvguide.com`)

Cada lista contiene solamente los canales cuyas columnas `site_id` estén rellenadas en `channels_map.csv`.

## 1. Dónde colocar los archivos

Copia `build_custom_lists.py`, `channels_map.csv`, `run_guides.sh` y la carpeta `custom_channels` dentro de la raíz de tu clon de `otherepg` (la misma carpeta donde está `package.json`).

## 2. Cómo pedir canales

Edita `channels_map.csv`. Cada fila representa un canal de salida y conserva el mismo `xmltv_id` en las tres guías. Completa únicamente los `site_id` disponibles para cada fuente; deja en blanco la columna de una fuente si no ofrece ese canal.

Columnas:

- `xmltv_id`: identificador que quieres que aparezca en la guía final y que debe coincidir con tu playlist/filtro.
- `name`: nombre legible del canal.
- `tvpassport_site_id`: ID de TV Passport, incluida la parte después de `/`.
- `tvtv_site_id`: ID numérico de TVTV.us.
- `tvguide_site_id`: ID numérico de TV Guide.
- `lang`: idioma del canal, normalmente `en`.

El archivo incluye una fila de prueba para HBO Drama / HBO Signature (HBO 3), con los tres IDs comprobados en los catálogos actuales del repositorio:

- TV Passport: `hbo-signature-hbo-3--eastern-hd/7099`
- TVTV.us: `10243`
- TV Guide: `9233008160`

La equivalencia de HBO Signature/HBO 3 con `HBODrama.us` es una decisión de mapeo para mantener el identificador de salida que ya utiliza tu guía. Cambia `xmltv_id` si tu lista de canales usa otro ID.

## 3. Instalar y ejecutar

Desde la raíz de `otherepg`:

```bash
npm install
bash run_guides.sh
```

Se generan:

```text
output/tvpassport.xml
output/tvpassport.xml.gz
output/tvtv.xml
output/tvtv.xml.gz
output/tvguide.xml
output/tvguide.xml.gz
```

También puedes ejecutar cada fuente por separado después de construir las listas:

```bash
python3 build_custom_lists.py
npm run grab -- --channels=custom_channels/tvpassport.channels.xml --output=output/tvpassport.xml --gzip --maxConnections=2 --delay=1000
npm run grab -- --channels=custom_channels/tvtv.channels.xml --output=output/tvtv.xml --gzip --maxConnections=1 --delay=2000
npm run grab -- --channels=custom_channels/tvguide.channels.xml --output=output/tvguide.xml --gzip --maxConnections=1 --delay=1000
```

## 4. Limitaciones conocidas de las fuentes

- TV Passport: el scraper actual extrae descripción, subtítulo, año, categorías, clasificación, actores, invitados, director e imagen.
- TV Guide: consulta los detalles del programa e intenta recuperar descripción, temporada y número de episodio.
- TVTV.us: la consulta de detalles adicionales está comentada en el scraper actual por errores HTTP 429 y demoras. En su estado actual suele proporcionar título y subtítulo, no el conjunto completo de metadatos.

Las guías se generan por separado. Este paquete no modifica `main.py`, no modifica los XML de otros países y no cambia la selección de fuentes de tu guía general.
