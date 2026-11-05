# Fase 3: App Check en observación

## Preparado

- MyappSales registrada con el proveedor reCAPTCHA Enterprise (Fraud Defense), según la captura aportada por el propietario.
- Inicialización del SDK 12.4.0 antes de acceder a Authentication o Firestore, con renovación automática de tokens.
- Nueva variable pública opcional: `FIREBASE_APPCHECK_SITE_KEY`. Usar la misma clave de sitio con la que se registró MyappSales; no una API key de Firebase, secreto ni archivo de cuenta de servicio.
- CSP admite los scripts, marcos y conexiones de reCAPTCHA necesarios, sin permitir scripts inline ni eval.
- Sin clave válida, la integración permanece desactivada. En localhost y loopback se omite el proveedor de producción. Nunca se publica ni genera un token de debug automáticamente.

## Paso actual en Render

1. Publicar estos cambios en la rama que despliega Render.
2. En el Web Service de RadarPlay, abrir Environment.
3. Añadir `FIREBASE_APPCHECK_SITE_KEY` con el valor completo de la clave de sitio de RadarPlay Web registrada en Firebase.
4. Guardar y desplegar. Esperar el estado Live del commit que incluye este cambio.
5. Comprobar `/api/auth-config`: `appCheckSiteKey` debe aparecer con el mismo valor. La clave de sitio es pública. No publicar tokens de depuración ni credenciales privadas.

## Validación antes de exigir

1. Mantener sin exigir App Check en los servicios de Firebase durante estas pruebas.
2. Abrir una ventana nueva de la web HTTPS en Render; iniciar sesión, guardar un favorito y recargar para comprobar su recuperación.
3. Repetir en otro navegador y móvil. Probar también el navegador habitual con sus ajustes de privacidad.
4. Firebase → App Check → APIs → Cloud Firestore: revisar las métricas de solicitudes verificadas, no verificadas e inválidas. Las estadísticas pueden tardar en aparecer. Guardar evidencia de que los flujos reales generan solicitudes verificadas; no basta con el estado Registrada o con que App Check se inicialice.
5. Si falla, revisar consola y red del navegador: CSP, bloqueo de reCAPTCHA por extensiones, dominio de la clave, clave registrada y errores de intercambio de tokens. No elevar a ciegas el umbral ni activar protección para intentar corregirlo.
6. Revisar cuota y consumo en Google Cloud antes de exigir. TTL de una hora conserva el valor elegido en consola; el código habilita renovación automática y no fuerza renovaciones por cada búsqueda de juegos.

No activar Exigir hasta completar las comprobaciones y preparar los entornos locales necesarios. Los visitantes que mantengan una versión antigua abierta pueden no enviar tokens hasta recargar.

## Alcance y límites

Esta integración adjunta tokens a los servicios Firebase compatibles a través del SDK. No protege automáticamente las rutas `/api/deals`, `/api/console-catalog` ni otras APIs de Render, que mantienen sus controles propios. No sustituye las reglas por UID.

Si el módulo de App Check no puede inicializarse se registra un aviso genérico y se continúa inicializando cuentas para el modo observación. Esto no evita ni desactiva las comprobaciones del servidor cuando Firebase tiene Exigir activado; el servidor rechazará tokens inválidos o ausentes. La inicialización no demuestra por sí sola que se haya obtenido un token válido.

## Desarrollo local y pasos pendientes

La clave de producción solo cubre el dominio de Render. Antes de trabajar en local con protección exigida, preparar explícitamente el proveedor de depuración y registrar su token en App Check en un entorno de desarrollo. No agregar localhost a la clave de producción ni publicar tokens de debug en Git, HTML o `/api/auth-config`.

El despliegue, las métricas reales, la cuota y la activación posterior de Exigir siguen pendientes. Esta fase no activa alertas por correo ni cambia planes de facturación.

Referencias: [integración web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [CSP de reCAPTCHA](https://docs.cloud.google.com/recaptcha/docs/faq), [depuración](https://firebase.google.com/docs/app-check/web/debug-provider).
