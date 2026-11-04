# Job Radar

MVP personal para encontrar y organizar trabajo remoto desde Argentina, con perfiles Web y Game Dev. Aplicación **local**, sin despliegue ni servicios de IA.

## Ejecutar

Requiere Node.js 22 o posterior y una base Supabase PostgreSQL.

```powershell
npm ci
Copy-Item .env.example .env.local
# Completar DATABASE_URL en .env.local
npm run db:migrate
npm run dev
```

Abrir <http://127.0.0.1:3000>. Si `.env.local` ya está configurado, **no sobrescribirlo**. Las migraciones ya fueron aplicadas al proyecto proporcionado durante la implementación.

El botón **Sincronizar ofertas** ejecuta la búsqueda manual. La primera búsqueda puede tardar unos minutos. Recargar la página no consulta fuentes externas. `npm run verify:apis` también sincroniza manualmente, reutilizando la caché vigente. No hay tareas programadas.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
# Opcional, con el servidor local en marcha:
npm run verify:local
```

`npm run start` sirve una compilación local en 127.0.0.1. Detener el servidor de desarrollo antes de usar ese mismo puerto.

## Variables

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Obligatoria para persistencia. Supabase → Connect → Session pooler, puerto 5432. Solo servidor. |
| `SUPABASE_URL` | Referencia opcional al proyecto; el transporte de datos usa PostgreSQL directamente. |
| `HIMALAYAS_API_KEY` | Opcional. Clave gratuita para aumentar límites; nunca se envía al navegador. |
| `GROQ_API_KEY`, `GROQ_MODEL` | Reservadas para otra etapa. No se utilizan ni requieren ahora. |

Las claves publicables de Supabase no otorgan acceso administrativo. Este MVP no necesita usarlas ni requiere una secret key: utiliza una conexión PostgreSQL privada desde Node. La conexión directa puede requerir IPv6; el Session pooler permite IPv4. La contraseña debe codificarse como componente de URL si contiene caracteres especiales. No imprimir ni compartir `DATABASE_URL`.

`.env.local`, `.cache/`, `artifacts/`, `CVs/` y las dependencias están excluidos de Git. Ninguna credencial real forma parte del código o de los ejemplos. Al cambiar una variable del servidor, reiniciar Next.js.

## Arquitectura

Next.js 16.4.5, React 19.3.1, TypeScript y Tailwind CSS 4. App Router, componentes React, Route Handlers de Node, Zod para entradas externas y Postgres.js para Supabase. Sin Express, ORM, colas ni microservicios.

```text
src/app/                     Página y endpoints HTTP
src/components/radar-app.tsx Interfaz, filtros y seguimiento
src/lib/connectors/          Himalayas, Remotive y contrato JobConnector
src/lib/classification.ts    Evaluación determinística técnica y geográfica
src/lib/repository.ts        Acceso a PostgreSQL e ingreso transaccional
src/lib/sync.ts              Coordinación manual, caché y vigencia
src/lib/security.ts          Restricción local y validación de origen
config/searches.json         Términos por perfil, ventanas y límites
supabase/migrations/         Esquema, funciones, índices, RLS y permisos
scripts/                    Migración, reclasificación y verificación
tests/                      Contratos, clasificación, SQL y seguridad
```

`jobs` conserva la vacante canónica; `job_sources`, cada aparición e información normalizada de la fuente; `job_links`, las URLs de identidad; `job_tracking`, el seguimiento personal y la fecha de visto; `sync_runs`, los resultados de cada consulta externa. Las migraciones se registran en `job_radar_migrations`.

La deduplicación usa `(source, external_id)` y coincidencias de URLs específicas normalizadas. Se eliminan parámetros de tracking **solo de la identidad**. Los enlaces originales se guardan intactos. Título y empresa iguales por sí solos no bastan para fusionar: entre fuentes con URLs diferentes puede quedar un duplicado, deliberadamente, antes que fusionar vacantes distintas. La función SQL serializa el ingreso con un bloqueo transaccional y las restricciones únicas evitan reinsertar la misma identidad.

El seguimiento no cambia al sincronizar. Abrir detalles o un enlace marca la oferta como vista; guardar y haber visto son conceptos independientes. Hay seis estados: nueva, guardada, postulada, en proceso, rechazada y descartada.

## Fuentes y límites

Documentación contrastada el **4 de noviembre de 2026**:

- [Himalayas Remote Jobs API](https://himalayas.app/docs/remote-jobs-api) y su [OpenAPI](https://himalayas.app/docs/openapi.json): búsqueda `/jobs/api/search`, parámetros `q`, `country=AR`, `sort=recent`, `page` desde 1. Se combina una búsqueda AR, que incluye worldwide, con otra global para conservar LATAM y ubicaciones ambiguas. Se pagina hasta una página vacía o el límite configurado; una página corta no determina el final. Por defecto, como máximo dos páginas por término/ámbito. El truncamiento queda registrado. El feed completo usa cursores; este MVP usa el endpoint de búsqueda.
- [Remotive](https://remotive.com/remote-jobs/api) y [documentación oficial](https://github.com/remotive-com/remote-jobs-api): una sola consulta a `/api/remote-jobs`, sin límite ni categoría para cubrir ambos perfiles. No se presupone paginación ni acceso a su inventario pago. El feed público demora 24 horas y durante la prueba devolvió 11 ofertas.

Se respeta una ventana local persistida de **24 horas para Himalayas** y **6 horas para Remotive**. Sincronizar dentro de esa ventana reutiliza la caché, sin solicitudes externas ni actualizaciones de vigencia basadas en datos viejos. La ventana se guarda antes de consultar; un reinicio no la saltea. Ante un 429 se conserva `Retry-After` y nunca se reintenta en bucle. Cada solicitud tiene timeout de 20 segundos; los errores y las respuestas inválidas se registran sin exponer cuerpos o cabeceras privadas.

Todas las ofertas muestran la fuente. Las acciones de Himalayas usan exactamente `applicationLink`, incluido su tracking. Remotive conserva su `url` y la atribución visible. No se redistribuyen los datos a terceros ni se genera marcado JobPosting. No publicar la caché o exportar el contenido de las fuentes como un feed de terceros.

## Clasificación y vigencia

La elegibilidad geográfica y la compatibilidad técnica se evalúan por separado. “Remote” solo no implica worldwide. Himalayas documenta que `locationRestrictions: []` significa mundial; un campo ausente queda en revisar. Los países admitidos, las exclusiones explícitas, las exigencias de residencia/autorización, la modalidad y las condiciones horarias se conservan como evidencia.

La evaluación técnica reconoce títulos y tecnologías, sin porcentajes. Seniority elevado, requisitos extensos, Unreal C++/AAA, otros motores o falta de stack principal requieren revisión. “Unity Catalog” y listados genéricos de otras búsquedas no prueban experiencia Unity requerida. Por defecto se priorizan las ofertas con afinidad técnica directa y luego el descubrimiento; también se puede ordenar exclusivamente por descubrimiento o por fecha de publicación.

Ausencia de salario no excluye. Remotive conserva el salario como texto sin inventar moneda/período. Himalayas conserva mínimos, máximos y período real, incluida tarifa por hora. `pubDate` de Himalayas indica actualización; la UI lo aclara. Remotive no informa zona horaria: se conserva el día y se usa mediodía UTC como convención interna de orden, sin mostrar una hora de publicación inventada.

Una oferta ausente de una consulta no se elimina ni se declara cerrada. Se marca sin verificar. Himalayas permite consultar `/jobs/api/companies/:company/jobs/:slug`: 200 confirma actividad, 410 confirma cierre y 404 queda sin verificar. En sincronizaciones posteriores se comprueban hasta 15 registros históricos por vez, comenzando por los menos recientemente comprobados. Se respeta `expiryDate`; las cerradas/vencidas quedan en el historial. Remotive no ofrece una comprobación individual documentada: las ausentes se mantienen sin verificar. No se solicitan páginas protegidas ni se hace scraping.

## Modo sin base de datos y seguridad

Sin `DATABASE_URL`, se pueden consultar y mostrar los datos reales de la caché en una **vista previa explícita**; guardar, postular y marcar visto están deshabilitados. No se simula persistencia. Si Supabase falla, se muestra un aviso y la caché de lectura, conservando los datos externos para importarlos cuando se recupere.

Las tablas tienen RLS habilitado y acceso revocado a `anon` y `authenticated`. Las funciones de ingreso no pueden ejecutarse con claves públicas. El backend usa consultas parametrizadas y TLS. La descripción se convierte a texto y React la escapa; no se renderiza HTML externo. Las acciones validan UUID, esquema, estado y origen.

Los scripts de servidor enlazan únicamente 127.0.0.1 y el proxy rechaza hosts externos. Las mutaciones requieren el mismo origen; no hay CORS abierto. Este control está destinado al uso personal local: antes de cualquier despliegue se necesita autenticación real y autorización de lectura/escritura. No se realizó ningún despliegue.

## Verificación y mantenimiento

`npm test` usa datos ficticios **solo en tests** y ejecuta la migración real en PostgreSQL aislado con PGlite. Cubre ubicación clara/ambigua, perfiles, salario, normalización, paginación, HTTP 429, seguridad, URLs, deduplicación entre fuentes, reclasificación y conservación de seguimiento/visto/descubrimiento.

`npm run verify:apis` usa las APIs reales o su caché vigente, escribe `artifacts/validation.json`, repite el ingreso para comprobar cero duplicados y prueba una escritura/lectura de seguimiento en Supabase dentro de una transacción que revierte. `npm run verify:local`, con Next activo en el puerto 3000, prueba los seis estados a través de HTTP, vuelve a leerlos, comprueba la caché y las restricciones de origen, y restaura el seguimiento inicial. Si está configurada la clave publicable local, verifica además que no pueda leer las tablas. Sus resultados quedan en `artifacts/local-validation.json`.

`npm run reclassify` aplica cambios en las reglas a la caché ya descargada y a los registros conocidos, sin consultar APIs. No usar para confirmar vigencia externa. Los registros históricos no se borran por dejar de coincidir con un perfil.

Un bloqueo interproceso evita sincronizaciones paralelas. Si un proceso muere abruptamente, comprobar que ya no hay sincronización en marcha y borrar **solo** `.cache/sync.lock`; no borrar los snapshots para eludir los límites de consulta.

Ver [informe de la primera validación](docs/informe-mvp.md). Greenhouse, Lever, Ashby, Groq y despliegue quedan para una etapa posterior. Los conectores ATS requerirán empresas/job boards concretos.
