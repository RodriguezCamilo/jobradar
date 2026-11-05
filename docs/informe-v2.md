# Job Radar — Informe V2

Validación del **4 de noviembre de 2026**, uso personal local en Buenos Aires (UTC−3). Se continuó sobre el proyecto existente. No hubo despliegue, recreación de tablas V1, nuevas dependencias de producción ni envío automático del historial a IA.

## Cambios implementados

El tema oscuro es predeterminado y todos los colores de `globals.css` están centralizados en tokens. El selector claro/oscuro conserva la preferencia en almacenamiento local y la aplica antes de pintar la página. Se verificaron ambos temas después de recargar, filtros, botones y tarjetas en la vista angosta de la aplicación.

Se separaron idioma del anuncio, idioma de trabajo, idioma para postular, evidencia y confianza. El filtro laboral ofrece Priorizar español, Solo español confirmado y Todos los idiomas. A pedido posterior se agregaron casillas independientes para **Español**, **Inglés**, **Otros/sin determinar**, y **Incluir inglés laboral obligatorio**. No traducen anuncios ni confirman el idioma del equipo. Durante la prueba, con solo anuncios en español y excluyendo inglés laboral obligatorio se mostraron **74 oportunidades Web**; habilitar anuncios en inglés elevó ese listado a **132**. Estas cifras dependen de los demás filtros y pueden cambiar al sincronizar.

Las ofertas muestran por qué se recomiendan y si esa evaluación procede de reglas o Groq. El orden conserva primero geografía, luego preferencia laboral de idioma, afinidad profesional, vigencia/publicación y feedback en empates. Entre ofertas laborales ambiguas igualmente afines, el idioma español del anuncio actúa como desempate, sin cambiar su clasificación laboral a español confirmado. Se mantiene la ordenación por publicación reciente.

GroqCloud está integrado mediante su endpoint compatible con OpenAI, sin xAI/Grok ni servicios intermediarios. Hay análisis manual por oferta, selección y lotes de hasta tres, con progreso, errores y tokens visibles. La caché es persistente por contenido/perfil, prompt y modelo. Se validan JSON, esquema, rechazo, truncamiento y evidencia; no se ejecutan instrucciones del anuncio ni herramientas. El análisis solo escribe su propia tabla y no cambia ofertas, URLs, seguimiento, fechas o feedback. Se contrastan supuestas tecnologías faltantes con el perfil para descartar brechas que el modelo invente sobre habilidades ya declaradas.

La evaluación personal Me interesa / No encaja / Sin evaluar y sus motivos se guardan independientemente. Se puede descargar un resumen de hasta 500 evaluaciones con título, empresa, URL y códigos de feedback, sin descripciones completas, claves, CV o perfil. La acción también está disponible en pantallas angostas.

## Get on Board y cobertura real

| Resultado | Cantidad |
| --- | ---: |
| Ofertas únicas recuperadas de Get on Board | 229 |
| Candidatas seleccionadas e insertadas | 117 |
| Nuevas ofertas Game Dev de esta fuente en la muestra | 0 |
| Repetición desde caché: nuevas inserciones | 0 |

No se presenta esa muestra como inventario completo. Se consultaron los términos configurados para ambos perfiles, hasta dos páginas de 30 resultados. Algunas búsquedas tenían más páginas; el truncamiento quedó registrado. La palabra Unity también puede aparecer en contenido no relacionado y no basta por sí sola para clasificar una vacante como Game Dev.

Se verificó el OpenAPI servido por Get on Board y se hicieron consultas reales a `/api/v0/search/jobs` con `query`, `page`, `per_page` y relaciones expandidas. No se filtró solo Argentina: se conservan ubicaciones LATAM/globales y ambiguas para evaluar geografía sin suponer alcance mundial. `Remote` sin países sigue en Revisar. Se conservó `links.public_url` para abrir y postular, con atribución visible.

La documentación oficial permite consultar datos públicos y crear interfaces de búsqueda/listado. La referencia consultada no especificó cuota numérica de consultas ni licencia adicional específica de redistribución; se limita a uso local con caché diaria, pedidos espaciados, manejo de 429 y sin exportaciones masivas de anuncios. Los importes de salario se conservaron sin inventar moneda/período ausentes del contrato. El `lang` de la oferta informa idioma para postular y no confirma por sí mismo la comunicación cotidiana.

Después de incorporar la nueva fuente hay **330 candidatas actuales**, dentro de **349 ofertas históricas almacenadas**. Las 19 que no coinciden actualmente con un perfil no se borraron.

| Perfil | Cantidad |
| --- | ---: |
| Solo Web | 283 |
| Solo Game Dev | 42 |
| Ambos | 5 |
| Pestaña Web, incluidas compartidas | 288 |
| Pestaña Game Dev, incluidas compartidas | 47 |

| Idioma laboral preliminar | Cantidad |
| --- | ---: |
| Español confirmado | 1 |
| Español probable | 29 |
| Desconocido/contradictorio | 194 |
| Inglés requerido | 106 |

El idioma estimado del anuncio es distinto: **103 en español**, **225 en inglés** y **2 mixtos**. Hay **84 aceptables**, **134 para revisar** y **112 para descartar** geográficamente. Las cifras por idioma incluyen todas las candidatas, también las descartadas geográficamente; no significan que todas sean recomendables. Solo dos ofertas recibieron análisis real de Groq; el resto utiliza reglas.

## Archivos y migración

- `src/lib/connectors/getonbrd.ts`: contrato real, validación, paginación y normalización.
- `src/lib/language.ts`, `recommendation.ts`, `filters.ts`: evidencia, combinación de fuentes, ranking y controles independientes.
- `src/lib/groq.ts`, `analysis-key.ts`, `analysis-service.ts`, `assessment-guard.ts`: proveedor, esquema, clave de caché, reclamo persistente y contraste con perfil.
- `src/components/theme-toggle.tsx`, `job-review.tsx`, `radar-app.tsx`, `src/lib/theme.ts` y `src/app/globals.css`: interfaz, tema, análisis y feedback.
- `src/app/api/analyze/route.ts`, `api/jobs/[id]/feedback/route.ts` y `api/feedback/export/route.ts`: endpoints locales protegidos y validados.
- `config/candidate.json`, `searches.json` y `boards.json`: perfil razonablemente separado, consultas/límites y futuras empresas ATS.
- `supabase/migrations/202611040003_v2_analysis_feedback.sql`: agrega `job_feedback`, `job_analyses`, `analysis_control` y amplía restricciones para Get on Board. No modifica ni recrea las tablas de ofertas existentes. RLS y permisos privados en todas las tablas nuevas.
- `supabase/rollbacks/202611040003_v2_analysis_feedback.sql`: reversión manual probada en base aislada. Impide volver silenciosamente a V1 si existen filas Get on Board. Requiere conservar/exportar datos V2 antes de quitar sus tablas.
- `scripts/verify-v2.ts`, `verify-v2-local.ts`, `v2-backfill.ts` y `v2-sync.ts`: comprobaciones y operaciones manuales documentadas en README.

Se aplicó la migración al Supabase existente. Las credenciales permanecieron exclusivamente en `.env.local`, excluido de Git. Se verificó disponibilidad real de `openai/gpt-oss-20b` en GroqCloud y se configuraron `GROQ_API_KEY`/`GROQ_MODEL`; no se imprimen sus valores ni se serializan al cliente.

## Validación

**109 tests aprobados**, además de lint, TypeScript y build. Incluyen:

- Idioma laboral español en anuncio inglés; inglés obligatorio en anuncio español; LATAM sin evidencia; inglés deseable o solo para documentación; datos insuficientes y contradicciones.
- Activar/desactivar idiomas del anuncio e inglés laboral sin modificar la clasificación geográfica.
- Respuestas válidas/ inválidas, JSON truncado, rechazos, ausencia de clave, timeout, 429, citas inventadas y tecnologías ya declaradas en el perfil.
- Paginación y normalización de Get on Board, incluyendo empresa expandida, ubicación Remote ambigua y campos inseguros/ausentes.
- Migración incremental con datos V1, reversión segura, deduplicación y conservación de tracking/visto/feedback tras reingreso.

En Supabase real se compararon las **232 ofertas previas** con una referencia local tomada antes de los cambios: todas conservaron identidad, primer descubrimiento, URLs, asociaciones de fuente, seguimiento y visto. Se comprobó feedback por HTTP, lectura después de guardar, exportación reducida, rechazo de valores inválidos y rechazo de orígenes externos. Las pruebas restauran la evaluación previa.

En navegador se verificó guardado de tema claro y oscuro después de recargar, controles de idioma en ambos sentidos, tarjetas españolas, feedback con motivo después de recargar y restauración del feedback de prueba. La caché de análisis se probó desde la UI: un análisis disponible, cero errores y **0 tokens adicionales**. No se observaron errores de consola en esa verificación final.

Evidencia local, excluida de Git: `artifacts/v2-validation.json`, `v2-local-validation.json`, `v2-browser-validation.json`, `job-radar-v2-controls.jpg` y `job-radar-v2-spanish.jpg`.

## Pruebas reales de Groq y tokens

Se trabajó con **dos ofertas candidatas**, sin analizar las cientos de históricas. Una exige español fluido e inglés técnico para documentación; otra exige inglés para reuniones. Los dos resultados finales quedaron persistidos y sus repeticiones se resolvieron desde caché. Se identificaron requisitos de infraestructura/Java no centrales al perfil y se recomendaron como baja afinidad, sin tocar estados personales.

Hubo siete intentos de generación durante implementación/diagnóstico sobre esas dos ofertas. Se observaron dos HTTP 400, una respuesta con cita no literal y otra que clasificaba idioma sin citar evidencia. El sistema rechazó las clasificaciones no verificadas. Se restringieron las citas posibles a fragmentos del anuncio y se agregó abstención semántica: si falta evidencia, el idioma de IA queda desconocido, con baja confianza, conservando las reglas independientes.

Los dos análisis persistidos reportaron **4.424 tokens de entrada + 1.435 de salida = 5.859**. Contando también una respuesta de diagnóstico con uso registrado y una respuesta descartada, se conservaron contadores por **11.686 tokens**. Una respuesta de diagnóstico anterior no dejó contador registrado; el uso total de pruebas se estima en **14–16 mil tokens**, más cualquier consumo no informado por los HTTP 400. Esa estimación no se presenta como medición exacta. Las lecturas de caché no generaron tokens nuevos.

## Límites y pendientes

Groq puede omitir evidencia, interpretar mal seniority o proponer brechas de conocimientos incorrectas. La validación de formato no garantiza calidad semántica; por eso se conserva evidencia, incertidumbre y el contraste con el perfil. Las descripciones extensas se acotan y pueden omitir información relevante del final. El modelo y el prompt están versionados para invalidar análisis cuando cambien sus entradas.

La detección del idioma del anuncio es una heurística, con categoría mixta/desconocida. Publicar en español o requerir postular en español no demuestra que las reuniones sean en español. La mayoría de ofertas sigue sin confirmación explícita del idioma laboral; no se inflaron las confirmadas para mejorar cifras.

La cobertura sigue acotada por los términos y páginas configurados; no se agregó búsqueda indiscriminada de empresas ATS ni scraping. Greenhouse, Lever y Ashby quedan preparados en configuración, sin conectores activos. Tampoco se incorporaron entrenamiento, colas externas, autenticación remota o despliegue.

Referencias oficiales consultadas: [Get on Board: API pública](https://www.getonbrd.com/help/what-can-i-do-with-get-on-board-s-api), [OpenAPI](https://www.getonbrd.com/doc/openapi.yaml), [Groq: modelos](https://console.groq.com/docs/models), [salidas estructuradas](https://console.groq.com/docs/structured-outputs) y [límites](https://console.groq.com/docs/rate-limits).
