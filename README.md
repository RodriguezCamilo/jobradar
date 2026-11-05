# Job Radar

Herramienta personal para encontrar y organizar trabajo remoto desde Argentina, con perfiles Web y Game Dev. **V2 local**, sin despliegue. Análisis opcional con GroqCloud; las reglas funcionan sin IA.


## V2: uso diario

- Tema oscuro predeterminado. El botón de sol/luna cambia a claro/oscuro y guarda la preferencia local antes del primer pintado, sin librería de temas.
- **Idioma del anuncio**: casillas independientes para Español, Inglés y Otros/sin determinar. Se pueden activar o desactivar. No traducen anuncios ni afirman el idioma del equipo.
- **Idioma laboral**: Priorizar español (predeterminado, conserva ambiguas), Solo español confirmado o Todos. La casilla **Incluir inglés laboral obligatorio** permite excluirlo de forma independiente.
- Cada oferta muestra explicación, citas y confianza. `lang=es` en Get on Board solo es un indicio de idioma de trabajo: informa el idioma para postular. Un anuncio en inglés no implica trabajo cotidiano en inglés.
- Seleccionar hasta tres ofertas y usar **Analizar seleccionadas**, **Analizar hasta 3 candidatas**, o analizar una oferta. Las llamadas se realizan secuencialmente, solo por acción manual; nunca se analiza automáticamente el historial. Se muestran progreso, tokens, errores y estado sin analizar.
- **Mi evaluación** agrega Me interesa / No encaja / Sin evaluar, con motivo opcional. Se guarda aparte del seguimiento. **Exportar evaluaciones** descarga un JSON reducido, hasta 500 entradas, sin descripciones, CV, claves ni perfil personal. Está disponible también en la vista angosta.

En el proyecto existente: `npm run db:migrate` aplica únicamente migraciones pendientes. `npm run backfill:v2` agrega evidencia determinística de idioma a los registros ya almacenados; no cambia URLs, fechas, seguimiento ni vigencia. Estos pasos ya se ejecutaron durante la implementación.

## Get on Board

Referencia oficial: [API](https://api-doc.getonbrd.com/?version=latest), [OpenAPI desplegado](https://www.getonbrd.com/doc/openapi.yaml) y [usos autorizados de la API pública](https://www.getonbrd.com/help/what-can-i-do-with-get-on-board-s-api). El conector consulta `/api/v0/search/jobs`, con `query`, `page` desde 1, `per_page=30`, `expand[]=company`, `expand[]=modality` y `lang=en` para etiquetas de referencia. El campo `lang` del anuncio se conserva por separado de ese locale de respuesta.

Se recorren hasta dos páginas por término/ámbito, usando `meta.total_pages`; se detectan páginas repetidas y se deduplican IDs. No se restringe el país en la consulta: se evalúan Argentina, LATAM y mundial con las reglas existentes. `Remote` sin países confirmados sigue en Revisar. Se muestra Get on Board como fuente y se conserva `links.public_url` para abrir y postular.

La referencia consultada no publica una cuota numérica de consultas ni condiciones específicas adicionales de atribución para este endpoint público. Se usa caché diaria, pedidos espaciados, atribución visible y ninguna redistribución masiva. No se interpreta ese silencio como cuota ilimitada. Los salarios numéricos se conservan; moneda/período no se inventan si no están explícitos en el contrato recibido.

`npm run sync:getonbrd` ejecuta una sincronización manual solo de esta fuente. `config/searches.json` configura consultas y límites. `config/boards.json` reserva listas vacías para empresas Greenhouse/Lever/Ashby; todavía no se conectan ni se presupone búsqueda global.

## GroqCloud

Agregar `GROQ_API_KEY` y `GROQ_MODEL` en `.env.local` y reiniciar Next si no estuvieran configurados. La integración es HTTP compatible con OpenAI **en `api.groq.com`**, sin xAI/Grok, gateway ni SDK adicionales. La clave proporcionada en esta implementación quedó solo en el archivo local excluido de Git.

Documentación verificada: [modelos](https://console.groq.com/docs/models), [salidas estructuradas](https://console.groq.com/docs/structured-outputs), [límites](https://console.groq.com/docs/rate-limits). Se confirmó disponibilidad del modelo con `/openai/v1/models`. `openai/gpt-oss-20b` admite JSON Schema con `strict:true`. Con modelos no incluidos en la lista documentada de modo estricto se usa JSON Object y la misma validación Zod; su compatibilidad debe verificarse al cambiar el modelo.

El servidor envía solo título, empresa, ubicación publicada, descripción acotada, requisitos y el perfil de `config/candidate.json`. La descripción está limitada a 12.000 caracteres y los bloques de requisitos a 3.000/1.500; un texto extenso puede quedar incompleto. No envía CV, seguimiento, feedback, claves ni enlaces de postulación al modelo. Los anuncios se tratan como datos no confiables, sin herramientas, ejecución ni acciones.

Las citas de idioma se restringen a fragmentos literales de la entrada y se verifican al volver. Un idioma sin evidencia válida pasa a unknown, con baja confianza e incertidumbre; nunca reemplaza evidencia determinística explícita con una afirmación sin prueba. Los requisitos técnicos se validan con Zod y se contrastan las supuestas brechas con el stack declarado para no inventar faltantes conocidos. No se usan porcentajes.

`job_analyses` guarda la caché por vacante, hash de contenido/perfil, versión de prompt y modelo; conserva también estado, errores y tokens reportados. Cambios de tracking o feedback no invalidan la caché. El análisis no modifica la vacante ni sus fuentes. `job_feedback` guarda la evaluación personal. `analysis_control` conserva el tiempo de espera global ante 429; no hay reintentos automáticos. Timeout de 40 segundos y salidas truncadas/JSON inválido se rechazan. El reclamo de análisis tiene una concesión de tres minutos para recuperar un proceso interrumpido.

La migración incremental `202611040003_v2_analysis_feedback.sql` agrega únicamente tablas, permisos/RLS y amplía las restricciones de fuente. La reversión manual está en `supabase/rollbacks/`: no ejecutarla automáticamente; protege las filas Get on Board y exige decidir cómo conservar los datos de V2 antes de volver a V1.

## Verificar V2

`npm test` cubre también idioma del anuncio/trabajo, toggles, ranking, Groq válido/inválido, citas, timeouts/429, paginación Get on Board y migración/reversión con datos V1 preexistentes. No hace llamadas reales a Groq.

`npm run verify:v2` escribe `artifacts/v2-validation.json`, compara con el snapshot local previo si existe y comprueba la caché de Get on Board. Sin snapshot previo, las comprobaciones de conservación quedan `null`, no se dan por realizadas. `npm run verify:v2-local`, con Next activo, prueba y restaura feedback, exportación, entrada inválida, origen externo y caché de hasta dos ofertas ya analizadas; no genera nuevos análisis. Si no hay análisis previos, esa comprobación queda `null`.

Consultar [informe V2](docs/informe-v2.md) para resultados reales, limitaciones y tokens de las pruebas.

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
| `GROQ_API_KEY` | Opcional, solo servidor. Habilita análisis manual mediante GroqCloud. |
| `GROQ_MODEL` | Modelo de GroqCloud; recomendado `openai/gpt-oss-20b`, con JSON Schema estricto. |

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

Se respeta una ventana local persistida de **24 horas para Himalayas y Get on Board**, y **6 horas para Remotive**. Sincronizar dentro de esa ventana reutiliza la caché, sin solicitudes externas ni actualizaciones de vigencia basadas en datos viejos. La ventana se guarda antes de consultar; un reinicio no la saltea. Ante un 429 se conserva `Retry-After` y nunca se reintenta en bucle. Cada solicitud tiene timeout de 20 segundos; los errores y las respuestas inválidas se registran sin exponer cuerpos o cabeceras privadas.

Todas las ofertas muestran la fuente. Las acciones de Himalayas usan exactamente `applicationLink`, incluido su tracking. Remotive conserva su `url` y la atribución visible. No se redistribuyen los datos a terceros ni se genera marcado JobPosting. No publicar la caché o exportar el contenido de las fuentes como un feed de terceros.

## Clasificación y vigencia

La elegibilidad geográfica y la compatibilidad técnica se evalúan por separado. “Remote” solo no implica worldwide. Himalayas documenta que `locationRestrictions: []` significa mundial; un campo ausente queda en revisar. Los países admitidos, las exclusiones explícitas, las exigencias de residencia/autorización, la modalidad y las condiciones horarias se conservan como evidencia.

La evaluación técnica reconoce títulos y tecnologías, sin porcentajes. Seniority elevado, requisitos extensos, Unreal C++/AAA, otros motores o falta de stack principal requieren revisión. “Unity Catalog” y listados genéricos de otras búsquedas no prueban experiencia Unity requerida. El orden recomendado considera geografía, preferencia laboral de español, afinidad profesional, vigencia/publicación y feedback en empates. Entre ofertas laborales ambiguas igualmente afines, un anuncio en español puede preceder a uno en inglés sin confirmar el idioma del equipo. También se puede ordenar exclusivamente por descubrimiento o publicación.

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

Ver [informe de la primera validación](docs/informe-mvp.md). Groq y Get on Board forman parte de V2. Greenhouse, Lever, Ashby y despliegue quedan pendientes. Los conectores ATS requerirán empresas/job boards concretos.
