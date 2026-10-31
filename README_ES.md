# Tres guías EPG de EE. UU. con canales personalizados

Este paquete prepara y genera tres guías XMLTV independientes, limitadas a los canales definidos en `channels_map.csv`:

- TV Passport (`tvpassport.com`)
- TVTV.us (`tvtv.us`)
- TV Guide (`tvguide.com`)

No descarga el catálogo completo de cada sitio: `epg-grabber` recibe una lista XML propia para cada fuente mediante `--channels`.

## 1. Dónde colocar los archivos

Copia el contenido de este paquete en la raíz de tu clon de `otherepg`, junto a `package.json`. Conserva también la carpeta `.github/workflows/custom-epg.yml` en esa misma ubicación relativa.

La estructura queda así:

```text
otherepg/
├── .github/
│   └── workflows/
│       └── custom-epg.yml
├── custom_channels/
├── channels_map.csv
├── build_custom_lists.py
├── run_guides.sh
└── package.json
```

## 2. Dónde añadir o solicitar canales

Edita únicamente `channels_map.csv`. Cada fila representa un canal lógico y debe tener estas columnas:

- `xmltv_id`: ID que quieres conservar en la guía final y que debe coincidir con tu playlist o filtro.
- `name`: nombre legible del canal.
- `tvpassport_site_id`: identificador exacto que utiliza el scraper de TV Passport.
- `tvtv_site_id`: identificador exacto que utiliza TVTV.us.
- `tvguide_site_id`: identificador exacto que utiliza TV Guide.
- `lang`: idioma, normalmente `en`.

Ejemplo:

```csv
xmltv_id,name,tvpassport_site_id,tvtv_site_id,tvguide_site_id,lang
HBODrama.us,HBO Drama,hbo-signature-hbo-3--eastern-hd/7099,10243,9233008160,en
```

Para añadir un canal, agrega una fila. Completa solamente los `site_id` que hayas verificado para ese mismo canal. Deja en blanco el campo de una fuente cuando no tenga cobertura. No inventes ni reutilices un ID de otro canal.

El mismo `xmltv_id` se escribe en las tres listas generadas, de modo que las guías se puedan comparar y combinar después sin cambiar el identificador del canal.

## 3. Qué hace GitHub Actions

El workflow `.github/workflows/custom-epg.yml` tiene tres disparadores:

1. **Cada 3 horas:** genera las guías automáticamente con el cron `17 */3 * * *` (horario UTC de GitHub Actions; minuto 17 de las horas 00, 03, 06, 09, 12, 15, 18 y 21). GitHub puede retrasar algunas ejecuciones si hay alta carga.
2. **Al cambiar la lista:** un `push` a `master` que modifique `channels_map.csv` inicia una generación nueva.
3. **Manual:** puedes ejecutarlo desde GitHub → Actions → `Generate custom US EPG guides` → `Run workflow`.

El workflow instala las dependencias de Node, prepara las listas personalizadas, ejecuta los tres scrapers con `--days=3` (tres días de programación por fuente), valida que los archivos comprimidos no estén vacíos y que sean gzip válidos, y publica los resultados en `custom-guides/`.

Activa el permiso de escritura para Actions en el repositorio:

`Settings → Actions → General → Workflow permissions → Read and write permissions`.

El workflow declara `contents: write`, pero la política de la cuenta o del repositorio puede restringirlo. Sin permiso de escritura, la generación puede terminar correctamente pero no podrá guardar los archivos en el repositorio.

## 4. Archivos resultantes

Después de una ejecución correcta, el repositorio tendrá:

```text
custom-guides/
├── tvpassport.xml.gz
├── tvtv.xml.gz
└── tvguide.xml.gz
```

Los enlaces raw tendrán esta forma:

```text
https://raw.githubusercontent.com/USUARIO/REPOSITORIO/master/custom-guides/tvpassport.xml.gz
https://raw.githubusercontent.com/USUARIO/REPOSITORIO/master/custom-guides/tvtv.xml.gz
https://raw.githubusercontent.com/USUARIO/REPOSITORIO/master/custom-guides/tvguide.xml.gz
```

Sustituye `USUARIO/REPOSITORIO` por la ruta real de tu fork. Los enlaces existirán después de la primera ejecución exitosa que publique los archivos.

## 5. Ejecución local opcional

Desde la raíz de `otherepg`:

```bash
npm ci
bash run_guides.sh
```

Los archivos comprimidos se generan en `output/`, cada uno con hasta 3 días de programación solicitados a la fuente. GitHub Actions los copia a `custom-guides/` y los confirma en el repositorio.

## 6. Diferencias de cobertura y metadatos

- **TV Passport:** el scraper puede extraer descripción, subtítulo, año, categorías, clasificación, actores, invitados, director e imagen.
- **TV Guide:** consulta detalles del programa e intenta recuperar descripción, temporada y número de episodio.
- **TVTV.us:** la consulta de detalles adicionales está desactivada en el scraper actual por errores HTTP 429; úsala como fuente comparativa/respaldo, no asumas que tendrá la misma riqueza de metadatos.

Las tres guías se mantienen independientes. Este paquete no cambia `my-filter/main.py` ni las guías de otros países.

## 7. Importante sobre los IDs de ejemplo

La fila de HBO es una configuración inicial de prueba. Antes de depender de ella, confirma que cada `site_id` corresponda al feed exacto que quieres. En particular, que dos sitios utilicen nombres comerciales parecidos no garantiza que sean el mismo feed ni la misma zona horaria.
