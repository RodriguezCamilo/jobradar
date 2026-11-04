import postgres from "postgres";

const globalDb = globalThis as unknown as {
  radarSql?: ReturnType<typeof postgres>;
};
export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("Falta DATABASE_URL privada en .env.local.");
  if (!globalDb.radarSql)
    globalDb.radarSql = postgres(process.env.DATABASE_URL, {
      ssl: "require",
      max: 3,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
      connection: {
        application_name: "job-radar-local",
        statement_timeout: 20000,
      },
    });
  return globalDb.radarSql;
}
