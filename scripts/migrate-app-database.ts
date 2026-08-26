import { readFile } from "node:fs/promises";
import { getDatabasePool } from "../src/server/db";
import { applyAppDatabaseMigrations } from "../src/server/appDatabaseMigrations";

const version = "20260826190000";
const migrationUrl = new URL(`../database/migrations/${version}_execution_tracking_references.sql`, import.meta.url);

async function main() {
  const pool = getDatabasePool();
  if (!pool) throw new Error("DATABASE_URL não configurada para migration interna.");

  try {
    const sql = await readFile(migrationUrl, "utf8");
    const result = await applyAppDatabaseMigrations(pool, [{ version, sql }]);
    console.info("Migration interna concluída.", result);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration interna falhou.", error instanceof Error ? error.message : "unknown_error");
  process.exitCode = 1;
});
