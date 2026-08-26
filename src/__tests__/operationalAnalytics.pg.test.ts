import { describe, expect, it } from "vitest";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { PostgresAnalyticsRepository } from "../server/postgresAnalyticsRepository";
import { OperationalAnalytics } from "../server/operationalAnalytics";

const analyticsTestDatabaseUrl = process.env.TEST_ANALYTICS_DATABASE_URL || process.env.TEST_DATABASE_URL;
const enabled = Boolean(analyticsTestDatabaseUrl);

describe.skipIf(!enabled)("rastreabilidade PostgreSQL (opt-in)", () => {
  it("aplica a migration e persiste execução, etapa e artefato", async () => {
    const pool = new pg.Pool({ connectionString: analyticsTestDatabaseUrl });
    try {
      const migration = await readFile(new URL("../../supabase/migrations/20260826171046_app_analytics_operational.sql", import.meta.url), "utf8");
      await pool.query(migration);
      const analytics = new OperationalAnalytics(new PostgresAnalyticsRepository(pool));
      const execution = await analytics.startExecution({ source: "manual", specification: { peca: "Vestido" } });
      const step = await execution.startStep({ stage: "croqui_generation", seed: 123 });
      await step.succeed({ provider: "fal", model: "seedream-v4" });
      const artifact = await execution.recordArtifact({ kind: "croqui", selected: true, retentionDays: 90 });
      await execution.complete();
      const detail = await analytics.getExecutionDetail(execution.executionId);
      expect(detail?.steps).toHaveLength(1);
      expect(detail?.artifacts[0].id).toBe(artifact.artifactId);
    } finally {
      await pool.end();
    }
  });
});
