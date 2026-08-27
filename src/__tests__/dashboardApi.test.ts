import { describe, expect, it } from "vitest";
import { getDashboardSpecificationEntries, loadDashboardOverview, loadExecutionDetail } from "../server/dashboardApi";

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
    expect(getDashboardSpecificationEntries({
      peca: "Calça",
      biotipo: "Ampulheta",
      possuiManga: false,
    })).toEqual([
      { key: "peca", label: "Peça", value: "Calça" },
      { key: "biotipo", label: "Biotipo", value: "Ampulheta" },
      { key: "possuiManga", label: "Possui manga", value: "Não" },
    ]);
  });
});
