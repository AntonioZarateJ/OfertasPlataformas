# Revisión técnica y de seguridad — 29 de octubre de 2026

## Resultado y alcance

Se revisaron el servidor HTTP, los adaptadores de tiendas, las entradas y salidas de las APIs, la interfaz, el almacenamiento de favoritos y el código de integración de cuentas. Se corrigieron problemas funcionales y se añadieron controles de seguridad y pruebas de regresión. Esto no equivale a un pentest de producción ni garantiza ausencia absoluta de vulnerabilidades.

Los cambios están en el repositorio local. No se desplegaron en Render ni se publicaron reglas o ajustes en Firebase.

## Corrección de PC

Cambiar el orden solicitaba otra vez el catálogo, borraba las tarjetas y podía acumular llamadas y reintentos del proveedor. Ahora se ordenan los juegos cargados sin consultar de nuevo la API ni recrear las tarjetas. Se conservan portadas, eventos y precios regionales. El orden por precio usa el importe mostrado cuando hay una cotización regional disponible.

La paginación conserva el orden de consulta original: cambiar la presentación no mezcla páginas de dos órdenes distintos. Buscar, cambiar región o aplicar descuentos/reseñas sí puede necesitar una nueva consulta. Estas operaciones tienen un presupuesto de 45 segundos, compartido por los reintentos y las pausas; un `Retry-After` mayor que el tiempo restante no inicia una espera interminable. Las fuentes externas pueden seguir fallando: el servidor no puede obligarlas a responder.

El selector indica **Ordenar cargados**. No se promete un orden global de juegos que todavía no se han descargado.

## Controles aplicados

| Área | Control y comprobación |
| --- | --- |
| Parámetros HTTP | Listas permitidas por ruta, límites numéricos y de longitud, rechazo de duplicados y caracteres de control, parámetros canónicos para la caché y cursores con claves conocidas. |
| Abuso de APIs | Límite por dirección de cliente, 12 solicitudes simultáneas por proceso y cola compartida para CheapShark. Se devuelven estados 429/503 con `Retry-After`. |
| IP tras proxy | Los encabezados reenviados se ignoran por defecto. `TRUST_PROXY=1` habilita explícitamente un salto de proxy confiable; no debe activarse si los clientes pueden conectarse directamente al servidor. |
| Recursos | URL de hasta 8 KiB, cabeceras HTTP acotadas, tiempos de recepción/conexión, cuerpos de solicitud rechazados y respuestas de proveedores de hasta 6 MiB. Las cachés principales tienen límites de entradas y bytes. |
| SSRF | Las conexiones del servidor admiten únicamente HTTPS a los proveedores enumerados. Se rechazan credenciales en URLs, puertos distintos de HTTPS y redirecciones fuera del origen. No existe un proxy de URL arbitraria. |
| Archivos privados | Solo se sirven HTML y assets permitidos; se comprueba también la ruta real del archivo para impedir salir de los directorios públicos mediante enlaces simbólicos. Configuración, reglas, código del servidor e historial permanecen fuera de las rutas públicas. |
| XSS | Se mantiene el escape de contenido externo. Se retiraron los manejadores HTML inline y se añadieron eventos desde un archivo JS local. La CSP bloquea scripts y manejadores incrustados y no permite `eval`. Las pruebas intentan ejecutar ambos tipos de código y verifican que se bloquean. |
| Cabeceras | CSP, `nosniff`, protección contra marcos, política de referencia, permisos de navegador restringidos y HSTS cuando la conexión HTTPS está identificada mediante un proxy confiable o TLS directo. |
| Dependencias visuales | Font Awesome conserva una versión fija y ahora tiene verificación SRI. El SDK de Firebase sigue siendo una importación remota con versión fija, no una dependencia incluida en la auditoría de pnpm. |
| Favoritos | Esquema de campos permitidos, números finitos, URLs sin credenciales, límites de tamaño, hasta 300 favoritos y diccionarios sin prototipo. No se conservan propiedades arbitrarias del objeto recibido. |
| Sesiones | La actualización de precios descarta respuestas pertenecientes a la sesión anterior. El acceso a Firestore se basa en Firebase Auth y reglas por UID, no en un nombre enviado por el navegador. |
| Configuración | La ruta pública de configuración solo devuelve los cuatro identificadores públicos del SDK y descarta valores de formato inválido. Se excluyen del seguimiento habitual archivos `.env`, claves privadas y nombres comunes de cuentas de servicio. |

La política permite estilos inline porque existen estilos de presentación dinámicos. Esto no habilita scripts inline. Los controles por proceso no reemplazan protección de red ni una cuota distribuida si se ejecutan varias instancias.

## Validación realizada

- `npm run check`: revisión sintáctica del JavaScript del proyecto y comprobación de que el HTML no incorpora manejadores de eventos inline.
- `npm run build:css`: compilación correcta. Se conserva un aviso de mantenimiento por datos de compatibilidad Browserslist desactualizados; la auditoría de dependencias no reportó vulnerabilidades asociadas.
- `npm test`: suite completa, incluyendo acceso/registro sin configurar, regiones, filtros, orden, paginación, cancelación, favoritos, ediciones, portadas, diseño móvil y pruebas de seguridad.
- Las pruebas de orden comprueban que los seis criterios mantienen las tarjetas, no consultan otra página y conservan el cursor al cargar más. También prueban un precio regional distinto de la referencia USD.
- Las pruebas de seguridad cubren parámetros manipulados, rutas privadas, entradas duplicadas, dirección reenviada falsificada, límites de concurrencia, SSRF, redirecciones, tamaño de respuestas, cabeceras, CSP y normalización de favoritos.
- Auditoría de dependencias de pnpm: **0 vulnerabilidades conocidas reportadas**. No hay dependencias npm de ejecución; las herramientas de desarrollo sí se incluyen en esa auditoría.
- Se buscaron patrones de claves privadas, tokens de GitHub y claves de acceso AWS en los archivos de texto seleccionados del árbol de trabajo, sin coincidencias. No se inspeccionó todo el historial de Git ni credenciales del alojamiento.

Las pruebas automatizadas no sustituyen la supervisión y actualización de los servicios y bibliotecas externos.

## Antes de activar cuentas en producción

1. Desplegar y probar las reglas de `firestore.rules` contra el proyecto real o un emulador. El archivo restringe lectura y escritura al UID propietario, limita el documento de favoritos y exige una marca de tiempo del servidor. La revisión local no demuestra qué reglas están desplegadas actualmente.
2. Configurar dominios autorizados, política de contraseñas, protección contra enumeración de correos y App Check según los servicios habilitados. Aplicar cuotas y alertas de consumo en Google Cloud/Firebase.
3. Restringir la clave pública de Firebase a las APIs necesarias. La clave del SDK identifica el proyecto; no sustituye autorización ni reglas. Nunca colocar una clave privada de cuenta de servicio en esas variables públicas.
4. Probar el aislamiento con dos cuentas reales y los flujos de verificación, recuperación, cierre de sesión y renovación de credenciales. Las cuentas siguen pendientes de configuración; no se activaron durante esta revisión.

Se conservó `CUENTAS-Y-ALERTAS.md`.

## Alojamiento y mantenimiento

- Usar Node 24 actualizado; el proyecto exige como mínimo 24.22.1 y el blueprint selecciona la rama 24. Si el servicio se creó manualmente, comprobar también `NODE_VERSION` en Render: modificar el archivo no cambia por sí solo la configuración existente.
- Publicar mediante HTTPS. En Render, verificar la cadena real de proxy antes de confiar en encabezados reenviados; el blueprint habilita el modo de un salto. Para una topología distinta, ajustar la confianza antes de usarla como identidad de cuota.
- Mantener protección de red/WAF del alojamiento, límites de consumo y supervisión. No se ejecutó una prueba de carga o ataque contra el sitio público.
- Repetir auditorías y pruebas después de actualizar dependencias o adaptadores. Revisar también las notas del SDK remoto de Firebase antes de activar las cuentas.

## Referencias

- [OWASP: seguridad en Node.js](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html).
- [Node.js: controles del servidor HTTP](https://nodejs.org/api/http.html).
- [Firebase: lista de seguridad](https://firebase.google.com/support/guides/security-checklist).
- [Firebase: claves públicas y autorización](https://firebase.google.com/docs/projects/api-keys).
- [Render: protección de tráfico y proxy](https://render.com/articles/how-render-handles-ddos-attacks).
