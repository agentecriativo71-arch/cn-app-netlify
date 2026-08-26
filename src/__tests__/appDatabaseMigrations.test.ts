import { describe, expect, it } from "vitest";
import { applyAppDatabaseMigrations } from "../server/appDatabaseMigrations";

describe("migrations do PostgreSQL interno", () => {
  it("aplica cada versão uma única vez", async () => {
    const appliedVersions = new Set<string>();
    const executedMigrationSql: string[] = [];
    const database = {
      query: async (sql: string, values?: unknown[]) => {
        if (sql.startsWith("select version")) {
          return { rows: appliedVersions.has(String(values?.[0])) ? [{ version: values?.[0] }] : [] };
        }
        if (sql.startsWith("insert into app_schema_migrations")) {
          appliedVersions.add(String(values?.[0]));
          return { rows: [] };
        }
        if (sql.startsWith("alter table")) executedMigrationSql.push(sql);
        return { rows: [] };
      },
    };
    const migrations = [{ version: "20260826190000", sql: "alter table looks add column execution_id uuid;" }];

    const first = await applyAppDatabaseMigrations(database, migrations);
    const second = await applyAppDatabaseMigrations(database, migrations);

    expect(first).toEqual({ applied: ["20260826190000"], skipped: [] });
    expect(second).toEqual({ applied: [], skipped: ["20260826190000"] });
    expect(executedMigrationSql).toEqual(["alter table looks add column execution_id uuid;"]);
  });
});
