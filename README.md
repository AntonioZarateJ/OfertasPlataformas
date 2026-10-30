# SteamPulse Pro

Comparador de ofertas de juegos con wishlist local, alertas de precio y sincronización opcional con Firebase.

## Ejecutar

Necesitas Node.js 20 o posterior. Desde la carpeta del proyecto:

```sh
node server.cjs
```

Abre **http://localhost:3000**. El CSS compilado está incluido; para ejecutar la aplicación no necesitas instalar paquetes.

Se necesita conexión a internet para consultar precios y descargar portadas, iconos y fuentes. Abrir `index.html` directamente o usar un servidor sólo de archivos no permite consultar las APIs: el servidor Node identifica la aplicación ante CheapShark y evita los bloqueos del navegador.

El puerto predeterminado es 3000. Para publicar utiliza un alojamiento que ejecute Node.js, sube el proyecto con `assets` y configura `HOST=0.0.0.0` y el `PORT` que indique el proveedor. El servidor no publica archivos de configuración ni `node_modules`.

## Arquitectura

```text
Proyecto Tienda Juegos/
├── index.html                  Interfaz y modales
├── server.cjs                  Servidor, rutas API y caché de proveedores
├── package.json                Comandos y dependencias de desarrollo
├── pnpm-lock.yaml              Versiones de dependencias
├── tailwind.config.cjs         Tema y archivos que examina Tailwind
├── assets/
│   ├── css/
│   │   ├── tailwind.input.css  Entrada para generar utilidades
│   │   ├── tailwind.css        CSS generado y minificado
│   │   └── styles.css          Estilos y animaciones propios
│   └── js/
│       ├── core.js             Configuración, estado y referencias al DOM
│       ├── utils.js            Peticiones, caché, escape HTML y actualización de precios
│       ├── bootstrap.js        Inicio y servicios auxiliares
│       ├── wishlist-storage.js Persistencia y contadores
│       ├── currency.js         Conversión y presentación de importes
│       ├── navigation.js       Categorías y plataformas
│       ├── filters.js          Filtros personalizados
│       ├── giveaways.js        Regalos y directorios de promociones
│       ├── catalog.js          Ofertas, tarjetas y paginación
│       ├── search.js           Sugerencias y búsqueda
│       ├── comparator.js       Comparación y precios históricos
│       └── wishlist-cloud.js   Wishlist, alertas y Firebase
└── tests/
    ├── browser.cjs             Pruebas funcionales en navegador
    └── server.cjs              Pruebas del servidor y proxy
```

Los scripts del navegador comparten el ámbito global. Conserva su orden en `index.html`.

## Desarrollo y pruebas

Instala las dependencias de desarrollo con `pnpm install`. Si modificas clases Tailwind en HTML o JavaScript, regenera y conserva el CSS:

```sh
pnpm run build:css
```

Ejecuta todas las pruebas con `pnpm test`. La prueba de navegador necesita Chromium de Playwright (`pnpm exec playwright install chromium`) o un navegador instalado compatible. Para usar Microsoft Edge desde PowerShell:

```powershell
$env:BROWSER_CHANNEL = 'msedge'
pnpm test
```

También puedes usar `pnpm run test:server` y `pnpm run test:browser` por separado. Las capturas quedan en `test-results/`, excluido del control de versiones.

## Correcciones y rendimiento

- Búsquedas, categorías y comparador cancelan o descartan respuestas antiguas para impedir que sobrescriban la vista actual.
- Se corrigieron paginación, estados de carga, reintentos y recuperación ante errores HTTP.
- Las alertas creadas desde el comparador usan su precio actual. Se conserva un mínimo histórico de cero.
- La moneda actualiza tarjetas, wishlist y campos del comparador. Se reutilizan formateadores y se evita recalcular el diseño por cada tarjeta.
- Firebase comprueba lectura y escritura antes de confirmar éxito, serializa escrituras y conserva la copia local ante fallos.
- Los datos externos se escapan antes de insertarse en HTML. Las imágenes usan manejadores de respaldo sin interpolar código JavaScript externo.
- El catálogo inicia sin esperar a divisas y tiendas. Las tarjetas se insertan en bloques y las imágenes se cargan bajo demanda.
- Tailwind se compila previamente: ya no se descarga ni ejecuta el compilador en cada visita.
- Las consultas correctas se guardan brevemente en memoria y el servidor comparte peticiones simultáneas idénticas. Catálogo, comparador y regalos tienen caché de un minuto; divisas y tiendas, de una hora. Reiniciar el servidor vacía su caché.
- Se corrigió el desbordamiento móvil y se dio espacio suficiente al buscador en escritorio.

## Alcance de los datos

Los precios oficiales del catálogo corresponden a PC. En consola se ofrecen enlaces de búsqueda de keys; los precios orientativos de esos mercados no son cotizaciones verificadas. Los directorios de regalos se distinguen de promociones concretas y no muestran un precio normal inventado.

La wishlist se guarda en `localStorage` del navegador y del origen utilizado. Cambiar de puerto o navegador usa otro almacenamiento; exporta el JSON antes de cambiar de entorno si quieres conservar una copia.

Los precios guardados se actualizan al abrir la wishlist y al consultar ofertas o el comparador. Si una consulta falla se conserva el último precio conocido. No existe un servicio de monitoreo con la página cerrada ni envío de notificaciones por correo o Telegram.

Firebase es opcional y conserva el mecanismo existente basado en alias y URL de Realtime Database; no incorpora autenticación. Su funcionamiento real requiere una base configurada por el usuario. No se modificaron reglas ni se enviaron datos a una cuenta real durante la validación.

## Validación realizada

- 14 escenarios funcionales en Microsoft Edge: inicio sin bloqueo por servicios auxiliares, paginación, búsquedas simultáneas, cancelación de sugerencias, cambio de vista durante una consulta, persistencia de wishlist, alertas y moneda, recuperación del comparador, reintentos, escape de HTML, errores y éxito de Firebase, regalos y plataformas, filtros, caché y diseño adaptable.
- 5 pruebas del servidor: identificación de aplicación y peticiones compartidas; errores HTTP; desconexión; restricciones de archivos/rutas; MIME y revalidación de recursos.
- Integración con proveedores reales: 60 ofertas iniciales, desglose del comparador y catálogo de regalos, sin errores JavaScript no controlados. La primera carga del catálogo tardó aproximadamente 0.8 segundos en una comprobación local; el tiempo varía con la red y los proveedores.
- Interfaz comprobada en anchos de 320, 390, 768, 1024, 1280 y 1440 píxeles sin desbordamiento horizontal. Las pruebas de Firebase usan respuestas simuladas.

## Precios regionales y búsqueda

Steam México se consulta por AppID, con caché de un minuto y peticiones agrupadas. Su precio se presenta en MXN y corresponde al juego individual, no a lotes. CheapShark sigue proporcionando referencias en USD convertidas; su histórico no es un histórico mexicano. Las filas de keys sólo enlazan a búsquedas: ya no generan precios mediante factores de descuento. No se garantiza correspondencia exacta de edición o región en esos buscadores.

La búsqueda reconoce alias explícitos como GTA V, GTA 5 y RDR2. No utiliza aprendizaje automático.

Para cuentas de producción se recomienda Firebase Authentication y Firestore con documentos por UID y reglas de acceso por propietario, sustituyendo el flujo antiguo de URL de Firebase. Esta integración todavía no está implementada: requiere configurar el proyecto y los proveedores de acceso del propietario de la web.

## Acceso y región (actualización)

El panel de configuración para visitantes fue sustituido por registro, inicio de sesión y recuperación. La configuración interna y el plan de envío de alertas están en `CUENTAS-Y-ALERTAS.md`. El catálogo sólo ofrece PC. El selector de región consulta Steam por país; las referencias de CheapShark siguen siendo precios USD convertidos. Las instrucciones antiguas de Realtime Database y el historial de pruebas anterior no describen el acceso actual.

## Catálogos de consola

Se restauraron Xbox, PlayStation y Nintendo con el endpoint `/api/console-catalog`. Cambiar de plataforma o región cancela la consulta anterior y recupera su propia selección de productos. No reutiliza juegos ni descuentos de PC.

Fuentes comprobadas: catálogo público regional de Xbox, ofertas de PlayStation Store, catálogo de ofertas Nintendo y productos de Eneba por plataforma. El servidor lee datos públicos utilizados por sus páginas. Estas estructuras pueden cambiar; cada fuente informa por separado si no entrega datos. No son integraciones con garantía contractual de disponibilidad. Caché: un minuto.

La búsqueda en consolas consulta ahora los servicios de búsqueda de cada proveedor; consulta los límites en la sección de paginación. El filtro de ofertas sólo admite un precio menor al precio regular publicado. Las keys sin precio regular comprobable aparecen al desactivar el filtro. Eneba se filtra por plataforma y región declarada, pero la activación y los cargos finales se confirman en destino. No se mezclan monedas para decidir una mejor compra. La edición y la plataforma específica (incluido Switch 2) se muestran en cada tarjeta.

Los filtros de PC basados en reseñas Steam y AAA no se aplican a consolas. Los productos de consola usan metas en su moneda original, separadas de las alertas USD de PC. Las instrucciones de cuentas y alertas se conservan en `CUENTAS-Y-ALERTAS.md`.

## Búsqueda y paginación de consolas

La nueva integración usa la búsqueda de catálogo de Xbox, búsqueda y categorías de PlayStation Store, el índice público de búsqueda de Nintendo y las páginas de Eneba. Ya no filtra exclusivamente una selección inicial de ofertas. El botón Todo el Catálogo incluye precios normales; buscar por nombre desactiva el filtro de ofertas.

Cada carga muestra hasta 60 resultados y el botón Cargar más añade hasta otros 60. La aplicación reúne páginas de distinto tamaño del proveedor, descarta duplicados y cancela respuestas de consultas anteriores. Si hay pocos resultados que cumplan los filtros puede mostrar menos de 60 y permitir seguir consultando páginas. No descarga todo el catálogo de golpe.

Filtros: tienda, alcance Solo ofertas/Catálogo completo, porcentaje exacto/rango, orden por precio ascendente/descendente, descuento ascendente/descendente y reseñas disponibles de Xbox. El orden se aplica a los resultados cargados; no garantizan el orden global de todo el catálogo remoto. Las fuentes sin valoraciones no reciben puntuaciones inventadas.

La cobertura depende de la región, stock, formato y límites públicos de cada proveedor. Xbox puede devolver sólo sus primeras coincidencias en búsqueda, y algunos proveedores limitan la profundidad paginable. La interfaz no afirma haber recuperado todo el catálogo si la fuente no permite hacerlo. Las claves públicas de búsqueda de Nintendo son las del escaparate para lectura, no credenciales administrativas. Si las tiendas cambian estos servicios, se deberá actualizar el adaptador; un fallo se informa sin inventar precios.

Las pruebas nuevas cubren 60/120 resultados, ausencia de duplicados, búsqueda sin ofertas, orden por precio, presupuesto, aislamiento entre plataformas y recuperación del catálogo PC.

## Comparación de consola y registro observado

Las tarjetas de Xbox, PlayStation y Nintendo incluyen Comparar tiendas y precios. El comparador consulta de nuevo la tienda oficial y la búsqueda pública de Eneba, con juegos sin descuento incluidos. Se corrige así el caso en que Eneba no aparecía al usar su nueva búsqueda por título. Se muestran primero las tiendas oficiales; las coincidencias estrictas se separan de otras ediciones y variantes. No se comparan cuentas ni claves aleatorias como si fueran el juego completo.

G2A respondió HTTP 403 durante la comprobación. G2A, Kinguin e Instant Gaming se ofrecen como búsquedas externas sin precios verificados. No se afirma que una tienda no venda un juego sólo porque la consulta no entregue coincidencias. El comparador indica las fuentes realmente consultadas. No existe una búsqueda garantizada de todas las tiendas de internet.

El mínimo y máximo son del registro propio desde sus primeras observaciones, por producto, tienda, moneda, plataforma y región. Se conservan hasta 90 días con datos, con límite de 3000 series. Hasta contar con más de un día se muestra Historial insuficiente. No se inventa un mínimo histórico absoluto. El archivo predeterminado es `.data/price-history.json`, excluido de Git y del servidor de archivos públicos.

En Render Free ese archivo no es persistente entre reinicios o despliegues. Para conservar el registro hay que migrarlo a una base de datos o configurar `PRICE_HISTORY_PATH` en un disco persistente del alojamiento, por ejemplo `/var/data/price-history.json` sólo después de montar ese disco. No se añadió ningún servicio pagado ni un disco desde el código.

En móvil se usa un solo acceso a favoritos, uno a cuenta, una cabecera compacta y un panel Filtros y región. Los mismos controles del escritorio se reubican conservando sus eventos, filtros y valores.

## Filtros simplificados y diseño unificado

La navegación principal ahora tiene Solo ofertas, Catálogo completo y Gratis en PC. Se retiraron los presets AAA, Joyas y Descuentos extremos para evitar condiciones implícitas, así como la categoría duplicada de favoritos (se conserva su acceso en la cabecera). No hay una segunda casilla Solo ofertas ni controles de presupuesto máximo.

Solo ofertas solicita productos rebajados; Catálogo completo incluye también precios normales. Cambiar entre ambos conserva el porcentaje y la calidad seleccionados. Las búsquedas abren el catálogo completo para poder localizar juegos sin descuento.

El descuento funciona igual en PC y consolas: Cualquier porcentaje, Porcentaje exacto (10 sólo admite 10), o Rango inclusivo (10–30 admite 10, 20 y 30). Se valida de 0 a 100 en enteros y se compara con el descuento de la fuente redondeado tal como se presenta. Los rangos invertidos no se aplican. En PC se puede añadir un mínimo de reseñas positivas de Steam; esas reseñas no se asignan a consolas. Un filtro exacto de 0% necesita Catálogo completo para encontrar precios sin rebaja.

Estos filtros se aplican a páginas consultadas: si la fuente no permite ese filtro en su API, puede ser necesario cargar más resultados para encontrar coincidencias. El orden de consola sigue limitado a las coincidencias cargadas.

Consolas estrenan tarjetas con portada, etiquetas de plataforma/fuente/descuento, precio destacado y accesos a comparar y comprar. El comparador incorpora un resumen de mejor oficial consultado, mejor externo consultado y registro observado. Su diseño conserva la separación entre ediciones, monedas y alcance de la cobertura; no transforma registros insuficientes en mínimos históricos absolutos.

Se añadieron pruebas de porcentaje exacto, límites inclusivos, 0% con catálogo completo y conservación de filtros al cambiar alcance en PC y consola. Se comprobó el diseño en anchos de 320, 390, 768 y 1440 píxeles.


## Cobertura de descuentos, identidad y favoritos de consola

El filtro de PC ya consulta todas las tiendas oficiales cubiertas por CheapShark, sin limitar el catálogo a Steam. Para porcentajes exactos o rangos localiza primero el tramo de Savings mediante búsqueda binaria sobre las páginas del proveedor y después reúne coincidencias, con hasta 60 juegos por carga. Se conserva el excedente para la siguiente carga y el orden elegido se aplica a las coincidencias recuperadas. Si falla la localización se recorre el catálogo; una consulta incompleta no se presenta como inexistencia de ofertas.

El porcentaje de PC corresponde a la referencia de CheapShark en USD, que puede diferir del descuento regional de Steam. La consulta regional de Steam sigue mostrándose aparte y no sustituye la referencia de otras tiendas. El enlace de compra ahora corresponde a la tienda que publicó ese precio. Esto amplía la cobertura de la fuente; no convierte CheapShark en un inventario regional completo ni incluye automáticamente todos los mercados de claves de internet.

En consola el filtro recorre páginas posteriores hasta reunir coincidencias o agotar la paginación disponible. Nintendo recibe además el rango numérico en su consulta para reducir descargas. Se informa si una fuente falla o quedan páginas; las limitaciones de búsqueda de Xbox y la cobertura de Eneba siguen vigentes. Se consultan hasta tres páginas por interacción; cuando hay continuación se permite seguir cargando.

Las cuatro plataformas tienen un acento visual propio. Las tarjetas y el comparador de consola incluyen favoritos y precio objetivo por producto, tienda, plataforma, región y moneda original. Estas metas se almacenan separadas de las alertas USD de PC y se revisan al abrir la Wishlist. Los precios no se intercambian entre regiones ni monedas. No hay tareas periódicas ni avisos por correo activados. Las instrucciones de configuración de cuentas y notificaciones en CUENTAS-Y-ALERTAS.md se mantienen.

Las pruebas de regresión cubren coincidencias posteriores a las primeras páginas, localización de límites del descuento, cargas de 60, favoritos de las tres consolas, persistencia, metas en moneda nativa y diseño del comparador en móvil.


## Consultas acotadas y variantes oficiales

Se eliminó el barrido automático de cientos de páginas cuando fallaba la localización de un descuento. La búsqueda del tramo de CheapShark guarda su estado durante cinco minutos y avanza en tandas de hasta cuatro peticiones, con presupuesto de ocho segundos por tanda. Si sigue pendiente, se ofrece Continuar búsqueda sin afirmar que no existan ofertas. Una vez localizado, se recuperan hasta tres páginas por interacción y se conservan las coincidencias; el máximo visible añadido sigue siendo de 60 juegos.

Todas las consultas a CheapShark comparten una cola por servidor, con una petición simultánea, separación mínima de 650 ms, caché de páginas de un minuto y deduplicación de peticiones idénticas. Ante HTTP 429 se respeta Retry-After (o 30 segundos si falta), sin reintentos automáticos ni barridos alternativos. Las consolas también consultan como máximo tres páginas y disponen de un presupuesto de doce segundos por carga. Son límites por proceso; varias instancias de alojamiento necesitarían coordinar la cuota externamente.

Para Nintendo se consulta una sola ficha oficial, con caché y deduplicación, y se extraen sus referencias explícitas de variaciones desde initialApolloState. No se toman como variantes todos los productos recomendados o DLC de la página. Las versiones se muestran abiertas en tarjetas con nombre, consola, moneda, precio y enlace propio; el comparador separa Switch y Switch 2 al calcular el mejor precio de la edición seleccionada. Si no se puede consultar la ficha, se avisa y no se estiman los precios de sus variantes.


La localización de porcentajes se realiza por tienda, empezando por Steam y continuando con las tiendas recibidas de /api/stores mediante Cargar más. Esto evita el rechazo HTTP 400 Too Many Results que provoca saltar demasiado lejos en el catálogo global. Si una tienda limita el acceso a páginas profundas, se busca dentro del tramo accesible antes de ofrecer pasar a la siguiente tienda; no se repite un salto inválido ni se supone que no hay ofertas.
