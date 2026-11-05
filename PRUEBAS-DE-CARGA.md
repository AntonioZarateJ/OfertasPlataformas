# Pruebas de concurrencia de RadarPlay

## Qué se puede medir

El script simula solicitudes HTTP concurrentes con etapas acotadas. No crea cuentas, no hace clic en anuncios, no registra tokens y no escribe favoritos. La carga alta se ejecuta contra un servidor local aislado en un puerto temporal con respuestas ficticias de CheapShark de 60 juegos y 250 ms de latencia. No realiza consultas a proveedores ni a Firebase, y no comparte la caché del servidor local del usuario.

El servidor de prueba conserva los controles reales: 12 solicitudes API activas por proceso, cuota por IP, caché, agrupación de solicitudes repetidas y separación temporal de consultas CheapShark. Todas las solicitudes vienen de una misma IP. Cada etapa usa un proceso nuevo para separar caché fría de caliente y reiniciar las cuotas de forma explícita; esto no prueba tráfico sostenido ni evasión de cuotas en producción.

Para repetir desde PowerShell, sin instalar dependencias adicionales:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Documentos\Proyecto Tienda Juegos\OfertasPlataformas\scripts\probar-carga.ps1"
```

Alternativamente, con Node.js 24 disponible: `node scripts/prueba-carga.cjs` o `pnpm run test:load` desde la raíz del repositorio. El script termina solo y guarda JSON en `test-results/carga-local-*.json`, fuera de Git. Los servidores de prueba se cierran al finalizar; no se detiene el servidor del usuario.

## Resultados iniciales

Prueba del 5 de noviembre de 2026, en la computadora de desarrollo. p95 es el tiempo bajo el que terminó el 95% de las respuestas correctas; los fallos se contabilizan aparte para que un rechazo rápido no parezca una mejora de rendimiento.

| Escenario local | Peticiones concurrentes | Resultado | p95 de respuestas correctas |
| --- | ---: | --- | ---: |
| Páginas y recursos | 100 | 300 respuestas correctas en tres rondas; sin errores | 152 ms |
| Misma consulta, caché fría | 10 | 10 correctas; una consulta al proveedor simulado | 297 ms |
| Misma consulta, caché fría | 20 | 12 correctas y 8 rechazos HTTP 503 | 312 ms |
| Mismo catálogo ya en caché | 50 | 50 correctas; solo la consulta previa de preparación | 78 ms |
| Búsquedas diferentes | 5 | 5 correctas | 2.904 ms |
| Búsquedas diferentes | 10 | 10 correctas | 6.200 ms |
| Búsquedas diferentes | 20 | 10 correctas, 8 rechazos HTTP 503 y 2 timeouts HTTP 504 | 6.223 ms |

El proceso no se cayó: los rechazos proceden de los límites de protección y los timeouts. No se deben interpretar como 12 usuarios máximos: cada visitante puede generar varias solicitudes, la caché cambia la espera y la cuota por IP también interviene. La cola del proveedor acumula espera en búsquedas distintas. Desactivar límites o aumentar consultas a ciegas trasladaría el problema a la tienda.

## Render: comprobación pequeña independiente

Ejecutada contra la portada propia: una solicitud inicial para separar el arranque y 18 solicitudes de prueba, máximo tres simultáneas, con pausas. Hubo 0 errores; p95 de 178 ms con una simultánea, 358 ms con dos y 243 ms con tres. No se probaron las APIs públicas bajo carga ni Firebase, y no se descargaron recursos de tiendas.

Para repetir esa comprobación puntual:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Documentos\Proyecto Tienda Juegos\OfertasPlataformas\scripts\probar-carga.ps1" -Render
```

Está limitada al dominio propio, sin URL arbitraria. Se interrumpe si hay errores o latencia elevada; no reintenta ni ignora Retry-After para generar más tráfico. No ejecutar en bucle ni usar como sistema para mantener despierto el plan gratuito.

## Lo que falta para estimar la capacidad pública

Estos resultados no certifican capacidad de Render ni número máximo de personas. Faltan latencias reales de proveedores, catálogos de consola, navegador completo, sesiones Firebase, tráfico sostenido desde distintas redes y métricas de CPU/memoria del servicio desplegado. El informe local recoge memoria y retraso del bucle de eventos del servidor hijo, pero la máquina de desarrollo no tiene los mismos recursos que Render.

Siguiente mejora recomendada: optimizar la espera de consultas repetidas y la recuperación de sobrecarga sin aumentar indiscriminadamente las llamadas al proveedor. Después repetir las mismas pruebas y medir un despliegue de prueba con cuotas y presupuesto definidos. Usar respuestas grabadas o proveedores simulados para carga grande; las cuotas externas siguen vigentes aunque se pague un servidor mejor.
