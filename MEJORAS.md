# Análisis técnico y plan de mejoras de Openinary

Fecha de revisión: 23 de septiembre de 2026.

## Alcance

Análisis estático de la estructura, dependencias, autenticación, rutas multimedia, Docker y workflows del repositorio. No se ejecutaron compilación ni pruebas: el entorno de revisión no tenía dependencias instaladas ni `pnpm` disponible. Los riesgos descritos requieren validación en el entorno de ejecución; no constituyen una demostración de explotación.

Este documento sirve como lista de trabajo. Marcar cada mejora como completada cuando se hayan aplicado los cambios y verificado sus criterios de aceptación.

## Arquitectura

Openinary comparte el motor multimedia entre el producto autohospedado y el servicio Cloud. El monorepo usa pnpm y Turborepo.

| Área | Responsabilidad y tecnologías |
| --- | --- |
| `apps/api` | API autohospedada con Hono, autenticación y límites de solicitudes. |
| `apps/web` | Panel con Next.js 15, React 19 y Tailwind 4. |
| `packages/core` | Transformaciones con Sharp y FFmpeg, almacenamiento local/S3, caché y cola de videos. |
| `packages/shared` | Autenticación compartida con Better Auth y SQLite. |
| `apps/cloud` | Servicio gestionado con Workers, Containers, R2, Neon y Drizzle. |
| `packages/ui`, `packages/cli`, `packages/registry` | Componentes compartidos, instalación y distribución de componentes. |
| `apps/marketing`, `apps/docs`, `apps/telemetry` | Sitio público, documentación y telemetría. |

### Fortalezas que conviene preservar

- Motor compartido para evitar implementaciones divergentes entre ambos productos.
- Inyección de almacenamiento y cola mediante `RouteDeps`, que facilita reutilización y pruebas.
- Caché y procesamiento de video mediante trabajos con concurrencia configurable.
- Se identificaron 32 archivos de pruebas, incluidos casos sobre firmas de subida, seguridad de entrega, almacenamiento y facturación de video. Este número no mide cobertura ni confirma que las pruebas pasen.
- Restricción de un único administrador autohospedado reforzada mediante un trigger de SQLite.

## Lista de mejoras

| Estado | ID | Prioridad | Mejora |
| --- | --- | --- | --- |
| Pendiente | M01 | Alta | Corregir la identificación del cliente para limitar solicitudes. |
| Pendiente | M02 | Alta | Limitar recursos y generar las descargas ZIP por streaming. |
| Pendiente | M03 | Media | Proteger los eventos de la cola. |
| Pendiente | M04 | Media | Incluir el Worker en la comprobación de tipos. |
| Pendiente | M05 | Media | Establecer verificaciones generales para las PR. |

### M01 — Identificación del cliente y límite de solicitudes

- [ ] Completada y verificada.

**Evidencia:** el limitador toma la primera IP de `X-Forwarded-For`. Si no obtiene IP, deja continuar sin aplicar el límite. Nginx utiliza `$proxy_add_x_forwarded_for`, que conserva el valor recibido y agrega la dirección del cliente conectado.

**Riesgo:** sin saneamiento en un proxy anterior, el cliente puede alterar el identificador del limitador. El impacto depende de la topología real de despliegue. Además, el contador actual reside en memoria de cada proceso.

**Archivos:** [limitador](apps/api/src/middleware/rate-limit.ts), [Nginx](docker/nginx.conf).

**Trabajo propuesto:**

- [ ] Documentar los escenarios de acceso directo y acceso mediante proxies.
- [ ] Definir qué proxies son confiables y cómo se obtiene la IP en cada escenario.
- [ ] Evitar confiar en cabeceras enviadas directamente por clientes no confiables.
- [ ] Definir una alternativa de limitación cuando no se pueda determinar la IP.
- [ ] Validar que los valores de configuración sean números positivos dentro de límites razonables.
- [ ] Documentar el alcance por proceso; evaluar almacenamiento compartido si se soportan varias réplicas.

**Criterios de aceptación:**

- Alterar `X-Forwarded-For` desde un cliente no confiable no permite reiniciar su cuota.
- Las solicitudes sin cabeceras de proxy siguen sujetas a una política de limitación.
- Clientes diferentes detrás de un proxy autorizado se identifican según la política definida.
- Hay pruebas de regresión para cabeceras manipuladas, IP ausente y cuota agotada.

### M02 — Descargas ZIP con consumo acotado

- [ ] Completada y verificada.

**Evidencia:** `/download-folder` es pública, acumula los archivos en memoria y genera el ZIP con `zipSync`. La implementación revisada no establece límites de cantidad de archivos ni tamaño total.

**Riesgo:** carpetas grandes o solicitudes concurrentes pueden agotar memoria y bloquear el procesamiento de otras solicitudes.

**Archivos:** [descarga de carpetas](packages/core/src/routes/download-folder.ts), [registro de rutas](apps/api/src/index.ts).

**Trabajo propuesto:**

- [ ] Definir límites de cantidad de archivos, bytes totales y descargas concurrentes.
- [ ] Generar y entregar ZIP por streaming, evitando cargar la carpeta completa en memoria.
- [ ] Interrumpir lecturas y liberar recursos cuando el cliente desconecte.
- [ ] Aplicar los límites tanto al almacenamiento local como al compatible con S3.
- [ ] Definir si la descarga masiva debe requerir autenticación o una firma temporal.

**Criterios de aceptación:**

- Las carpetas que superan los límites se rechazan o interrumpen de forma controlada.
- La memoria no crece proporcionalmente al tamaño total de la carpeta.
- Una descarga grande no bloquea las respuestas de otras rutas.
- La cancelación del cliente libera los recursos asociados.
- Hay pruebas para límites, concurrencia, cancelación y contenido correcto del ZIP.

### M03 — Protección de los eventos de cola

- [ ] Completada y verificada.

**Evidencia:** `/queue/events` se registra como ruta pública. Los eventos incluyen rutas de archivos, identificadores de trabajos y mensajes de error.

**Riesgo:** terceros pueden observar información operativa de los trabajos. El límite de solicitudes no sustituye el control de acceso ni limita por sí solo las conexiones persistentes activas.

**Archivos:** [registro de rutas](apps/api/src/index.ts), [eventos SSE](packages/core/src/routes/queue-events.ts).

**Trabajo propuesto:**

- [ ] Revisar cómo se suscribe el panel y definir autenticación compatible con su cliente SSE.
- [ ] Exigir autorización para recibir información operativa del panel.
- [ ] Reducir los datos publicados y evitar exponer mensajes internos de error.
- [ ] Establecer un límite de conexiones simultáneas y verificar la limpieza de listeners.

**Criterios de aceptación:**

- Un cliente sin autorización no recibe eventos operativos.
- El panel autorizado conserva actualizaciones y reconexión funcionales.
- Desconectar clientes elimina sus listeners y temporizadores.
- Hay pruebas de acceso autorizado, rechazo y limpieza de conexiones.

### M04 — Comprobación de tipos del Worker

- [ ] Completada y verificada.

**Evidencia:** `cloud-server` ejecuta `tsc --noEmit` con una configuración que incluye `api/**/*.ts`. El Worker tiene una configuración separada que ese comando no ejecuta expresamente.

**Riesgo:** el comando habitual puede terminar correctamente sin detectar errores de tipos en código exclusivo del Worker.

**Archivos:** [scripts](apps/cloud/server/package.json), [configuración de API](apps/cloud/server/tsconfig.json), [configuración de Worker](apps/cloud/server/worker/tsconfig.json).

**Trabajo propuesto:**

- [ ] Ejecutar explícitamente la comprobación de tipos con ambas configuraciones.
- [ ] Integrar ambas comprobaciones en el comando habitual de `cloud-server` y en CI.
- [ ] Resolver los errores reales encontrados sin ocultarlos mediante exclusiones generales.

**Criterios de aceptación:**

- `pnpm --filter cloud-server type-check` comprueba API y Worker.
- Un error de tipos introducido temporalmente en un archivo exclusivo del Worker hace fallar la comprobación; retirar ese error tras verificarlo.
- La ejecución normal pasa con las dependencias y tipos necesarios instalados.

### M05 — Verificaciones generales de integración continua

- [ ] Completada y verificada.

**Evidencia:** los workflows revisados construyen y publican artefactos, pero no se encontró una validación general de pruebas, tipos y lint para todas las PR. El workflow de registry ejecuta pruebas de `core`, aunque sus filtros de rutas no cubren cualquier cambio de ese paquete.

**Riesgo:** cambios fuera de esos filtros pueden llegar a integración sin ejecutar verificaciones relevantes.

**Archivos:** [workflows](.github/workflows), [workflow de registry](.github/workflows/registry.yml), [tareas de Turborepo](turbo.json), [scripts raíz](package.json).

**Trabajo propuesto:**

- [ ] Agregar un workflow de validación de PR con instalación reproducible mediante el lockfile.
- [ ] Ejecutar pruebas, comprobaciones de tipos y lint de los paquetes correspondientes.
- [ ] Incluir la comprobación del Worker definida en M04.
- [ ] Revisar scripts existentes y dependencias de compilación antes de incorporarlos como controles obligatorios.
- [ ] Asegurar que las verificaciones no requieran credenciales de producción ni desplieguen servicios.
- [ ] Revisar filtros de rutas para que los cambios en paquetes compartidos validen a sus consumidores.
- [ ] Configurar los controles como obligatorios en las reglas de integración del repositorio, cuando se tenga acceso a esa configuración.

**Criterios de aceptación:**

- Una PR que modifica `core`, API, web o Worker activa las verificaciones correspondientes.
- Un fallo de prueba, tipos o lint produce un resultado fallido de CI.
- Las verificaciones funcionan sin secretos de producción.
- Los controles obligatorios impiden integrar una PR con resultados fallidos.

## Orden de ejecución recomendado

1. Preparar el entorno y ejecutar las verificaciones existentes para registrar el estado inicial.
2. Resolver M01 y M02 por su impacto en disponibilidad y consumo de recursos.
3. Resolver M03 para restringir la exposición de información operativa.
4. Resolver M04 y M05 para prevenir regresiones de forma continua.

## Registro de avances

Completar una fila por mejora implementada. Registrar los comandos ejecutados y sus resultados, no solo que la tarea fue revisada.

| Fecha | ID | Cambios / PR | Validación realizada | Pendientes |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |
