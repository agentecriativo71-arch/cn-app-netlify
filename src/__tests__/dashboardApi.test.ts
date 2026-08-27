import { describe, expect, it } from "vitest";
import {
  getDashboardSpecificationEntries,
  getDashboardStepDiagnostic,
  getDashboardGenerationSummary,
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
          focus: [
            {
              role: "single",
              status: "identified",
              targetDescription: "Saia visível",
              candidateCount: 1,
              confidence: 0.91,
              evidence: "Uma peça central ocupa o recorte.",
            },
          ],
          rendaDecisao: {
            value: true,
            confidence: 0.83,
            evidence: "Renda visível na barra.",
          },
          detalhesTecnicos: {
            barra: {
              value: "Midi",
              confidence: 0.8,
              evidence: "Barra visível.",
            },
          },
          providerExtras: [
            {
              path: "detalhesTecnicos.textura",
              value: "rendado",
              confidence: 0.72,
              evidence: "Textura visível no tecido.",
              sourceRole: "single",
            },
          ],
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
    expect(evaluation.focus[0]).toMatchObject({
      role: "single",
      status: "identified",
      confidence: 0.91,
      evidence: "Uma peça central ocupa o recorte.",
    });
    expect(evaluation.providerExtras[0]).toMatchObject({
      path: "detalhesTecnicos.textura",
      value: "rendado",
      confidence: 0.72,
    });
  });

  it("formata diagnóstico sanitizado de falha do provedor", () => {
    const diagnostic = getDashboardStepDiagnostic({
      id: "step-1",
      executionId: "execution-1",
      parentStepId: null,
      stage: "croqui_provider_request",
      attempt: 1,
      status: "error",
      provider: "fal",
      model: "seedream-v4",
      promptVersion: "croqui-fidelity-v3",
      seed: 260826,
      errorCode: "fal_reference_download_failed",
      metadata: {
        httpStatus: 422,
        providerField: "image_urls",
        retryable: false,
        referenceRole: "renda",
        referenceValue: "Renda Inteira",
        assetName: "renda-inteira.png",
        referenceSummary: [
          { role: "biotipo", selectedValue: "Ampulheta", assetName: "ampulheta.jpg" },
          { role: "renda", selectedValue: "Renda Inteira", assetName: "renda-inteira.png" },
        ],
        rawUrl: "https://private.test/?token=secret",
      },
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
      durationMs: 1000,
    });

    expect(diagnostic).toMatchObject({
      code: "fal_reference_download_failed",
      message: "Fal.ai não conseguiu baixar uma imagem de referência.",
      httpStatus: 422,
      providerField: "image_urls",
      retryable: false,
      referenceRole: "renda",
      referenceValue: "Renda Inteira",
      assetName: "renda-inteira.png",
      referenceSummary: [
        { role: "biotipo", assetName: "ampulheta.jpg" },
        { role: "renda", assetName: "renda-inteira.png" },
      ],
      detailed: true,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("private.test");
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
  });

  it("extrai resumo de candidatos da etapa geral de croqui", () => {
    expect(
      getDashboardGenerationSummary([
        {
          id: "step-1",
          executionId: "execution-1",
          parentStepId: null,
          stage: "croqui_generation",
          attempt: 1,
          status: "error",
          provider: "fal",
          model: "seedream-v4",
          promptVersion: "croqui-fidelity-v3",
          seed: null,
          errorCode: "candidate_generation_failed",
          metadata: {
            plannedCandidateCount: 4,
            generatedCandidateCount: 0,
            evaluatedCandidateCount: 0,
            eligibleCandidateCount: 0,
            failedCandidateCount: 1,
          },
          startedAt: "2026-01-01T00:00:00.000Z",
          finishedAt: "2026-01-01T00:00:01.000Z",
          durationMs: 1000,
        },
      ]),
    ).toEqual({
      plannedCandidateCount: 4,
      generatedCandidateCount: 0,
      evaluatedCandidateCount: 0,
      eligibleCandidateCount: 0,
      failedCandidateCount: 1,
      selectedSeed: null,
    });
  });
});
