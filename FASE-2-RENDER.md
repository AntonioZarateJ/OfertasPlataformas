# Fase 2: HTTPS y consejos de compra

## Comprobación inicial

La web pública responde mediante HTTPS y entrega CSP y X-Frame-Options. En la comprobación inicial de esta fase no se recibió Strict-Transport-Security (HSTS).

El servidor ya envía `Strict-Transport-Security: max-age=31536000` cuando reconoce TLS directo o `X-Forwarded-Proto: https` con `TRUST_PROXY=1`. La ausencia de HSTS no demuestra por sí sola qué variable o versión está desplegada.

## Configuración del servicio existente

1. Abre Render y selecciona el **Web Service** que sirve `salesplataforms.onrender.com`.
2. Abre **Environment** y revisa la variable `TRUST_PROXY`.
3. Para este servicio detrás del proxy de Render, establece `TRUST_PROXY` en `1` si está ausente o tiene otro valor. No cambies las variables de Firebase.
4. Guarda los cambios y despliega. Si ya era `1`, comprueba el commit desplegado y las cabeceras antes de cambiar otra configuración.
5. Tras el despliegue, verifica la cabecera HSTS en la respuesta pública HTTPS. En PowerShell: `curl.exe -I https://salesplataforms.onrender.com/`.
6. Comprueba también la redirección HTTP: `curl.exe -I http://salesplataforms.onrender.com/`. Debe redirigir a la dirección HTTPS.

Modificar `render.yaml` no actualiza automáticamente las variables de un servicio creado manualmente. Esta opción confía también en las cabeceras de IP reenviadas para limitar solicitudes: no debe habilitarse en un servidor expuesto directamente a clientes sin un proxy confiable. Si cambia la topología, hay que revisar la cadena de proxy y los límites por IP.

## Cambio de interfaz

El bloque del comparador de PC pasa de anunciar un escudo contra estafas a mostrar consejos: revisar vendedor y reembolsos, código y edición, región de activación y cargos finales. Se indica que RadarPlay no verifica vendedores ni garantiza transacciones. No cambia la búsqueda ni los precios.

## Estado

- Pruebas de reglas aportadas por el usuario: lectura propia permitida; lectura ajena, borrado ajeno y lectura sin autenticación rechazados. No constituyen una auditoría completa de todas las escrituras.
- Añadida regresión automatizada para HSTS con proxy autorizado, cabecera reenviada no confiable y HTTP, sobre página, API y error 404.
- Configuración y comprobación final de HSTS en producción: pendientes del despliegue y de revisar Environment en Render.
- App Check, privacidad, contacto y eliminación de cuenta: fases posteriores.
