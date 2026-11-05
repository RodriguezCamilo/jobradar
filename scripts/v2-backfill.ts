import { database } from "../src/lib/database";
import { classifyLanguage } from "../src/lib/language";
const sql = database();
try {
  const rows =
    await sql`select source,external_id,normalized_payload from public.job_sources`;
  await sql.begin(async (tx) => {
    for (const row of rows) {
      const payload = row.normalized_payload;
      const language = classifyLanguage(
        payload.description || "",
        payload.application_language,
      );
      await tx`update public.job_sources set normalized_payload=${tx.json({ ...payload, language })} where source=${row.source} and external_id=${row.external_id}`;
    }
  });
  console.log(
    `Idioma determinístico actualizado en ${rows.length} apariciones, sin cambiar seguimiento, fechas, URLs ni vigencia.`,
  );
} finally {
  await sql.end();
}
