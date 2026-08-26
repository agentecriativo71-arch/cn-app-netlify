export type AppDatabaseMigration = {
  version: string;
  sql: string;
};

export type MigrationDatabase = {
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
};

export async function applyAppDatabaseMigrations(
  database: MigrationDatabase,
  migrations: AppDatabaseMigration[],
): Promise<{ applied: string[]; skipped: string[] }> {
  const result = { applied: [] as string[], skipped: [] as string[] };

  await database.query(`
    create table if not exists app_schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  for (const migration of migrations) {
    await database.query("begin");
    try {
      const existing = await database.query(
        "select version from app_schema_migrations where version = $1",
        [migration.version],
      );
      if (existing.rows.length > 0) {
        result.skipped.push(migration.version);
        await database.query("commit");
        continue;
      }

      await database.query(migration.sql);
      await database.query(
        "insert into app_schema_migrations (version) values ($1)",
        [migration.version],
      );
      await database.query("commit");
      result.applied.push(migration.version);
    } catch (error) {
      await database.query("rollback");
      throw error;
    }
  }

  return result;
}
