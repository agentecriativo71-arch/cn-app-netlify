import { describe, expect, it } from "vitest";
import { createAnalyticsDatabasePool } from "../server/analyticsDatabase";

describe("conexão do banco de rastreabilidade", () => {
  it("usa exclusivamente ANALYTICS_DATABASE_URL", () => {
    let receivedConnectionString: string | undefined;
    const expectedPool = { name: "analytics" };

    const pool = createAnalyticsDatabasePool(
      {
        ANALYTICS_DATABASE_URL: "postgresql://analytics.example/analytics",
        DATABASE_URL: "postgresql://app.example/app",
      },
      (options) => {
        receivedConnectionString = options.connectionString;
        return expectedPool;
      },
    );

    expect(pool).toBe(expectedPool);
    expect(receivedConnectionString).toBe("postgresql://analytics.example/analytics");
  });

  it("não reutiliza DATABASE_URL quando analytics não está configurado", () => {
    let poolCreated = false;

    const pool = createAnalyticsDatabasePool(
      { DATABASE_URL: "postgresql://app.example/app" },
      () => {
        poolCreated = true;
        return { name: "unexpected" };
      },
    );

    expect(pool).toBeNull();
    expect(poolCreated).toBe(false);
  });
});
