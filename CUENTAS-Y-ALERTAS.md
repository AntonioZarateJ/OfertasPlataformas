# Activar las cuentas de SteamPulse

La guía detallada y actualizada para configurar Firebase y el servicio existente de Render está en [CONFIGURAR-FIREBASE-RENDER.md](CONFIGURAR-FIREBASE-RENDER.md).

La web incluye el diseño y la integración con Firebase Authentication y Firestore. Para activarla debes crear tu propio proyecto. Sin configuración se informa que el acceso estará disponible pronto; no se simula un registro correcto. Las contraseñas se envían a Firebase Authentication y nunca se guardan en localStorage ni en Firestore.

## Configuración del propietario

1. Crea un proyecto en Firebase Console y registra una aplicación web.
2. En Authentication → Sign-in method activa Email/Password. Configura una política de contraseñas y protección contra enumeración de correos. Añade tu dominio y localhost a los dominios autorizados si vas a probar localmente.
3. Crea Cloud Firestore en modo producción. Publica el contenido de `firestore.rules` en su pestaña Rules. No habilites escritura pública.
4. En la configuración de la aplicación web copia apiKey, authDomain, projectId y appId.
5. Define las siguientes variables de entorno en el alojamiento Node o en PowerShell antes de iniciar el servidor:

```powershell
$env:FIREBASE_API_KEY = 'valor de apiKey'
$env:FIREBASE_AUTH_DOMAIN = 'tu-proyecto.firebaseapp.com'
$env:FIREBASE_PROJECT_ID = 'tu-proyecto'
$env:FIREBASE_APP_ID = 'valor de appId'
node server.cjs
```

El servidor publica sólo esa configuración web mediante `/api/auth-config`. Es configuración pública del SDK, no una clave de administrador. Nunca agregues una cuenta de servicio a ese endpoint ni al HTML. Para pruebas locales estas variables no se cargan automáticamente desde un archivo `.env`.

6. Personaliza los correos de verificación y recuperación en Authentication → Templates, y configura su dominio de retorno. Publica la web con HTTPS.
7. Prueba con dos usuarios diferentes: cada uno debe ver sólo sus favoritos. Prueba registro, cierre de sesión, recuperación y acceso desde otro navegador. Las reglas deben rechazar una lectura usando el UID de otra persona.

## Almacenamiento

Cada usuario tiene su wishlist en `users/{uid}/data/wishlist`, dentro de `items`, con fecha `updatedAt`. Se conserva una caché local separada por UID. Al salir se recuperan los favoritos del invitado. Los favoritos del invitado no se importan automáticamente para evitar mezclar cuentas.

Las metas de PC `targetPriceUsd` son referencias en USD de CheapShark. Las metas de consola conservan tienda, región y moneda nativa. No se deben comparar objetivos USD directamente con pesos mexicanos ni convertir silenciosamente metas antiguas.

## Alertas con la página cerrada: siguiente componente del servidor

El envío automático todavía no está implementado. La interfaz guarda metas y muestra su estado al consultar la web. Para entregar alertas reales:

1. Migra cada alerta a un registro con `uid`, `steamAppID`, `region`, `currency`, `targetMinor` (centavos; yenes en unidades), `enabled`, `lastCheckedAt` y `lastNotifiedPriceMinor`. Conserva la región elegida al crearla y solicita migrar explícitamente metas antiguas.
2. Ejecuta un trabajo programado cada 1–6 horas en el servidor o Cloud Scheduler/Cloud Functions. Usa Firebase Admin sólo en ese entorno con credenciales del alojamiento. Las reglas del navegador no autorizan acceso entre usuarios.
3. Agrupa las consultas de Steam por región y AppID. Comprueba moneda, disponibilidad y antigüedad antes de comparar el precio con la meta. Si el proveedor falla, conserva el último dato y reintenta; no notifiques precios inexistentes.
4. Obtén el correo desde Authentication y envía sólo si está verificado y el usuario aceptó recibir alertas. Usa un proveedor de correo transaccional con su API key guardada exclusivamente en el servidor.
5. Usa una cola de salida y un identificador único por alerta/precio para evitar correos duplicados. Registra éxito, errores y reintentos, con límites de envío por usuario y opción para desactivar alertas.
6. Configura SPF/DKIM del dominio del remitente y prueba primero con tu propia cuenta. Verifica costos y cuotas del alojamiento y del proveedor antes de activar el trabajo.

Documentación oficial:
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/firestore/security/rules-conditions

## Plataformas y región

El catálogo incluye PC, Xbox, PlayStation y Nintendo con los adaptadores disponibles. La región seleccionada afecta las consultas regionales y su caché. CheapShark sigue siendo una referencia en USD; cada comparación debe conservar edición, plataforma, tienda y moneda.
