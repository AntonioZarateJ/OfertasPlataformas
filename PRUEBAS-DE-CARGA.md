# Pruebas de concurrencia de RadarPlay

## Qué se puede medir

El script simula solicitudes HTTP concurrentes con etapas acotadas. No crea cuentas, no hace clic en anuncios, no registra tokens y no escribe favoritos. La carga alta se ejecuta contra un servidor local aislado en un puerto temporal con respuestas ficticias de CheapShark de 60 juegos y 250 ms de latencia. No realiza consultas a proveedores ni a Firebase, y no comparte la caché del servidor local del usuario.

El servidor de prueba conserva los controles reales: actualmente 12 grupos de consultas diferentes activos por proceso, hasta 128 peticiones HTTP en espera, cuota por IP, caché, agrupación de solicitudes repetidas y separación temporal de consultas CheapShark. Todas las solicitudes vienen de una misma IP. Cada etapa usa un proceso nuevo para separar caché fría de caliente y reiniciar las cuotas de forma explícita; esto no prueba tráfico sostenido ni evasión de cuotas en producción.

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

Usar respuestas grabadas o proveedores simulados para carga grande; las cuotas externas siguen vigentes aunque se pague un servidor mejor.

## Optimización aplicada y segunda medición

El límite de 12 deja de contar cada seguidor de una consulta pública como un trabajo nuevo: solicitudes idénticas comparten trabajo y cupo, con un máximo global de 128 peticiones en espera y la misma cuota por IP por cada una. No se eliminaron los parámetros que distinguen región, edición, plataforma, tienda, página o filtro. En cada grupo, el resultado se carga y almacena una sola vez, y su registro pendiente se limpia también cuando falla.

El navegador comparte GET públicos idénticos mientras están pendientes, entrega copias independientes del resultado y mantiene separadas las consultas con cancelación y la configuración de cuentas. Se respetan las pausas Retry-After de HTTP 503 y 429 dentro del presupuesto de reintentos existente. CheapShark mantiene los 650 ms mínimos y el acceso serial; se devuelve una pausa antes de admitir trabajos cuya espera mínima prevista excedería 6 segundos. Una pausa de la tienda mayor de cinco minutos ya no se acorta.

Resultados locales con el mismo simulador:

| Escenario | Antes | Después |
| --- | --- | --- |
| Mismo catálogo frío, 20 simultáneas | 12 correctas y 8 rechazos | 20 correctas, 0 rechazos; p95 319 ms |
| Mismo catálogo frío, 40 simultáneas | La escalada se detenía tras fallar con 20 | 40 correctas, una sola consulta al proveedor simulado; p95 385 ms |
| Catálogo en caché, 50 simultáneas | 50 correctas | 50 correctas; p95 92 ms |
| Diez búsquedas diferentes | 10 correctas; p95 6,2 s | 10 correctas; p95 6,2 s |
| Veinte búsquedas diferentes | 10 correctas, 8 HTTP 503 y 2 HTTP 504 | 10 correctas y 10 HTTP 429 con pausa; sin timeouts 504 en esta muestra |

La capacidad de búsquedas únicas no aumentó: no se resolvieron artificialmente los límites de la tienda. Las respuestas 429 requieren reintento respetando el tiempo indicado y siguen siendo rechazos, no resultados correctos. Un proveedor realmente lento aún puede agotar los tiempos de espera. No se debe interpretar el cambio de 504 a 429 como capacidad ilimitada ni como que todas las peticiones terminan correctamente.

También se comprimen y reutilizan HTML, CSS y JS públicos, con una caché adicional acotada a 8 MiB. Medición de bytes transferidos:

| Recurso | Sin compresión | Con gzip | Reducción |
| --- | ---: | ---: | ---: |
| Página inicial | 53.752 | 13.039 | 76% |
| Tailwind CSS | 33.278 | 6.521 | 80% |
| Core JS | 13.900 | 3.944 | 72% |

Gzip agrega trabajo de CPU al primer acceso y al cliente al descomprimir; en loopback no hay una ventaja de red equivalente a internet. La segunda muestra de páginas/recursos con 100 simultáneas siguió sin errores, con p95 de 275 ms frente a los 152 ms iniciales. Parte de la ejecución coincidió con pruebas de navegador: estos tiempos no son una comparación aislada de CPU. El beneficio demostrado de gzip es la reducción de bytes; no se afirma que reduzca toda latencia local.

La suite completa terminó con 58 pruebas de Node aprobadas, incluido el ejecutable que valida 17 flujos de navegador. Se comprobaron filtros exactos/rangos, paginación, ediciones, regiones, precios, cancelación, seguridad, acceso y favoritos. Los resultados son locales; hace falta desplegar en Render para evaluar su comportamiento real después del cambio. No se cambiaron planes, variables de Firebase, reglas ni configuración de App Check.

## Comprobación real de APIs en Render después del despliegue

El 5 de noviembre de 2026 se ejecutó `node scripts/probar-render-api.cjs`. Esta prueba hace como máximo 40 peticiones a rutas fijas del sitio propio: una consulta inicial y etapas de 1, 3 y 5 solicitudes simultáneas al mismo catálogo de cada plataforma, con pausas. No usa cuentas, no consulta Firebase, no vacía cachés ni fuerza búsquedas masivas. La primera consulta sí puede contactar a las tiendas; se desconoce si ya había caché previa en Render. Se omite la carga de una plataforma si su muestra es parcial, vacía, inválida o lenta, y se detiene la escalada ante errores HTTP o latencia excesiva. Los campos numéricos de precios, moneda y región se inspeccionan antes de la carga; esto no verifica el importe final en el checkout.

| Plataforma | Consulta inicial | Elementos en esa página | p95 con 5 simultáneas, misma consulta |
| --- | ---: | ---: | ---: |
| PC / referencia CheapShark de Steam | 911 ms | 60 | 403 ms |
| Xbox, México | 1.520 ms | 25 | 369 ms |
| PlayStation, México | 1.631 ms | 24 | 381 ms |
| Nintendo, México | 1.430 ms | 60 | 260 ms |

Las 40 respuestas fueron HTTP 200; en las consultas iniciales no se detectaron precios inválidos, regiones mezcladas ni fuentes con estado unavailable. HSTS estuvo presente. Eneba devolvió estado ok con cero elementos en estas páginas con filtro de ofertas: no se puede deducir que carezca de productos ni garantizar cobertura completa del marketplace. Los precios PC inspeccionados son la referencia USD de CheapShark, no una comprobación del precio regional directo de Steam.

Las conclusiones se basan en estados HTTP y tiempos de respuesta. Se corrigió además el acumulador de bytes del medidor para evitar pérdida de sumas concurrentes; no se utiliza el volumen de transferencia de esta primera ejecución para extraer conclusiones.

Esto confirma el funcionamiento de estas consultas y su reutilización bajo una ráfaga pequeña. No demuestra capacidad máxima, carga sostenida de usuarios, comportamiento de búsquedas diferentes simultáneas ni memoria/CPU del servicio. Para esas conclusiones se necesitan métricas de Render y una prueba de mayor alcance, con presupuesto y cuotas de proveedores definidos. No se contrataron planes ni servicios adicionales.
