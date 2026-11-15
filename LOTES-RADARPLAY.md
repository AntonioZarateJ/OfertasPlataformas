# Mejoras de RadarPlay por lotes

Cada lote se diseña y se prueba en PC, Xbox, PlayStation y Nintendo Switch. Si una tienda carece de un dato, se indica en esa plataforma.

| Lote | Qué incluye | Cómo decidir si se queda |
| --- | --- | --- |
| 1. Selección y decisión de compra | Radar de México, «¿Conviene hoy?» y comentarios editoriales. | En móvil, abrir el Radar desde la portada, entender por qué se eligió cada juego y distinguir una oferta vigente de un precio regular. En el comparador, reconocer la fuente y la región de cada referencia. |
| 2. Favoritos que se pueden revisar | «Qué cambió en mis favoritos», metas alcanzadas y «Ya lo tengo» con opción de ocultar compras. | Volver a la lista y entender en segundos qué cambió. Usar las consultas que ya hace la web y revisar el resumen antes de retomar el correo. |
| 3. Descubrimiento con contexto | Colecciones por presupuesto, guías de ediciones, fichas públicas y tarjetas para compartir. | Probar primero una colección y unas pocas fichas con texto propio. Cada página debe aportar información útil sobre el juego y conservar un enlace fácil de compartir. |
| 4. Decidir con un presupuesto | Lista de compra con total, comparación de dos juegos y reporte de precio desde la ficha. | Completar una lista de compra en una sola moneda y reportar una diferencia con los datos de plataforma, edición y región ya puestos. |
| 5. Datos para comparar mejor | Historial visual persistente, ofertas que acaban de bajar, filtros por formas de jugar, activación de claves y comparación de lotes con compras separadas. | Publicar cada dato al confirmar su fuente. Verificar que las gráficas distingan moneda, mercado, tienda y producto, y que la información sobreviva al despliegue. |
| 6. Compartir y recibir novedades | Listas compartidas, calendario de ventas y regalos, catálogos de suscripción y resumen semanal por RSS o correo. | Probar una función a la vez y medir si las personas vuelven. Las fechas y los catálogos de suscripción deben venir de fuentes comprobables. El correo se retoma cuando se decida continuar ese trabajo. |

## Cómo probar el lote 1

1. Inicia el servidor local y abre `http://localhost:3000/`. Busca **Radar de México** debajo del encabezado de resultados en móvil y escritorio. Si el puerto 3000 ya está ocupado, el iniciador admite `-Port 3001`.
2. Abre la selección y revisa las cuatro tarjetas. Confirma que cada una explique la elección e identifique plataforma, tienda y edición. Si falta un precio en MXN, usa el enlace a la tienda.
3. Abre un juego en cada plataforma. En PC, el mínimo corresponde a la referencia de CheapShark en USD. En consolas, el mensaje compara al menos tres días observados de una misma tienda, producto, región y moneda. Con menos días, indica «Historial insuficiente».
4. Si te gusta el lote, guárdalo en un commit propio. Si después de subirlo prefieres retirarlo, usa `git revert` sobre ese commit. Conviene dejar fuera de ese commit cambios que quieras conservar por separado.

La selección inicial está en `radar-mexico.html` y los seis días siguientes en `assets/js/radar-mexico-rotation.js`. El calendario cambia a medianoche de Ciudad de México. Con la colección inicial, adelanta una posición cada lunes para variar el día en que aparece cada juego. El historial aparece debajo de las tarjetas y muestra solo los días anteriores de la semana en curso. Se reinicia el lunes a medianoche. Las cotizaciones se consultan solo para la selección de hoy.

Mantener una recomendación para PC, Xbox, PlayStation y Nintendo Switch por día. Para programar selecciones nuevas sin alterar días anteriores, agrega al calendario un objeto opcional `scheduled` con una clave de fecha `AAAA-MM-DD` por día. Cada fecha usa la misma estructura de cuatro plataformas que una entrada de `rotation`. Actualiza la razón editorial, plataforma, edición, tienda, identificador exacto del producto, portada y enlace. En consolas, el término de búsqueda debe encontrar ese identificador en el catálogo oficial de México.

## Cómo probar el lote 2

1. Guarda un juego de cada plataforma. Abre **Wishlist → Qué cambió en tus favoritos** para ver bajadas, subidas y metas alcanzadas según el último precio consultado. El filtro **Solo cambios de precio** muestra la última variación detectada por juego.
2. Marca un juego con **Ya lo tengo**, activa **Ocultar juegos que ya tengo** y comprueba que reaparece al quitar el filtro. La marca se guarda con el favorito y puedes quitarla pulsando el mismo botón.
3. Comprueba que un juego marcado como comprado conserva su meta, pero queda fuera del resumen y de las consultas de precios de la lista hasta restaurarlo. Las variaciones de PC usan referencias de una misma tienda en USD. Las de consola usan la tienda, edición, región y moneda del favorito.

## Cómo probar el lote 3

1. Abre **Colección de juegos** desde el catálogo y revisa **Juegos hasta $300 MXN**. Hay una ficha por plataforma. Cada tarjeta indica si el precio de esa edición sigue dentro del presupuesto o queda pendiente de confirmar.
2. Abre una ficha y revisa por qué se eligió el juego, la edición y su enlace oficial. Usa **Compartir ficha** o **Copiar enlace** para obtener la dirección pública. Esa dirección funciona en Render cuando se despliegue el lote.
3. Revisa la guía **Cómo elegir una edición** al final de la colección.
