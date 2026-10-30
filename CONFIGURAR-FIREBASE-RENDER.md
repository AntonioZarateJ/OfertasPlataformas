# Configurar Firebase y Render paso a paso

Guía para el código actual, revisada el 29 de octubre de 2026.

## Qué se activa con esta configuración

| Funcionalidad | Estado del proyecto |
| --- | --- |
| Registro con nombre, correo y contraseña | Integrado con Firebase Authentication; falta tu configuración. |
| Inicio/cierre de sesión y recuperación | Integrados. El identificador de acceso es el correo. |
| Verificación del correo | Integrada con los correos de Firebase. |
| Favoritos y metas guardados por cuenta | Integrados con Cloud Firestore. |
| Estado de la meta al consultar la Wishlist | Implementado con el último precio consultado. |
| Correos automáticos con la página cerrada | Pendientes de implementar: necesitan un trabajo programado y un proveedor de correo. |
| App Check en el navegador | Pendiente de integrar antes de exigir tokens. |

Firebase Authentication administra las contraseñas; no se guardan en Firestore, localStorage ni en nuestro servidor Node.

## Arquitectura recomendada

Conservar el Web Service de Render para la web y las consultas de precios. Usar Firebase Authentication para las cuentas y Cloud Firestore para sus favoritos y objetivos. No hace falta mover la web a Firebase Hosting ni crear otra web en Render.

Se puede empezar con Spark para las pruebas de Authentication/Firestore dentro de sus cuotas. Las funciones desplegadas requieren Blaze; no hace falta activarlo para completar el login de esta guía. Revisar los planes oficiales antes de contratar servicios.

## 1. Crear el proyecto Firebase y registrar la aplicación

1. Entrar a https://console.firebase.google.com/ y elegir Crear/Añadir proyecto.
2. Poner un nombre, por ejemplo SteamPulse, y anotar el Project ID asignado. Puede ser distinto del nombre visible.
3. Google Analytics no es necesario para el login; puede dejarse desactivado para comenzar.
4. Abrir el engrane → Configuración del proyecto → General → Tus aplicaciones.
5. Registrar una aplicación Web con el icono `</>` y asignarle un nombre.
6. No activar Firebase Hosting para este despliegue en Render.
7. Conservar el objeto `firebaseConfig` mostrado. Se puede consultar después en la configuración del SDK de esa aplicación web.

No se necesita descargar una clave privada de cuenta de servicio para el login.

## 2. Habilitar correo y contraseña

1. Abrir Authentication y pulsar Comenzar si es la primera vez.
2. En Método de acceso / Sign-in method, habilitar Email/Password y guardar.
3. No se necesitan enlace de correo, teléfono, Google ni acceso anónimo para el código actual.
4. En Settings, revisar la política de contraseñas. Se recomienda exigir al menos 12 caracteres; los requisitos se hacen cumplir en Firebase.
5. Revisar y habilitar la protección contra enumeración de correos si no está activa.

En Authentication → Users aparecerán las cuentas registradas, su correo y su UID. Sus contraseñas no se muestran.

## 3. Autorizar el dominio de Render

En Authentication → Settings → Authorized domains, añadir el dominio exacto del servicio:

```text
salesplataforms.onrender.com
```

No incluir `https://`, barra final ni rutas. Si cambias la dirección del servicio, usar su dominio real. Si añades un dominio propio, autorizar también ese dominio concreto.

Para desarrollo, autorizar `localhost` en el proyecto de pruebas. Los proyectos recientes no lo incluyen necesariamente por defecto. No es necesario autorizarlo en producción si no se va a usar allí.

## 4. Crear Firestore y publicar las reglas

1. Abrir Firestore Database, no Realtime Database.
2. Crear una base Standard con identificador `(default)`, compatible con los SDK nativos.
3. Elegir modo Producción para iniciar con acceso restringido.
4. Revisar y elegir la ubicación de la base; anotarla para el futuro trabajo de alertas.
5. Abrir Rules / Reglas.
6. Copiar el contenido completo de `firestore.rules` del repositorio, reemplazar el contenido del editor y pulsar Publicar.

No habilitar escritura pública. Las reglas del proyecto restringen el documento de favoritos al UID propietario, limitan su contenido y exigen una marca de tiempo del servidor.

La aplicación crea el documento al guardar el primer favorito o meta después de entrar:

```text
users
  UID_DEL_USUARIO
    data
      wishlist
        items: { ... }
        updatedAt: timestamp
```

No hay que crear manualmente una colección por cuenta. Una cuenta recién registrada y sin favoritos puede no tener aún un documento en Firestore.

Subir cambios a GitHub o desplegar Render no publica estas reglas: su publicación en Firebase es independiente.

## 5. Conectar el servicio existente de Render

Antes, subir los cambios actuales al repositorio y comprobar que Render despliega esa rama.

1. Entrar a https://dashboard.render.com/ y abrir el Web Service existente.
2. Ir a Environment → Environment Variables.
3. Añadir estas variables copiando los valores exactos del objeto `firebaseConfig`:

| Variable en Render | Campo de Firebase |
| --- | --- |
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_APP_ID` | `appId` |

Introducir solo el valor, sin comillas adicionales ni el objeto JSON entero. `authDomain` es el dominio entregado por Firebase, normalmente `tu-proyecto.firebaseapp.com`, no la URL de Render.

No hacen falta `databaseURL`, `storageBucket`, `messagingSenderId` ni `measurementId` para las funciones actuales.

Revisar también el servicio:

| Ajuste | Valor |
| --- | --- |
| `HOST` | `0.0.0.0` |
| `NODE_VERSION` | `24`, con un parche actualizado compatible con package.json |
| Build Command | `npm install --include=dev && npm run build:css` |
| Start Command | `npm start` |
| `PORT` | Lo proporciona Render; no fijarlo a 3000. |

El blueprint contempla `TRUST_PROXY=1` detrás de un proxy confiable. Revisar `SEGURIDAD.md` si la topología es distinta. Modificar `render.yaml` no cambia automáticamente las variables de un servicio creado manualmente.

4. Elegir Save, rebuild, and deploy si también se publica código. Si solo cambian las variables y ya está el código correcto, Save and deploy reutiliza el build existente.
5. Esperar a que el servicio figure como Live.

No pegar contraseñas personales ni claves privadas de administrador en estas variables públicas.

## 6. Verificar la conexión

Abrir:

https://salesplataforms.onrender.com/api/auth-config

Debe devolver un objeto JSON con `apiKey`, `authDomain`, `projectId` y `appId`. Si quedan vacíos, comprobar los valores y la versión desplegada. El servidor descarta formatos inválidos, por ejemplo una URL completa en vez de un dominio.

Estos cuatro identificadores del SDK están diseñados para ser públicos. La protección depende de Authentication, reglas y controles de acceso. No son credenciales de administrador.

Al recargar la web, el código consulta ese endpoint e inicializa Firebase; no hace falta pegar configuración en el HTML.

## 7. Verificación y recuperación por correo

En Authentication → Templates, revisar el idioma y el nombre del proyecto/remitente de los mensajes de verificación y recuperación.

Mantener inicialmente la URL de acción alojada por Firebase. La web de Render no implementa una pantalla que procese `oobCode`, `verifyEmail` o `resetPassword`. Reemplazar el controlador por la portada de Render rompería esos enlaces.

Después de verificar el correo, cerrar sesión y volver a entrar para comprobar el estado actualizado. Un retorno automático a Render o una pantalla propia requiere añadir su código correspondiente, no cambiar solo una URL de la consola.

Estos correos de acceso son distintos de los correos de ofertas de juegos.

## 8. Probar cuentas y favoritos

1. Registrarse desde la URL de Render con una cuenta de prueba.
2. Comprobar la cuenta en Authentication → Users.
3. Verificar el correo y volver a iniciar sesión.
4. Con la sesión iniciada, guardar un favorito y una meta.
5. Comprobar el documento `users/{uid}/data/wishlist` en Firestore y sus campos `items`/`updatedAt`.
6. Cerrar sesión, abrir otro navegador o ventana privada y entrar con la misma cuenta: debe recuperar lo guardado.
7. Crear una segunda cuenta: no debe ver los favoritos de la primera.
8. Probar Olvidé mi contraseña y completar el restablecimiento en el controlador de Firebase.
9. En el simulador de reglas, comprobar que una petición sin autenticar se rechaza y que el UID B no puede leer `users/UID_A/data/wishlist`.

Los favoritos del invitado no se importan automáticamente al entrar. Para la prueba, iniciar sesión antes de guardar. Tampoco se trasladan automáticamente los datos locales de localhost o GitHub Pages al dominio de Render.

La sincronización actual guarda un mapa completo por usuario y recupera el remoto al autenticar. Todavía no hay escucha en tiempo real ni resolución de ediciones simultáneas: si dos dispositivos editan a la vez, prevalece el último guardado. Para probar recuperación, volver a iniciar sesión en el segundo navegador después de guardar. El siguiente ajuste recomendado es separar los elementos en documentos individuales y sincronizarlos en tiempo real.

## 9. App Check: no exigir tokens antes de integrarlo

El código actual no inicializa App Check. No activar Enforcement / Aplicar en Firestore o Authentication antes de integrar y desplegar el SDK y ajustar la CSP para el proveedor elegido: se bloquearía a usuarios legítimos.

La secuencia será registrar aplicación/proveedor, integrar el SDK y la configuración de desarrollo, desplegar, revisar métricas y después exigir tokens. Las reglas privadas permanecen activas desde el principio.

## 10. Correos automáticos de ofertas: componente pendiente

### Prueba inicial de Resend sin dominio propio

La web sigue en Render. Para comprobar la entrega antes de implementar el trabajo de alertas, crear una cuenta de Resend y una clave con permiso Sending access. Sin dominio verificado, el remitente `onboarding@resend.dev` solo permite entregar al correo asociado a esa cuenta de Resend; no habilita envíos a los demás usuarios.

En Windows, abrir PowerShell y ejecutar desde la raíz del repositorio:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\probar-resend.ps1
```

`ExecutionPolicy Bypass` se aplica únicamente a ese proceso. El script solicita el correo destinatario y la clave oculta, envía un solo correo de configuración y no almacena la clave en archivos ni variables de entorno. No pegar la clave en el chat, el código ni argumentos del comando. El proceso conserva la credencial en memoria durante la petición y termina al completar la prueba.

Confirmar la recepción real y el estado Delivered en Resend → Emails. Una respuesta aceptada de la API no garantiza la entrega al buzón. Ante timeout o respuesta incierta, revisar ese panel antes de repetir para evitar correos duplicados. Esta prueba no lee Firestore ni consulta ofertas y no activa alertas automáticas. No hace falta desplegar el script en Render.

Con los pasos anteriores se guardan las metas en la cuenta. Eso no envía correos con la página cerrada. No existe todavía un worker ni un comando de despliegue de alertas en este repositorio.

Se recomienda añadir Cloud Functions for Firebase + Cloud Scheduler, manteniendo la web en Render. Un temporizador dentro del Web Service gratuito no garantiza la ejecución cuando el servicio se suspende.

El componente necesita:

1. Blaze/facturación, avisos de presupuesto y cuotas. Los avisos no constituyen un límite automático de gasto.
2. Documentos individuales de alertas por UID con producto, edición, tienda, plataforma, región, moneda, objetivo en unidades menores, `enabled` y marcas de revisión/notificación. El mapa `items` actual no equivale a esa nueva colección.
3. Reconfirmar las metas de PC: `targetPriceUsd` se basa en la referencia USD de CheapShark. Las metas de consola conservan moneda y región nativas. No convertir silenciosamente metas antiguas.
4. Un trabajo, inicialmente cada seis horas, que agrupe consultas y compare solo precios vigentes y monedas coincidentes, respetando los límites del proveedor.
5. Firebase Admin exclusivamente en el servidor del trabajo, mediante identidad administrada y permisos necesarios; no credenciales privadas en el navegador.
6. Un proveedor transaccional, por ejemplo Resend, con un dominio remitente verificado y su clave de envío en secretos del worker.
7. Consentimiento del usuario y correo verificado obtenido desde Authentication. Añadir controles para activar/desactivar avisos.
8. Bloqueo de trabajos superpuestos, cola de salida, identificadores de entrega y límites por usuario para evitar avisos duplicados cada seis horas.
9. Pruebas con la cuenta del propietario: moneda, fallos de proveedor, duplicados, bajas y ejecución con la página cerrada.

Este es el diseño del código que falta implementar; no se activa con las cuatro variables de Render. Render Cron Jobs es otra alternativa de programación, con configuración de credenciales y facturación propias; no hace falta contratar ambos programadores.

## Problemas frecuentes

| Síntoma | Comprobación |
| --- | --- |
| El acceso dice que estará disponible pronto | `/api/auth-config`, campos vacíos/incorrectos y versión desplegada. |
| `auth/operation-not-allowed` | Email/Password habilitado. |
| `auth/unauthorized-domain` | Dominio exacto de Render en Authorized domains. |
| Cuenta creada, pero no hay documento de favoritos | Guardar un favorito después de entrar; revisar proyecto, base `(default)`, reglas y UID. |
| `Missing or insufficient permissions` | Sesión, ruta de propietario, reglas publicadas y App Check no exigido antes de integrar tokens. |
| Enlaces de correo rotos | Conservar el controlador de acción de Firebase hasta implementar uno propio. |
| Correo todavía sin verificar | Completar verificación, cerrar sesión y volver a entrar. |
| Primera visita a Render lenta | El servicio gratuito puede estar suspendido por inactividad. |
| No llega un correo de oferta | El trabajo automático todavía no está implementado. |

## Referencias oficiales

- [Authentication](https://firebase.google.com/docs/auth/web/password-auth).
- [Firestore](https://firebase.google.com/docs/firestore/quickstart).
- [Reglas](https://firebase.google.com/docs/firestore/security/get-started).
- [Claves públicas](https://firebase.google.com/docs/projects/api-keys).
- [App Check](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).
- [Variables en Render](https://render.com/docs/configure-environment-variables).
- [Plan gratuito de Render](https://render.com/docs/free).
- [Funciones programadas](https://firebase.google.com/docs/functions/schedule-functions).
- [Requisitos para desplegar Functions](https://firebase.google.com/docs/functions/get-started).
- [Dominios en Resend](https://resend.com/docs/dashboard/domains/introduction).
