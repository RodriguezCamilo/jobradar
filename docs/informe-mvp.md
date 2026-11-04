# Informe de Job Radar — MVP

Validación: **4 de noviembre de 2026**, zona horaria de Buenos Aires (UTC−3). Uso personal local. Sin despliegue.

## Resultado real

| Fuente | Ofertas únicas recuperadas | Candidatas tras ajustar clasificación |
| --- | ---: | ---: |
| Himalayas | 456 | 209 |
| Remotive | 11 | 4 |
| Total | 467 | 213 |

Los resultados de Himalayas son la unión deduplicada por GUID de las búsquedas configuradas, no el inventario completo del proveedor. Remotive entregó 11 entradas en su feed público completo durante la consulta. Ambas fuentes respondieron HTTP 200 y sus registros pudieron normalizarse sin errores de contrato.

| Clasificación por perfil | Ofertas |
| --- | ---: |
| Solo Web | 166 |
| Solo Game Dev | 42 |
| Ambos perfiles | 5 |
| Pestaña Web, incluyendo compartidas | 171 |
| Pestaña Game Dev, incluyendo compartidas | 47 |

De las 213 candidatas: **83 aceptables**, **31 para revisar** y **99 para descartar geográficamente**. Las descartadas se conservan y se pueden consultar con filtros. Las pestañas muestran cifras globales por perfil; el listado aplica los filtros elegidos y oculta por defecto las descartadas y las cerradas/vencidas. La clasificación no garantiza selección ni compatibilidad completa: también se debe revisar la evaluación técnica.

La primera pasada había seleccionado 231 candidatas. Al corregir menciones de Unity fuera de contexto, 18 dejaron de pertenecer a los perfiles; su historia se conserva en la base, sin mostrarlas como candidatas. Los registros originales de sincronización mantienen lo observado al realizar la consulta; el snapshot y este informe reflejan las reglas finales.

## Arquitectura y configuración

Monolito Next.js con App Router, TypeScript, React y Tailwind. Los Route Handlers ejecutan las integraciones desde Node. Zod valida entradas y respuestas. PostgreSQL está alojado en el proyecto Supabase proporcionado, mediante Postgres.js y conexión TLS al Session pooler IPv4.

Dos migraciones aplicadas: esquema inicial e índices/permisos/RLS, y actualización de pertenencia de perfiles basada en la evidencia actual de cada fuente. Tablas separadas para ofertas, fuentes, identidad por URL, seguimiento y sincronizaciones. La función de ingreso SQL es transaccional. No hay Express, microservicios, colas, tareas automáticas, ORM ni llamadas a LLM.

La única variable imprescindible para persistencia es `DATABASE_URL`, privada. `HIMALAYAS_API_KEY` es opcional. `GROQ_API_KEY` y `GROQ_MODEL` están reservadas. Las credenciales recibidas se guardaron únicamente en `.env.local`, excluido de Git. La clave publicable no se usa para las operaciones del backend.

Para ejecutar: `npm ci`, configurar `.env.local`, `npm run db:migrate` y `npm run dev`. Abrir <http://127.0.0.1:3000>. La configuración del proyecto actual ya quedó preparada. Las instrucciones completas y el mapa de archivos están en [README](../README.md).

## Evidencia de validación

- Consultas reales a `https://himalayas.app/jobs/api/search` con términos de ambos perfiles, `country=AR`, búsqueda global, `sort=recent` y páginas 1/2.
- Consulta real a `https://remotive.com/api/remote-jobs`, sin recortar el feed público.
- Consulta individual real de vigencia en Himalayas, usando el GUID de una oferta de iDelsoft: HTTP 200 y objeto `job` con el enlace de aplicación.
- Segunda importación de los registros reales: **cero nuevas inserciones**.
- Escritura y lectura de seguimiento en Supabase real; prueba transaccional revertida.
- Los seis estados personales se probaron por PATCH y GET HTTP; una nueva importación mantuvo el seguimiento. “Visto” también se persistió.
- Prueba en navegador: búsqueda por empresa, pestañas Web/Game Dev, guardado y recuperación después de recargar. La oferta utilizada para probar el guardado se devolvió a su estado inicial. También se comprobó el diseño a 390 px de ancho, sin desborde horizontal.
- Las solicitudes de origen externo recibieron 403 y los estados inválidos, 400. La clave publicable proporcionada no pudo leer `jobs` por la API pública.
- **63 tests** de contratos externos, clasificación, URLs, filtros, protección, paginación/429, caché durable y migraciones PostgreSQL aisladas.
- `npm run lint`, `npm run typecheck`, `npm test` y `npm run build` completados correctamente.

Los reportes generados se encuentran localmente en `artifacts/validation.json` y `artifacts/local-validation.json`. Se excluyen de Git para no redistribuir datos de las fuentes ni datos personales. Las nuevas ejecuciones reutilizan la caché vigente; no equivalen a una nueva consulta externa.

## Problemas y límites

La conexión directa de Supabase resolvía únicamente por IPv6 y no funcionó desde este entorno; el Session pooler IPv4 permitió aplicar las migraciones y verificar persistencia. No se necesitó crear otra base ni cambiar de proveedor.

Himalayas devolvió restricciones como strings y offsets numéricos, mientras que parte de su referencia muestra objetos de país y offsets como strings. El validador admite ambas formas. `pubDate` es fecha de actualización; `salaryPeriod` es esencial para no tratar tarifas horarias como anuales. Los enlaces originales de aplicación se preservan.

Las búsquedas se limitan a dos páginas por término/ámbito para mantener acotado el MVP; los truncamientos se registran. La búsqueda global conserva ofertas geográficamente incompatibles para poder explicar su descarte. No se da por terminado un resultado solo porque una página sea corta. Los feeds tienen caché/demora de 24 horas, por lo que actividad en la fuente no garantiza disponibilidad inmediata en la empresa.

La clasificación determinística puede dejar falsos positivos: requisitos incluidos en descripciones amplias, tecnologías secundarias, seniority implícito y condiciones de contratación no publicadas. Los casos inciertos requieren lectura humana. Se corrigieron falsos positivos observados como “Unity Catalog”, listas de otras búsquedas y “Sr” en títulos.

Las fuentes suelen conservar URLs propias distintas para la misma vacante. Sin un enlace específico compartido, no hay evidencia suficiente para fusionarlas automáticamente. La prueba SQL cubre la fusión entre fuentes con URL compartida, pero no se detectó tal coincidencia en esta muestra real.

Remotive no tiene una comprobación individual de cierre documentada. La ausencia se registra como sin verificar. Himalayas sí permite verificar registros individuales; la comprobación histórica está acotada a 15 por sincronización. No se borran ofertas ni estados personales al desaparecer de los resultados.

En navegador se detectó una diferencia de espacios en “p. m.” entre ICU de Node y Chromium; se corrigió usando reloj de 24 horas. También se corrigió la validación de origen para la canonicalización interna de localhost en Next.js, sin abrir acceso entre orígenes.

## Segunda etapa, no implementada

Mejorar reglas mediante ejemplos reales revisados, añadir fuentes ATS solo para empresas/job boards elegidos y preparar una evaluación opcional con Groq que mantenga geografía y afinidad separadas. Si se decide desplegar, agregar primero autenticación y autorización. No se avanzó automáticamente con estas funciones.
