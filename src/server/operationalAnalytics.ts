import { randomUUID } from "node:crypto";

export type TrackingStatus = "healthy" | "degraded";
export type ExecutionSource = "manual" | "reference";
export type ExecutionStatus = "running" | "completed" | "failed";
export type StepStatus = "running" | "success" | "error";

export type SafeJson =
  | string
  | number
  | boolean
  | null
  | SafeJson[]
  | { [key: string]: SafeJson };

export type ExecutionRecord = {
  id: string;
  source: ExecutionSource;
  status: ExecutionStatus;
  trackingStatus: TrackingStatus;
  specification: Record<string, SafeJson>;
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  analyticsRetentionUntil: string;
};

export type ExecutionStepRecord = {
  id: string;
  executionId: string;
  parentStepId: string | null;
  stage: string;
  attempt: number;
  status: StepStatus;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  seed: number | null;
  errorCode: string | null;
  metadata: Record<string, SafeJson>;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
};

export type ArtifactKind =
  | "reference_crop"
  | "croqui_candidate"
  | "croqui"
  | "realistic";

export type ExecutionArtifactRecord = {
  id: string;
  executionId: string;
  stepId: string | null;
  kind: ArtifactKind;
  selected: boolean;
  status: "pending" | "available" | "storage_failed" | "deleted" | "deletion_failed";
  storageBucket: string | null;
  storagePath: string | null;
  sourceUrl: string | null;
  mimeType: string | null;
  metadata: Record<string, SafeJson>;
  retentionUntil: string;
  deletionAttempts: number;
  deletionErrorCode: string | null;
  deletedAt: string | null;
  createdAt: string;
  rating: number | null;
};

export type NotificationRecord = {
  id: string;
  executionId: string;
  artifactId: string;
  eventKey: string;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: string;
  lastErrorCode: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type NotificationDelivery = NotificationRecord & {
  score: number;
  artifactKind: ArtifactKind;
};

export type ExpiredArtifact = Pick<ExecutionArtifactRecord, "id" | "storageBucket" | "storagePath" | "status" | "deletionAttempts">;

export type DashboardExecutionSummary = {
  id: string;
  source: ExecutionSource;
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  artifactCount: number;
  ratingCount: number;
  averageRating: number | null;
  lowRatingCount: number;
  trackingStatus: TrackingStatus;
};

export type DashboardOverview = {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  averageDurationMs: number | null;
  totalRatings: number;
  averageRating: number | null;
  lowRatingCount: number;
  executions: DashboardExecutionSummary[];
};

export type ExecutionDetail = ExecutionRecord & {
  steps: ExecutionStepRecord[];
  artifacts: ExecutionArtifactRecord[];
  notifications: NotificationRecord[];
};

export interface AnalyticsRepository {
  createExecution(record: ExecutionRecord): Promise<void>;
  updateExecution(id: string, patch: Partial<ExecutionRecord>): Promise<void>;
  createStep(record: ExecutionStepRecord): Promise<void>;
  updateStep(id: string, patch: Partial<ExecutionStepRecord>): Promise<void>;
  createArtifact(record: ExecutionArtifactRecord): Promise<void>;
  updateArtifact(id: string, patch: Partial<ExecutionArtifactRecord>): Promise<void>;
  rateArtifactAndQueue(artifactId: string, score: number, now: string, executionId?: string): Promise<void>;
  getExecutionDetail(id: string): Promise<ExecutionDetail | null>;
  getDashboardOverview(limit: number): Promise<DashboardOverview>;
  claimDueNotifications(now: string, limit: number): Promise<NotificationDelivery[]>;
  markNotificationSent(id: string, sentAt: string): Promise<void>;
  markNotificationFailed(id: string, errorCode: string, nextAttemptAt: string): Promise<void>;
  listExpiredArtifacts(now: string, limit: number): Promise<ExpiredArtifact[]>;
  markArtifactDeleted(id: string, deletedAt: string): Promise<void>;
  markArtifactDeletionFailed(id: string, errorCode: string): Promise<void>;
  purgeExpiredExecutions(now: string): Promise<number>;
}

const SPECIFICATION_FIELDS = new Set([
  "ocasiao",
  "tipoCerimonia",
  "rendaDecisao",
  "biotipo",
  "peca",
  "comprimento",
  "decote",
  "possuiManga",
  "manga",
  "saia",
  "renda",
  "cor",
  "tecidoSku",
  "modo",
]);

function isSafeScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

const UNSAFE_METADATA_KEYS = /(prompt|token|secret|password|telefone|phone|imageData|imageUrl|referenceImage|base64|payload)/i;

export function sanitizeMetadata(input: unknown, depth = 0): Record<string, SafeJson> {
  if (!input || typeof input !== "object" || Array.isArray(input) || depth > 4) return {};
  const safe: Record<string, SafeJson> = {};
  for (const [key, value] of Object.entries(input)) {
    if (UNSAFE_METADATA_KEYS.test(key)) continue;
    if (isSafeScalar(value)) {
      if (typeof value !== "string" || (!value.startsWith("data:") && value.length <= 500)) safe[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      const safeItems: SafeJson[] = [];
      for (const item of value.slice(0, 50)) {
        if (isSafeScalar(item) && (typeof item !== "string" || (!item.startsWith("data:") && item.length <= 500))) safeItems.push(item);
        else if (item && typeof item === "object" && !Array.isArray(item)) safeItems.push(sanitizeMetadata(item, depth + 1));
      }
      safe[key] = safeItems;
      continue;
    }
    if (typeof value === "object") safe[key] = sanitizeMetadata(value, depth + 1);
  }
  return safe;
}

export function sanitizeSpecification(input: unknown): Record<string, SafeJson> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => SPECIFICATION_FIELDS.has(key) && isSafeScalar(value))
      .map(([key, value]) => [key, value as SafeJson]),
  );
}

export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  private readonly executions = new Map<string, ExecutionRecord>();
  private readonly steps = new Map<string, ExecutionStepRecord>();
  private readonly artifacts = new Map<string, ExecutionArtifactRecord>();
  private readonly notifications = new Map<string, NotificationRecord>();

  async createExecution(record: ExecutionRecord): Promise<void> {
    this.executions.set(record.id, structuredClone(record));
  }

  async updateExecution(id: string, patch: Partial<ExecutionRecord>): Promise<void> {
    const current = this.executions.get(id);
    if (!current) throw new Error("Execução não encontrada.");
    this.executions.set(id, { ...current, ...structuredClone(patch) });
  }

  async createStep(record: ExecutionStepRecord): Promise<void> {
    this.steps.set(record.id, structuredClone(record));
  }

  async updateStep(id: string, patch: Partial<ExecutionStepRecord>): Promise<void> {
    const current = this.steps.get(id);
    if (!current) throw new Error("Etapa não encontrada.");
    this.steps.set(id, { ...current, ...structuredClone(patch) });
  }

  async createArtifact(record: ExecutionArtifactRecord): Promise<void> {
    this.artifacts.set(record.id, structuredClone(record));
  }

  async updateArtifact(id: string, patch: Partial<ExecutionArtifactRecord>): Promise<void> {
    const current = this.artifacts.get(id);
    if (!current) throw new Error("Artefato não encontrado.");
    this.artifacts.set(id, { ...current, ...structuredClone(patch) });
  }

  async rateArtifactAndQueue(artifactId: string, score: number, now: string, executionId?: string): Promise<void> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) throw new Error("Artefato não encontrado.");
    if (executionId && artifact.executionId !== executionId) throw new Error("Artefato não pertence à execução informada.");
    artifact.rating = score;
    if (score <= 2) {
      const eventKey = `low-rating:${artifactId}`;
      if (!this.notifications.has(eventKey)) {
        this.notifications.set(eventKey, {
          id: randomUUID(),
          executionId: artifact.executionId,
          artifactId,
          eventKey,
          status: "pending",
          attempts: 0,
          nextAttemptAt: now,
          lastErrorCode: null,
          sentAt: null,
          createdAt: now,
        });
      }
    }
  }

  listNotifications(): NotificationRecord[] {
    return structuredClone([...this.notifications.values()]);
  }

  async getDashboardOverview(limit: number): Promise<DashboardOverview> {
    const executions = [...this.executions.values()];
    const summaries = executions.map((execution) => {
      const artifacts = [...this.artifacts.values()].filter((artifact) => artifact.executionId === execution.id);
      const ratings = artifacts.map((artifact) => artifact.rating).filter((rating): rating is number => rating !== null);
      const durationMs = execution.completedAt ? Math.max(0, new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) : null;
      return { id: execution.id, source: execution.source, status: execution.status, startedAt: execution.startedAt, completedAt: execution.completedAt, durationMs, artifactCount: artifacts.length, ratingCount: ratings.length, averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null, lowRatingCount: ratings.filter((rating) => rating <= 2).length, trackingStatus: execution.trackingStatus };
    }).sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    const completed = summaries.filter((summary) => summary.status === "completed");
    const durations = completed.map((summary) => summary.durationMs).filter((duration): duration is number => duration !== null);
    const ratings = summaries.flatMap((summary) => [...this.artifacts.values()].filter((artifact) => artifact.executionId === summary.id).map((artifact) => artifact.rating).filter((rating): rating is number => rating !== null));
    return { totalExecutions: summaries.length, completedExecutions: completed.length, failedExecutions: summaries.filter((summary) => summary.status === "failed").length, averageDurationMs: durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : null, totalRatings: ratings.length, averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null, lowRatingCount: ratings.filter((rating) => rating <= 2).length, executions: summaries.slice(0, limit) };
  }

  async claimDueNotifications(now: string, limit: number): Promise<NotificationDelivery[]> {
    const due = [...this.notifications.values()].filter((notification) => ["pending", "failed"].includes(notification.status) && notification.nextAttemptAt <= now).slice(0, limit);
    return due.flatMap((notification) => {
      const artifact = this.artifacts.get(notification.artifactId);
      if (!artifact || artifact.rating === null) return [];
      notification.status = "processing";
      notification.attempts += 1;
      return [{ ...structuredClone(notification), score: artifact.rating, artifactKind: artifact.kind }];
    });
  }

  async markNotificationSent(id: string, sentAt: string): Promise<void> {
    const notification = [...this.notifications.values()].find((item) => item.id === id);
    if (!notification) throw new Error("Notificação não encontrada.");
    notification.status = "sent";
    notification.sentAt = sentAt;
  }

  async markNotificationFailed(id: string, errorCode: string, nextAttemptAt: string): Promise<void> {
    const notification = [...this.notifications.values()].find((item) => item.id === id);
    if (!notification) throw new Error("Notificação não encontrada.");
    notification.status = "failed";
    notification.lastErrorCode = errorCode;
    notification.nextAttemptAt = nextAttemptAt;
  }

  async listExpiredArtifacts(now: string, limit: number): Promise<ExpiredArtifact[]> {
    return structuredClone([...this.artifacts.values()]
      .filter((artifact) => artifact.retentionUntil <= now && artifact.storagePath && ["available", "storage_failed", "deletion_failed"].includes(artifact.status))
      .sort((left, right) => left.retentionUntil.localeCompare(right.retentionUntil))
      .slice(0, limit)
      .map(({ id, storageBucket, storagePath, status, deletionAttempts }) => ({ id, storageBucket, storagePath, status, deletionAttempts })));
  }

  async markArtifactDeleted(id: string, deletedAt: string): Promise<void> {
    await this.updateArtifact(id, { status: "deleted", deletedAt, deletionErrorCode: null });
  }

  async markArtifactDeletionFailed(id: string, errorCode: string): Promise<void> {
    const current = this.artifacts.get(id);
    if (!current) throw new Error("Artefato não encontrado.");
    await this.updateArtifact(id, { status: "deletion_failed", deletionErrorCode: errorCode, deletionAttempts: current.deletionAttempts + 1 });
  }

  async purgeExpiredExecutions(now: string): Promise<number> {
    const ids = [...this.executions.values()].filter((execution) => {
      if (execution.analyticsRetentionUntil > now) return false;
      return ![...this.artifacts.values()].some((artifact) => artifact.executionId === execution.id && artifact.storagePath && artifact.status !== "deleted");
    }).map((execution) => execution.id);
    for (const id of ids) {
      this.executions.delete(id);
      for (const [stepId, step] of this.steps) if (step.executionId === id) this.steps.delete(stepId);
      for (const [artifactId, artifact] of this.artifacts) if (artifact.executionId === id) this.artifacts.delete(artifactId);
      for (const [eventKey, notification] of this.notifications) if (notification.executionId === id) this.notifications.delete(eventKey);
    }
    return ids.length;
  }

  async getExecutionDetail(id: string): Promise<ExecutionDetail | null> {
    const execution = this.executions.get(id);
    if (!execution) return null;
    const steps = [...this.steps.values()]
      .filter((step) => step.executionId === id)
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
    const artifacts = [...this.artifacts.values()]
      .filter((artifact) => artifact.executionId === id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const notifications = [...this.notifications.values()].filter((notification) => notification.executionId === id);
    return structuredClone({ ...execution, steps, artifacts, notifications });
  }
}

export class OperationalAnalytics {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async startExecution(input: {
    source: ExecutionSource;
    specification?: unknown;
  }): Promise<TrackedExecution> {
    const id = randomUUID();
    await this.repository.createExecution({
      id,
      source: input.source,
      status: "running",
      trackingStatus: "healthy",
      specification: sanitizeSpecification(input.specification),
      startedAt: this.now().toISOString(),
      completedAt: null,
      failedAt: null,
      errorCode: null,
      analyticsRetentionUntil: addMonths(this.now(), 12).toISOString(),
    });
    return new TrackedExecution(id, this.repository, this.now);
  }

  async resumeExecution(id: string): Promise<TrackedExecution> {
    const detail = await this.repository.getExecutionDetail(id);
    if (!detail) throw new Error("Execução não encontrada.");
    await this.repository.updateExecution(id, {
      status: "running",
      completedAt: null,
      failedAt: null,
      errorCode: null,
    });
    return new TrackedExecution(id, this.repository, this.now);
  }

  getExecutionDetail(id: string): Promise<ExecutionDetail | null> {
    return this.repository.getExecutionDetail(id);
  }

  getDashboardOverview(limit = 50): Promise<DashboardOverview> {
    return this.repository.getDashboardOverview(limit);
  }

  getRepository(): AnalyticsRepository {
    return this.repository;
  }

  claimDueNotifications(now: string, limit = 20): Promise<NotificationDelivery[]> {
    return this.repository.claimDueNotifications(now, limit);
  }

  markNotificationSent(id: string, sentAt: string): Promise<void> {
    return this.repository.markNotificationSent(id, sentAt);
  }

  markNotificationFailed(id: string, errorCode: string, nextAttemptAt: string): Promise<void> {
    return this.repository.markNotificationFailed(id, errorCode, nextAttemptAt);
  }

  async rateArtifact(input: { artifactId: string; score: number; executionId?: string }): Promise<void> {
    if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
      throw new Error("A avaliação deve ser um número inteiro entre 1 e 5.");
    }
    await this.repository.rateArtifactAndQueue(
      input.artifactId,
      input.score,
      this.now().toISOString(),
      input.executionId,
    );
  }
}

export class FailOpenOperationalAnalytics {
  constructor(
    private readonly analytics: OperationalAnalytics,
    private readonly logger: Pick<Console, "warn"> = console,
  ) {}

  async startExecution(input: {
    source: ExecutionSource;
    specification?: unknown;
  }): Promise<{
    execution: FailOpenTrackedExecution | null;
    trackingStatus: TrackingStatus;
  }> {
    try {
      const execution = await this.analytics.startExecution(input);
      return {
        execution: new FailOpenTrackedExecution(execution, this.logger),
        trackingStatus: "healthy",
      };
    } catch {
      this.logger.warn("[TRACKING] rastreio indisponível", { code: "tracking_unavailable" });
      return { execution: null, trackingStatus: "degraded" };
    }
  }

  async resumeExecution(id: string | null | undefined): Promise<{
    execution: FailOpenTrackedExecution | null;
    trackingStatus: TrackingStatus;
  }> {
    if (!id) return { execution: null, trackingStatus: "degraded" };
    try {
      const execution = await this.analytics.resumeExecution(id);
      return {
        execution: new FailOpenTrackedExecution(execution, this.logger),
        trackingStatus: "healthy",
      };
    } catch {
      this.logger.warn("[TRACKING] execução não pôde ser retomada", { code: "tracking_resume_failed" });
      return { execution: null, trackingStatus: "degraded" };
    }
  }
}

export class FailOpenTrackedExecution {
  trackingStatus: TrackingStatus = "healthy";

  constructor(
    private readonly execution: TrackedExecution,
    private readonly logger: Pick<Console, "warn">,
  ) {}

  get executionId(): string {
    return this.execution.executionId;
  }

  async startStep(input: Parameters<TrackedExecution["startStep"]>[0]): Promise<FailOpenTrackedStep | null> {
    try {
      const step = await this.execution.startStep(input);
      return new FailOpenTrackedStep(step, () => this.degrade(), this.logger);
    } catch {
      this.degrade();
      return null;
    }
  }

  async recordArtifact(input: Parameters<TrackedExecution["recordArtifact"]>[0]): Promise<{ artifactId: string } | null> {
    try {
      return await this.execution.recordArtifact(input);
    } catch {
      this.degrade();
      return null;
    }
  }

  async updateArtifact(id: string, patch: Parameters<TrackedExecution["updateArtifact"]>[1]): Promise<void> {
    try {
      await this.execution.updateArtifact(id, patch);
    } catch {
      this.degrade();
      this.logger.warn("[TRACKING] atualização do artefato falhou", { code: "tracking_artifact_write_failed" });
    }
  }

  async complete(): Promise<void> {
    try {
      await this.execution.complete();
    } catch {
      this.degrade();
    }
  }

  async fail(errorCode: string): Promise<void> {
    try {
      await this.execution.fail(errorCode);
    } catch {
      this.degrade();
    }
  }

  private degrade(): void {
    if (this.trackingStatus === "degraded") return;
    this.trackingStatus = "degraded";
    this.logger.warn("[TRACKING] operação de rastreio falhou", { code: "tracking_write_failed" });
  }
}

export class FailOpenTrackedStep {
  constructor(
    private readonly step: TrackedStep,
    private readonly degrade: () => void,
    private readonly logger: Pick<Console, "warn">,
  ) {}

  get stepId(): string {
    return this.step.stepId;
  }

  async succeed(input: Parameters<TrackedStep["succeed"]>[0] = {}): Promise<void> {
    try {
      await this.step.succeed(input);
    } catch {
      this.degrade();
      this.logger.warn("[TRACKING] conclusão da etapa falhou", { code: "tracking_step_write_failed" });
    }
  }

  async fail(errorCode: string): Promise<void> {
    try {
      await this.step.fail(errorCode);
    } catch {
      this.degrade();
      this.logger.warn("[TRACKING] falha da etapa não persistida", { code: "tracking_step_write_failed" });
    }
  }
}

export class TrackedExecution {
  constructor(
    readonly executionId: string,
    private readonly repository: AnalyticsRepository,
    private readonly now: () => Date,
  ) {}

  async startStep(input: {
    stage: string;
    parentStepId?: string | null;
    attempt?: number;
    seed?: number | null;
    promptVersion?: string | null;
  }): Promise<TrackedStep> {
    const id = randomUUID();
    const startedAt = this.now();
    await this.repository.createStep({
      id,
      executionId: this.executionId,
      parentStepId: input.parentStepId || null,
      stage: input.stage,
      attempt: input.attempt || 1,
      status: "running",
      provider: null,
      model: null,
      promptVersion: input.promptVersion || null,
      seed: input.seed ?? null,
      errorCode: null,
      metadata: {},
      startedAt: startedAt.toISOString(),
      finishedAt: null,
      durationMs: null,
    });
    return new TrackedStep(id, this.repository, startedAt, this.now);
  }

  async recordArtifact(input: {
    kind: ArtifactKind;
    selected?: boolean;
    stepId?: string | null;
    sourceUrl?: string | null;
    storageBucket?: string | null;
    storagePath?: string | null;
    mimeType?: string | null;
    metadata?: unknown;
    status?: ExecutionArtifactRecord["status"];
    retentionDays: number;
  }): Promise<{ artifactId: string }> {
    const id = randomUUID();
    const createdAt = this.now();
    await this.repository.createArtifact({
      id,
      executionId: this.executionId,
      stepId: input.stepId || null,
      kind: input.kind,
      selected: input.selected || false,
      status: input.status || (input.storagePath || input.sourceUrl ? "available" : "pending"),
      storageBucket: input.storageBucket || null,
      storagePath: input.storagePath || null,
      sourceUrl: input.sourceUrl || null,
      mimeType: input.mimeType || null,
      metadata: sanitizeMetadata(input.metadata),
      retentionUntil: new Date(
        createdAt.getTime() + input.retentionDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      deletionAttempts: 0,
      deletionErrorCode: null,
      deletedAt: null,
      createdAt: createdAt.toISOString(),
      rating: null,
    });
    return { artifactId: id };
  }

  async updateArtifact(id: string, patch: Partial<ExecutionArtifactRecord>): Promise<void> {
    await this.repository.updateArtifact(id, patch);
  }

  async complete(): Promise<void> {
    await this.repository.updateExecution(this.executionId, {
      status: "completed",
      completedAt: this.now().toISOString(),
    });
  }

  async fail(errorCode: string): Promise<void> {
    await this.repository.updateExecution(this.executionId, {
      status: "failed",
      failedAt: this.now().toISOString(),
      errorCode,
    });
  }
}

export class TrackedStep {
  constructor(
    readonly stepId: string,
    private readonly repository: AnalyticsRepository,
    private readonly startedAt: Date,
    private readonly now: () => Date,
  ) {}

  async succeed(input: { provider?: string; model?: string; metadata?: unknown } = {}): Promise<void> {
    const finishedAt = this.now();
    await this.repository.updateStep(this.stepId, {
      status: "success",
      provider: input.provider || null,
      model: input.model || null,
      metadata: sanitizeMetadata(input.metadata),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - this.startedAt.getTime()),
    });
  }

  async fail(errorCode: string): Promise<void> {
    const finishedAt = this.now();
    await this.repository.updateStep(this.stepId, {
      status: "error",
      errorCode,
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - this.startedAt.getTime()),
    });
  }
}
