import type { Pool, PoolClient } from "pg";
import type {
  AnalyticsRepository,
  ExecutionArtifactRecord,
  ExecutionDetail,
  ExecutionRecord,
  ExecutionStepRecord,
} from "./operationalAnalytics";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

function executionPatch(patch: Partial<ExecutionRecord>) {
  const columns: Record<keyof ExecutionRecord, string> = {
    id: "id",
    source: "source",
    status: "status",
    trackingStatus: "tracking_status",
    specification: "specification",
    startedAt: "started_at",
    completedAt: "completed_at",
    failedAt: "failed_at",
    errorCode: "error_code",
    analyticsRetentionUntil: "analytics_retention_until",
  };
  return buildPatch(patch, columns);
}

function stepPatch(patch: Partial<ExecutionStepRecord>) {
  const columns: Record<keyof ExecutionStepRecord, string> = {
    id: "id",
    executionId: "execution_id",
    parentStepId: "parent_step_id",
    stage: "stage",
    attempt: "attempt",
    status: "status",
    provider: "provider",
    model: "model",
    promptVersion: "prompt_version",
    seed: "seed",
    errorCode: "error_code",
    metadata: "metadata",
    startedAt: "started_at",
    finishedAt: "finished_at",
    durationMs: "duration_ms",
  };
  return buildPatch(patch, columns);
}

function buildPatch<T extends object>(patch: Partial<T>, columns: Record<keyof T, string>) {
  const entries = Object.entries(patch) as Array<[keyof T, unknown]>;
  return {
    assignments: entries.map(([key], index) => `${columns[key]} = $${index + 2}`),
    values: entries.map(([, value]) => value),
  };
}

function mapStep(row: Record<string, unknown>): ExecutionStepRecord {
  return {
    id: String(row.id),
    executionId: String(row.execution_id),
    parentStepId: row.parent_step_id ? String(row.parent_step_id) : null,
    stage: String(row.stage),
    attempt: Number(row.attempt),
    status: row.status as ExecutionStepRecord["status"],
    provider: row.provider ? String(row.provider) : null,
    model: row.model ? String(row.model) : null,
    promptVersion: row.prompt_version ? String(row.prompt_version) : null,
    seed: row.seed == null ? null : Number(row.seed),
    errorCode: row.error_code ? String(row.error_code) : null,
    metadata: (row.metadata || {}) as ExecutionStepRecord["metadata"],
    startedAt: new Date(String(row.started_at)).toISOString(),
    finishedAt: row.finished_at ? new Date(String(row.finished_at)).toISOString() : null,
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
  };
}

function mapArtifact(row: Record<string, unknown>): ExecutionArtifactRecord {
  return {
    id: String(row.id),
    executionId: String(row.execution_id),
    stepId: row.step_id ? String(row.step_id) : null,
    kind: row.kind as ExecutionArtifactRecord["kind"],
    selected: Boolean(row.selected),
    status: row.status as ExecutionArtifactRecord["status"],
    storageBucket: row.storage_bucket ? String(row.storage_bucket) : null,
    storagePath: row.storage_path ? String(row.storage_path) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    mimeType: row.mime_type ? String(row.mime_type) : null,
    metadata: (row.metadata || {}) as ExecutionArtifactRecord["metadata"],
    retentionUntil: new Date(String(row.retention_until)).toISOString(),
    deletionAttempts: Number(row.deletion_attempts || 0),
    deletionErrorCode: row.deletion_error_code ? String(row.deletion_error_code) : null,
    deletedAt: row.deleted_at ? new Date(String(row.deleted_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    rating: row.rating == null ? null : Number(row.rating),
  };
}

export class PostgresAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly pool: Pool) {}

  async createExecution(record: ExecutionRecord): Promise<void> {
    await this.pool.query(
      `insert into app_analytics.executions
        (id, source, status, tracking_status, specification, error_code, started_at, completed_at, failed_at, analytics_retention_until)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)`,
      [record.id, record.source, record.status, record.trackingStatus, JSON.stringify(record.specification), record.errorCode, record.startedAt, record.completedAt, record.failedAt, record.analyticsRetentionUntil],
    );
  }

  async updateExecution(id: string, patch: Partial<ExecutionRecord>): Promise<void> {
    const { assignments, values } = executionPatch(patch);
    if (!assignments.length) return;
    await this.pool.query(
      `update app_analytics.executions set ${assignments.join(", ")}, updated_at = now() where id = $1`,
      [id, ...values.map((value) => typeof value === "object" && value !== null ? JSON.stringify(value) : value)],
    );
  }

  async createStep(record: ExecutionStepRecord): Promise<void> {
    await this.pool.query(
      `insert into app_analytics.execution_steps
        (id, execution_id, parent_step_id, stage, attempt, status, provider, model, prompt_version, seed, error_code, metadata, started_at, finished_at, duration_ms)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15)`,
      [record.id, record.executionId, record.parentStepId, record.stage, record.attempt, record.status, record.provider, record.model, record.promptVersion, record.seed, record.errorCode, JSON.stringify(record.metadata), record.startedAt, record.finishedAt, record.durationMs],
    );
  }

  async updateStep(id: string, patch: Partial<ExecutionStepRecord>): Promise<void> {
    const { assignments, values } = stepPatch(patch);
    if (!assignments.length) return;
    await this.pool.query(
      `update app_analytics.execution_steps set ${assignments.join(", ")} where id = $1`,
      [id, ...values.map((value) => typeof value === "object" && value !== null ? JSON.stringify(value) : value)],
    );
  }

  async createArtifact(record: ExecutionArtifactRecord): Promise<void> {
    await this.pool.query(
      `insert into app_analytics.execution_artifacts
        (id, execution_id, step_id, kind, selected, status, storage_bucket, storage_path, source_url, mime_type, metadata, retention_until, deletion_attempts, deletion_error_code, deleted_at, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16)`,
      [record.id, record.executionId, record.stepId, record.kind, record.selected, record.status, record.storageBucket, record.storagePath, record.sourceUrl, record.mimeType, JSON.stringify(record.metadata), record.retentionUntil, record.deletionAttempts, record.deletionErrorCode, record.deletedAt, record.createdAt],
    );
  }

  async updateArtifact(id: string, patch: Partial<ExecutionArtifactRecord>): Promise<void> {
    const columns: Record<string, string> = {
      selected: "selected",
      status: "status",
      storageBucket: "storage_bucket",
      storagePath: "storage_path",
      sourceUrl: "source_url",
      mimeType: "mime_type",
      metadata: "metadata",
      retentionUntil: "retention_until",
      deletionAttempts: "deletion_attempts",
      deletionErrorCode: "deletion_error_code",
      deletedAt: "deleted_at",
      rating: "rating",
    };
    const entries = Object.entries(patch).filter(([key]) => columns[key]);
    if (!entries.length) return;
    const assignments = entries.map(([key], index) => `${columns[key]} = $${index + 2}`);
    const values = entries.map(([, value]) => typeof value === "object" && value !== null ? JSON.stringify(value) : value);
    await this.pool.query(
      `update app_analytics.execution_artifacts set ${assignments.join(", ")}, updated_at = now() where id = $1`,
      [id, ...values],
    );
  }

  async rateArtifactAndQueue(artifactId: string, score: number, now: string, requestedExecutionId?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const artifact = await client.query(
        "select execution_id, kind from app_analytics.execution_artifacts where id = $1 for update",
        [artifactId],
      );
      if (!artifact.rowCount) throw new Error("Artefato não encontrado.");
      const executionId = artifact.rows[0].execution_id as string;
      if (requestedExecutionId && executionId !== requestedExecutionId) throw new Error("Artefato não pertence à execução informada.");
      await client.query(
        `insert into app_analytics.result_ratings (execution_id, artifact_id, score, rated_at, updated_at)
         values ($1, $2, $3, $4, $4)
         on conflict (artifact_id) do update set score = excluded.score, updated_at = excluded.updated_at`,
        [executionId, artifactId, score, now],
      );
      if (score <= 2) {
        await client.query(
          `insert into app_analytics.notification_outbox
            (execution_id, artifact_id, event_key, payload, next_attempt_at)
           values ($1, $2, $3, $4::jsonb, $5)
           on conflict (event_key) do nothing`,
          [executionId, artifactId, `low-rating:${artifactId}`, JSON.stringify({ artifactKind: artifact.rows[0].kind }), now],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async getExecutionDetail(id: string): Promise<ExecutionDetail | null> {
    const execution = await this.pool.query(
      `select id, source, status, tracking_status, specification, error_code, started_at, completed_at, failed_at, analytics_retention_until
       from app_analytics.executions where id = $1`,
      [id],
    );
    if (!execution.rowCount) return null;
    const [steps, notifications, artifacts] = await Promise.all([
      this.pool.query(
        "select * from app_analytics.execution_steps where execution_id = $1 order by started_at, id",
        [id],
      ),
      this.pool.query(
        "select * from app_analytics.notification_outbox where execution_id = $1 order by created_at, id",
        [id],
      ),
      this.pool.query(
        `select artifact.*, rating.score as rating
         from app_analytics.execution_artifacts artifact
         left join app_analytics.result_ratings rating on rating.artifact_id = artifact.id
         where artifact.execution_id = $1 order by artifact.created_at, artifact.id`,
        [id],
      ),
    ]);
    const row = execution.rows[0];
    return {
      id: String(row.id),
      source: row.source,
      status: row.status,
      trackingStatus: row.tracking_status,
      specification: row.specification || {},
      errorCode: row.error_code || null,
      startedAt: new Date(row.started_at).toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      failedAt: row.failed_at ? new Date(row.failed_at).toISOString() : null,
      analyticsRetentionUntil: new Date(row.analytics_retention_until).toISOString(),
      steps: steps.rows.map(mapStep),
      artifacts: artifacts.rows.map(mapArtifact),
      notifications: notifications.rows.map((row) => ({
        id: String(row.id), executionId: String(row.execution_id), artifactId: String(row.artifact_id), eventKey: String(row.event_key), status: row.status,
        attempts: Number(row.attempts), nextAttemptAt: new Date(row.next_attempt_at).toISOString(), lastErrorCode: row.last_error_code || null,
        sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null, createdAt: new Date(row.created_at).toISOString(),
      })),
    };
  }

  async getDashboardOverview(limit: number) {
    const [summary, totals, ratings] = await Promise.all([
      this.pool.query(
        `select e.id, e.source, e.status, e.tracking_status, e.started_at, e.completed_at,
                extract(epoch from (e.completed_at - e.started_at)) * 1000 as duration_ms,
                count(distinct a.id)::int as artifact_count,
                count(distinct r.id)::int as rating_count,
                avg(r.score)::float as average_rating,
                count(r.id) filter (where r.score <= 2)::int as low_rating_count
         from app_analytics.executions e
         left join app_analytics.execution_artifacts a on a.execution_id = e.id
         left join app_analytics.result_ratings r on r.artifact_id = a.id
         group by e.id order by e.started_at desc limit $1`,
        [limit],
      ),
      this.pool.query(
        `select count(*)::int as total_executions,
                count(*) filter (where status = 'completed')::int as completed_executions,
                count(*) filter (where status = 'failed')::int as failed_executions,
                avg(extract(epoch from (completed_at - started_at)) * 1000) filter (where completed_at is not null)::float as average_duration_ms
         from app_analytics.executions`,
      ),
      this.pool.query(
        `select count(*)::int as total_ratings, avg(score)::float as average_rating,
                count(*) filter (where score <= 2)::int as low_rating_count
         from app_analytics.result_ratings`,
      ),
    ]);
    return {
      ...totals.rows[0],
      ...ratings.rows[0],
      executions: summary.rows.map((row) => ({
        id: String(row.id), source: row.source, status: row.status, trackingStatus: row.tracking_status,
        startedAt: new Date(row.started_at).toISOString(), completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
        durationMs: row.duration_ms == null ? null : Number(row.duration_ms), artifactCount: Number(row.artifact_count), ratingCount: Number(row.rating_count),
        averageRating: row.average_rating == null ? null : Number(row.average_rating), lowRatingCount: Number(row.low_rating_count),
      })),
      totalExecutions: Number(totals.rows[0].total_executions),
      completedExecutions: Number(totals.rows[0].completed_executions),
      failedExecutions: Number(totals.rows[0].failed_executions),
      averageDurationMs: totals.rows[0].average_duration_ms == null ? null : Number(totals.rows[0].average_duration_ms),
      totalRatings: Number(ratings.rows[0].total_ratings),
      averageRating: ratings.rows[0].average_rating == null ? null : Number(ratings.rows[0].average_rating),
      lowRatingCount: Number(ratings.rows[0].low_rating_count),
    };
  }

  async claimDueNotifications(now: string, limit: number) {
    return queryWithTransaction(this.pool, async (client) => {
      const result = await client.query(
        `with due as (
          select id from app_analytics.notification_outbox
          where status in ('pending', 'failed') and next_attempt_at <= $1
          order by next_attempt_at, created_at
          for update skip locked limit $2
        )
        update app_analytics.notification_outbox n
        set status = 'processing', attempts = n.attempts + 1, updated_at = now()
        from due, app_analytics.execution_artifacts artifact
        left join app_analytics.result_ratings rating on rating.artifact_id = artifact.id
        where n.id = due.id and n.artifact_id = artifact.id
        returning n.*, artifact.kind as artifact_kind, rating.score`,
        [now, limit],
      );
      return result.rows.map((row) => ({
        id: String(row.id), executionId: String(row.execution_id), artifactId: String(row.artifact_id), eventKey: String(row.event_key), status: row.status,
        attempts: Number(row.attempts), nextAttemptAt: new Date(row.next_attempt_at).toISOString(), lastErrorCode: row.last_error_code || null,
        sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null, createdAt: new Date(row.created_at).toISOString(),
        score: Number(row.score), artifactKind: row.artifact_kind,
      }));
    });
  }

  async markNotificationSent(id: string, sentAt: string): Promise<void> {
    await this.pool.query("update app_analytics.notification_outbox set status = 'sent', sent_at = $2, updated_at = now() where id = $1", [id, sentAt]);
  }

  async markNotificationFailed(id: string, errorCode: string, nextAttemptAt: string): Promise<void> {
    await this.pool.query("update app_analytics.notification_outbox set status = 'failed', last_error_code = $2, next_attempt_at = $3, updated_at = now() where id = $1", [id, errorCode, nextAttemptAt]);
  }

  async listExpiredArtifacts(now: string, limit: number) {
    const result = await this.pool.query(
      `select id, storage_bucket, storage_path, status, deletion_attempts
       from app_analytics.execution_artifacts
       where retention_until <= $1
         and storage_path is not null
         and status in ('available', 'storage_failed', 'deletion_failed')
       order by retention_until, id
       limit $2`,
      [now, limit],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      storageBucket: row.storage_bucket ? String(row.storage_bucket) : null,
      storagePath: String(row.storage_path),
      status: row.status,
      deletionAttempts: Number(row.deletion_attempts || 0),
    }));
  }

  async markArtifactDeleted(id: string, deletedAt: string): Promise<void> {
    await this.pool.query(
      `update app_analytics.execution_artifacts
       set status = 'deleted', deleted_at = $2, deletion_error_code = null, updated_at = now()
       where id = $1`,
      [id, deletedAt],
    );
  }

  async markArtifactDeletionFailed(id: string, errorCode: string): Promise<void> {
    await this.pool.query(
      `update app_analytics.execution_artifacts
       set status = 'deletion_failed', deletion_attempts = deletion_attempts + 1,
           deletion_error_code = $2, updated_at = now()
       where id = $1`,
      [id, errorCode],
    );
  }

  async purgeExpiredExecutions(now: string): Promise<number> {
    const result = await this.pool.query(
      `delete from app_analytics.executions
       where analytics_retention_until <= $1
         and not exists (
           select 1 from app_analytics.execution_artifacts artifact
           where artifact.execution_id = executions.id
             and artifact.storage_path is not null
             and artifact.status <> 'deleted'
         )`,
      [now],
    );
    return result.rowCount || 0;
  }
}

export async function queryWithTransaction<T>(pool: Pool, callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
