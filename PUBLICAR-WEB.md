# Publicar la web de prueba en Render

GitHub Pages publica archivos estáticos, pero este proyecto consulta precios a través de un servidor Node.js (`server.cjs`). Por eso la interfaz abre en Pages y las llamadas a `/api/deals`, `/api/console-catalog`, etc., fallan: allí no se ejecuta ese servidor.

## Publicación manual

1. Sube los archivos del proyecto y estos nuevos archivos a tu repositorio `AntonioZarateJ/OfertasPlataformas`.
2. Entra a https://dashboard.render.com/ y conecta tu cuenta de GitHub.
3. Selecciona **New → Web Service**, elige el repositorio y la rama que contiene los cambios actuales.
4. Configura:

| Campo | Valor |
| --- | --- |
| Language / Runtime | Node |
| Root Directory | Vacío si `package.json` está en la raíz del repositorio |
| Build Command | `npm install --include=dev && npm run build:css` |
| Start Command | `npm start` |
| Instance Type | Free, para esta prueba |
| Environment: `HOST` | `0.0.0.0` |
| Environment: `NODE_VERSION` | `24.22.1` |

Si subiste el proyecto dentro de una subcarpeta del repositorio, usa como Root Directory esa carpeta, donde están `package.json` y `server.cjs`. El nombre de tu carpeta local no significa que debas introducirlo aquí.

Render proporciona `PORT` automáticamente. El servidor ya lo utiliza. `HOST=0.0.0.0` permite que Render alcance el proceso; el valor local predeterminado `127.0.0.1` no sirve para recibir tráfico público dentro de ese alojamiento.

5. Pulsa **Create Web Service**. Revisa el registro del build y del inicio. Al finalizar Render proporciona la URL HTTPS real del servicio bajo `onrender.com`; usa esa dirección para abrir la aplicación completa.
6. Cuando la conexión se hace a través de tu proveedor GitHub, los siguientes pushes a la rama vinculada pueden activar los despliegues automáticos según la configuración del servicio.

## Alternativa con configuración del repositorio

Incluí `render.yaml` con esos mismos valores. Una vez subido, puedes usar **New → Blueprint**, seleccionar el repositorio y revisar la configuración antes de crear el servicio. Usa esta opción o el alta manual; no necesitas crear ambos servicios.

## Qué probar después de publicar

- Abre la página y consulta PC, Xbox, PlayStation y Nintendo.
- Prueba búsqueda por nombre, cambio de región y Cargar más.
- Abre `/api/auth-config` en la misma URL: debe devolver JSON. Sin variables de Firebase devuelve campos vacíos; eso es normal en esta fase.
- Comprueba `/api/deals?pageSize=1`: debe responder un JSON con datos del proveedor, o un error HTTP del proveedor si no está disponible. No debe responder una página de GitHub ni un 404 de archivo.
- Si un catálogo falla, revisa la respuesta de esa ruta en Network del navegador y los logs de Render. Cada tienda puede limitar o bloquear peticiones desde IP de centros de datos; que funcione localmente no garantiza que todas permitan el alojamiento elegido.

Las cuentas todavía requieren configurar Firebase. No necesitas hacerlo para probar los catálogos. Las instrucciones de cuentas y alertas permanecen en `CUENTAS-Y-ALERTAS.md`.

## Consideraciones del plan de prueba

El servicio gratuito se suspende tras 15 minutos sin tráfico. La siguiente visita puede tardar aproximadamente un minuto mientras vuelve a arrancar. No es una medición del rendimiento normal del catálogo. Tiene cuotas y límites de tráfico, incluidos límites para consultas salientes; revisa el plan antes de abrirlo a muchos usuarios.

La caché del servidor se vacía cuando reinicia. La wishlist del invitado depende del navegador y del dominio: los favoritos guardados en localhost o GitHub Pages no se trasladan automáticamente al nuevo dominio.

## Documentación oficial

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Node en Render: https://render.com/docs/deploy-node-express-app
- Puertos y HOST: https://render.com/docs/web-services#port-binding
- Plan gratuito: https://render.com/docs/free
- Blueprint: https://render.com/docs/blueprint-spec

Este archivo prepara el despliegue. No se ha creado un servicio de Render ni se ha publicado una URL desde esta sesión.
