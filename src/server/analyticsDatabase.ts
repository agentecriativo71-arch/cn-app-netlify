import pg from "pg";

type AnalyticsEnvironment = Partial<Pick<NodeJS.ProcessEnv, "ANALYTICS_DATABASE_URL" | "DATABASE_URL">>;
type PoolFactory<TPool> = (options: pg.PoolConfig) => TPool;

function shouldUseSsl(url: string): boolean {
  if (url.includes("sslmode=disable") || url.includes("ssl=false")) return false;
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1" || !host.includes(".")) return false;
  } catch {
    return true;
  }
  return true;
}

export function createAnalyticsDatabasePool<TPool = pg.Pool>(
  environment: AnalyticsEnvironment,
  createPool: PoolFactory<TPool> = (options) => new pg.Pool(options) as TPool,
): TPool | null {
  const connectionString = environment.ANALYTICS_DATABASE_URL;
  if (!connectionString) return null;

  return createPool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
  });
}

const analyticsPool = process.env.NODE_ENV === "test"
  ? null
  : createAnalyticsDatabasePool(process.env);

export function getAnalyticsDatabasePool(): pg.Pool | null {
  return analyticsPool;
}
