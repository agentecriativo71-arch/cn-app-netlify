import { describe, expect, it } from "vitest";
import {
  handleExecutionIntegrationRequest,
  isExecutionIntegrationRequestAuthorized,
} from "../server/executionIntegration";

const environment = {
  EXECUTION_INTEGRATION_TOKEN: "integration-secret-123",
};

describe("integração de consulta de execuções", () => {
  it("aceita somente Bearer token configurado", () => {
    expect(
      isExecutionIntegrationRequestAuthorized(
        new Request("https://app.test/api", {
          headers: { Authorization: "Bearer integration-secret-123" },
        }),
        environment,
      ),
    ).toBe(true);
    expect(
      isExecutionIntegrationRequestAuthorized(
        new Request("https://app.test/api", {
          headers: { Authorization: "Bearer wrong-token" },
        }),
        environment,
      ),
    ).toBe(false);
    expect(
      isExecutionIntegrationRequestAuthorized(
        new Request("https://app.test/api"),
        environment,
      ),
    ).toBe(false);
  });

  it("retorna detalhe sanitizado e nunca usa URL pública para cache", async () => {
    const response = await handleExecutionIntegrationRequest({
      request: new Request("https://app.test/api", {
        headers: { Authorization: "Bearer integration-secret-123" },
      }),
      executionId: "26e61a4a-6c0d-4291-9ae9-bc91480cd105",
      environment,
      requireAdmin: async () => {
        throw new Error("não deve usar sessão administrativa");
      },
      getDetail: async () => ({
        id: "26e61a4a-6c0d-4291-9ae9-bc91480cd105",
        source: "manual",
        status: "completed",
        trackingStatus: "healthy",
        specification: { peca: "Vestido" },
        startedAt: "2026-08-28T00:00:00.000Z",
        completedAt: "2026-08-28T00:00:01.000Z",
        failedAt: null,
        errorCode: null,
        analyticsRetentionUntil: "2027-08-28T00:00:00.000Z",
        steps: [],
        artifacts: [],
        notifications: [],
      }),
      signArtifacts: async (detail) => ({
        ...detail,
        artifacts: detail.artifacts.map((artifact) => ({
          ...artifact,
          sourceUrl: null,
          signedUrl: "https://signed.test/short-lived",
        })),
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      schemaVersion: 1,
      execution: { id: "26e61a4a-6c0d-4291-9ae9-bc91480cd105" },
    });
  });

  it("diferencia não autenticado, não encontrado e analytics indisponível", async () => {
    const base = {
      request: new Request("https://app.test/api"),
      executionId: "26e61a4a-6c0d-4291-9ae9-bc91480cd105",
      environment,
      requireAdmin: async () => {
        throw new Error("não autorizado");
      },
      signArtifacts: async (detail: any) => detail,
    };
    const unauthorized = await handleExecutionIntegrationRequest({
      ...base,
      getDetail: async () => null,
    });
    expect(unauthorized.status).toBe(401);

    const notFound = await handleExecutionIntegrationRequest({
      ...base,
      request: new Request("https://app.test/api", {
        headers: { Authorization: "Bearer integration-secret-123" },
      }),
      getDetail: async () => null,
    });
    expect(notFound.status).toBe(404);

    const unavailable = await handleExecutionIntegrationRequest({
      ...base,
      request: new Request("https://app.test/api", {
        headers: { Authorization: "Bearer integration-secret-123" },
      }),
      getDetail: async () => {
        throw new Error("analytics unavailable");
      },
    });
    expect(unavailable.status).toBe(503);
  });

  it("aceita sessão administrativa como alternativa ao token externo", async () => {
    let adminChecks = 0;
    const response = await handleExecutionIntegrationRequest({
      request: new Request("https://app.test/api"),
      executionId: "26e61a4a-6c0d-4291-9ae9-bc91480cd105",
      environment: { EXECUTION_INTEGRATION_TOKEN: "" },
      requireAdmin: async () => {
        adminChecks += 1;
      },
      getDetail: async () => null,
      signArtifacts: async (detail) => detail,
    });

    expect(adminChecks).toBe(1);
    expect(response.status).toBe(404);
  });

  it("não aceita token na query string e valida o formato do identificador", async () => {
    const unauthorized = await handleExecutionIntegrationRequest({
      request: new Request("https://app.test/api?token=integration-secret-123"),
      executionId: "26e61a4a-6c0d-4291-9ae9-bc91480cd105",
      environment,
      requireAdmin: async () => {
        throw new Error("não autorizado");
      },
      getDetail: async () => null,
      signArtifacts: async (detail) => detail,
    });
    expect(unauthorized.status).toBe(401);

    let queried = false;
    const invalidId = await handleExecutionIntegrationRequest({
      request: new Request("https://app.test/api", {
        headers: { Authorization: "Bearer integration-secret-123" },
      }),
      executionId: "not-a-uuid",
      environment,
      requireAdmin: async () => {
        throw new Error("não deve usar sessão administrativa");
      },
      getDetail: async () => {
        queried = true;
        return null;
      },
      signArtifacts: async (detail) => detail,
    });

    expect(invalidId.status).toBe(400);
    expect(queried).toBe(false);
  });
});
