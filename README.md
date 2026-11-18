# RadarPlay

Compara precios de juegos en PC, Xbox, PlayStation, Nintendo Switch y Android. Guarda favoritos, fija metas de precio y consulta el historial observado.

## Desarrollo local

Necesitas Node.js 24.22.1 o una versión posterior de la rama 24. Desde la carpeta del proyecto:

```powershell
node server.cjs
```

Abre [RadarPlay local](http://localhost:3000). El CSS compilado ya está incluido. Para probar el inicio de sesión y la sincronización con Firebase en otro puerto, usa una cuenta de prueba:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\iniciar-local.ps1 -Port 3001
```

## Pruebas

```powershell
pnpm install
pnpm run check
pnpm test
```

Las pruebas de navegador usan Chromium de Playwright o el navegador que indique `BROWSER_CHANNEL` (por ejemplo, `msedge`). Ejecuta `pnpm run build:css` si cambias clases de Tailwind.

## Fuentes y persistencia

- Android consulta una selección de fichas de Google Play. Muestra el precio regional de descarga y las rebajas observadas por RadarPlay. Las compras dentro de las aplicaciones, suscripciones y promociones personales se consultan en Google Play.
- Los favoritos se guardan en el navegador y se sincronizan con Firestore cuando hay sesión. Los avisos automáticos por correo siguen pendientes.
- El historial de precios se guarda en `.data/` de forma predeterminada. En Render Free puede perderse entre reinicios o despliegues. Para conservarlo, configura `PRICE_HISTORY_PATH` en almacenamiento persistente.
- Las notas internas se guardan localmente en `docs-local/`. Git también ignora las capturas de pruebas, datos locales y credenciales de entorno.
