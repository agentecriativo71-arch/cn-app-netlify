import { getDatabasePool } from "./db";
import {
  FailOpenOperationalAnalytics,
  InMemoryAnalyticsRepository,
  OperationalAnalytics,
  type AnalyticsRepository,
} from "./operationalAnalytics";
import { PostgresAnalyticsRepository } from "./postgresAnalyticsRepository";

class UnavailableAnalyticsRepository implements AnalyticsRepository {
  private unavailable(): never {
    throw new Error("Banco de rastreabilidade indisponível.");
  }

  createExecution = async () => this.unavailable();
  updateExecution = async () => this.unavailable();
  createStep = async () => this.unavailable();
  updateStep = async () => this.unavailable();
  createArtifact = async () => this.unavailable();
  updateArtifact = async () => this.unavailable();
  rateArtifactAndQueue = async () => this.unavailable();
  getExecutionDetail = async () => this.unavailable();
  getDashboardOverview = async () => this.unavailable();
  claimDueNotifications = async () => this.unavailable();
  markNotificationSent = async () => this.unavailable();
  markNotificationFailed = async () => this.unavailable();
  listExpiredArtifacts = async () => this.unavailable();
  markArtifactDeleted = async () => this.unavailable();
  markArtifactDeletionFailed = async () => this.unavailable();
  purgeExpiredExecutions = async () => this.unavailable();
}

const testRepository = new InMemoryAnalyticsRepository();
const databasePool = getDatabasePool();
const repository: AnalyticsRepository = process.env.NODE_ENV === "test"
  ? testRepository
  : databasePool
    ? new PostgresAnalyticsRepository(databasePool)
    : new UnavailableAnalyticsRepository();

export const operationalAnalytics = new OperationalAnalytics(repository);
export const failOpenOperationalAnalytics = new FailOpenOperationalAnalytics(operationalAnalytics);

export function getTestAnalyticsRepository(): InMemoryAnalyticsRepository {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Repositório de teste indisponível fora do ambiente de testes.");
  }
  return testRepository;
}
