import { readFile } from "node:fs/promises";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { applyAppDatabaseMigrations } from "../server/appDatabaseMigrations";

const enabled = Boolean(process.env.TEST_APP_DATABASE_URL);

describe.skipIf(!enabled)("migration do PostgreSQL interno (opt-in)", () => {
  it("adiciona referências lógicas de execução de forma idempotente", async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_APP_DATABASE_URL });
    const version = "20260826190000";
    try {
      await pool.query("create table if not exists public.looks (id uuid primary key)");
      await pool.query("create table if not exists public.upload_sessions (id uuid primary key)");
      const sql = await readFile(
        new URL(`../../database/migrations/${version}_execution_tracking_references.sql`, import.meta.url),
        "utf8",
      );

      await applyAppDatabaseMigrations(pool, [{ version, sql }]);
      const secondRun = await applyAppDatabaseMigrations(pool, [{ version, sql }]);
      const columns = await pool.query(`
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and (table_name, column_name) in (
            ('looks', 'execution_id'),
            ('upload_sessions', 'execution_id'),
            ('upload_sessions', 'croqui_artifact_id')
          )
        order by table_name, column_name
      `);

      expect(secondRun).toEqual({ applied: [], skipped: [version] });
      expect(columns.rows).toHaveLength(3);
    } finally {
      await pool.end();
    }
  });
});
