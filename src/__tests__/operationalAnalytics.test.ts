import { describe, expect, it } from "vitest";
import {
  FailOpenOperationalAnalytics,
  InMemoryAnalyticsRepository,
  OperationalAnalytics,
} from "../server/operationalAnalytics";

describe("rastreabilidade operacional", () => {
  it("registra uma execução consultável sem persistir campos sensíveis", async () => {
    const analytics = new OperationalAnalytics(new InMemoryAnalyticsRepository());

    const execution = await analytics.startExecution({
      source: "manual",
      specification: {
        ocasiao: "Festa",
        peca: "Vestido",
        telefone: "5585999999999",
        prompt: "conteúdo privado do prompt",
        referenceImageUrls: ["data:image/jpeg;base64,privado"],
      },
    });
    const step = await execution.startStep({ stage: "croqui_generation" });
    await step.succeed({ provider: "fal", model: "seedream-v4" });
    await execution.complete();

    const detail = await analytics.getExecutionDetail(execution.executionId);

    expect(detail).toMatchObject({
      id: execution.executionId,
      source: "manual",
      status: "completed",
      specification: { ocasiao: "Festa", peca: "Vestido" },
      steps: [
        expect.objectContaining({
          stage: "croqui_generation",
          status: "success",
          provider: "fal",
          model: "seedream-v4",
        }),
      ],
    });
    expect(JSON.stringify(detail)).not.toContain("5585999999999");
    expect(JSON.stringify(detail)).not.toContain("conteúdo privado");
    expect(JSON.stringify(detail)).not.toContain("data:image");
  });

  it("mantém voto editável e cria somente um alerta para resultado abaixo de três estrelas", async () => {
    const repository = new InMemoryAnalyticsRepository();
    const analytics = new OperationalAnalytics(repository);
    const execution = await analytics.startExecution({ source: "manual" });
    const artifact = await execution.recordArtifact({
      kind: "croqui",
      selected: true,
      sourceUrl: "https://fal.test/croqui.png",
      retentionDays: 90,
    });

    await analytics.rateArtifact({ artifactId: artifact.artifactId, score: 2 });
    await analytics.rateArtifact({ artifactId: artifact.artifactId, score: 1 });

    const detail = await analytics.getExecutionDetail(execution.executionId);
    expect(detail?.artifacts[0]).toMatchObject({
      id: artifact.artifactId,
      kind: "croqui",
      rating: 1,
    });
    expect(repository.listNotifications()).toHaveLength(1);
    expect(repository.listNotifications()[0]).toMatchObject({
      eventKey: `low-rating:${artifact.artifactId}`,
      status: "pending",
    });
  });

  it("permite marcar como selecionado um candidato já persistido sem perder o artefato", async () => {
    const analytics = new OperationalAnalytics(new InMemoryAnalyticsRepository());
    const execution = await analytics.startExecution({
      source: "manual",
      specification: { peca: "Calça", biotipo: "Ampulheta", decote: "V (V-Neck)" },
    });
    const candidate = await execution.recordArtifact({
      kind: "croqui_candidate",
      storageBucket: "execution-assets",
      storagePath: "generated/execution/croqui_candidate-1.png",
      mimeType: "image/png",
      metadata: { seed: 260826, score: 5, rejected: false, rejectionReasons: [] },
      retentionDays: 90,
    });

    await execution.updateArtifact(candidate.artifactId, { kind: "croqui", selected: true });

    const detail = await analytics.getExecutionDetail(execution.executionId);
    expect(detail?.specification).toMatchObject({ peca: "Calça", biotipo: "Ampulheta" });
    expect(detail?.artifacts[0]).toMatchObject({
      id: candidate.artifactId,
      kind: "croqui",
      selected: true,
      storagePath: "generated/execution/croqui_candidate-1.png",
    });
  });

  it("degrada o rastreio sem bloquear a operação principal quando o banco está indisponível", async () => {
    const unavailable = new OperationalAnalytics({
      createExecution: async () => { throw new Error("database unavailable"); },
      updateExecution: async () => { throw new Error("database unavailable"); },
      createStep: async () => { throw new Error("database unavailable"); },
      updateStep: async () => { throw new Error("database unavailable"); },
      createArtifact: async () => { throw new Error("database unavailable"); },
      updateArtifact: async () => { throw new Error("database unavailable"); },
      rateArtifactAndQueue: async () => { throw new Error("database unavailable"); },
      getExecutionDetail: async () => { throw new Error("database unavailable"); },
      getDashboardOverview: async () => { throw new Error("database unavailable"); },
      claimDueNotifications: async () => { throw new Error("database unavailable"); },
      markNotificationSent: async () => { throw new Error("database unavailable"); },
      markNotificationFailed: async () => { throw new Error("database unavailable"); },
      listExpiredArtifacts: async () => { throw new Error("database unavailable"); },
      markArtifactDeleted: async () => { throw new Error("database unavailable"); },
      markArtifactDeletionFailed: async () => { throw new Error("database unavailable"); },
      purgeExpiredExecutions: async () => { throw new Error("database unavailable"); },
    });
    const analytics = new FailOpenOperationalAnalytics(unavailable);

    const result = await analytics.startExecution({ source: "manual" });

    expect(result).toEqual({ execution: null, trackingStatus: "degraded" });
  });
});
