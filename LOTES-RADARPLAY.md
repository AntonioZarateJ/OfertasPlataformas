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

1. Inicia el servidor local y abre `http://localhost:3000/`. En móvil, busca el enlace **Radar de México** junto al tipo de cambio. En escritorio está encima de las ofertas.
2. Abre la selección y revisa las cuatro tarjetas. Confirma que cada una explique la elección e identifique plataforma, tienda y edición. Si falta un precio en MXN, usa el enlace a la tienda.
3. Abre un juego en cada plataforma. En PC, el mínimo corresponde a la referencia de CheapShark en USD. En consolas, el mensaje compara al menos tres días observados de una misma tienda, producto, región y moneda. Con menos días, indica «Historial insuficiente».
4. Si te gusta el lote, guárdalo en un commit propio. Si después de subirlo prefieres retirarlo, usa `git revert` sobre ese commit. Conviene dejar fuera de ese commit cambios que quieras conservar por separado.

La selección está en `radar-mexico.html`. Mantener una recomendación para PC, Xbox, PlayStation y Nintendo Switch en cada edición. Al rotar una tarjeta, actualizar la razón editorial, plataforma, edición, tienda, identificador exacto del producto, portada y enlace. En consolas, el término de búsqueda debe encontrar ese identificador en el catálogo oficial de México. Las cotizaciones se consultan al visitar la página.
