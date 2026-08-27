import { describe, expect, it } from "vitest";
import {
  getDashboardSpecificationEntries,
  getDashboardVisionEvaluation,
  loadDashboardOverview,
  loadExecutionDetail,
} from "../server/dashboardApi";

describe("carregamento do dashboard", () => {
  it("distingue usuário não autorizado de falha do analytics", async () => {
    const result = await loadDashboardOverview({
      requireAdmin: async () => {
        throw new Error("Acesso administrativo negado.");
      },
      getOverview: async () => {
        throw new Error("não deve consultar analytics");
      },
    });

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("informa indisponibilidade quando o analytics falha", async () => {
    const result = await loadDashboardOverview({
      requireAdmin: async () => ({ id: "admin-1" }),
      getOverview: async () => {
        throw new Error("database unavailable");
      },
    });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("mantém banco vazio diferente de banco indisponível", async () => {
    const emptyOverview = {
      totalExecutions: 0,
      completedExecutions: 0,
      failedExecutions: 0,
      averageDurationMs: null,
      totalRatings: 0,
      averageRating: null,
      lowRatingCount: 0,
      executions: [],
    };
    const result = await loadDashboardOverview({
      requireAdmin: async () => ({ id: "admin-1" }),
      getOverview: async () => emptyOverview,
    });

    expect(result).toEqual({ status: "ready", data: emptyOverview });
  });

  it("não transforma falha do detalhe em erro de autenticação", async () => {
    const result = await loadExecutionDetail("execution-1", {
      requireAdmin: async () => ({ id: "admin-1" }),
      getDetail: async () => {
        throw new Error("database unavailable");
      },
      signArtifacts: async (detail) => detail,
    });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("formata no detalhe todos os campos selecionados pelo usuário", () => {
    expect(
      getDashboardSpecificationEntries({
        peca: "Calça",
        biotipo: "Ampulheta",
        possuiManga: false,
      }),
    ).toEqual([
      { key: "peca", label: "Peça", value: "Calça" },
      { key: "biotipo", label: "Biotipo", value: "Ampulheta" },
      { key: "possuiManga", label: "Possui manga", value: "Não" },
    ]);
  });

  it("expõe análise Vision detalhada e diferencia avaliação técnica da avaliação do cliente", () => {
    const evaluation = getDashboardVisionEvaluation({
      id: "artifact-1",
      executionId: "execution-1",
      stepId: "step-1",
      kind: "croqui",
      selected: true,
      status: "available",
      storageBucket: "execution-assets",
      storagePath: "generated/a.png",
      sourceUrl: null,
      mimeType: "image/png",
      retentionUntil: "2026-01-01T00:00:00.000Z",
      deletionAttempts: 0,
      deletionErrorCode: null,
      deletedAt: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      rating: 2,
      metadata: {
        technicalScore: 4.35,
        averageConfidence: 0.88,
        rank: 1,
        eligible: true,
        assessment: {
          schemaVersion: "croqui-vision-assessment-v1",
          criteria: {
            peca: {
              expected: "Saia",
              observed: "Saia",
              applicable: true,
              matched: true,
              confidence: 0.95,
              evidence: "Peça visível.",
            },
          },
        },
        visionAnalysis: {
          detalhesTecnicos: {
            barra: {
              value: "Midi",
              confidence: 0.8,
              evidence: "Barra visível.",
            },
          },
        },
      },
    });
    expect(evaluation).toMatchObject({
      technicalScore: 4.35,
      averageConfidence: 0.88,
      rank: 1,
      legacy: false,
      visionAnalysis: expect.any(Object),
    });
    expect(evaluation.criteria.peca).toMatchObject({
      observed: "Saia",
      confidence: 0.95,
      evidence: "Peça visível.",
    });
  });
});
