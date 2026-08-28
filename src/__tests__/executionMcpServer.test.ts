import { describe, expect, it } from "vitest";
import { createExecutionMcpHandler } from "../../scripts/execution-mcp-server";

const executionId = "26e61a4a-6c0d-4291-9ae9-bc91480cd105";

describe("servidor MCP de execuções", () => {
  it("negocia o protocolo e anuncia somente a ferramenta de consulta", async () => {
    const handle = createExecutionMcpHandler({
      baseUrl: "https://app.test",
      token: "secret",
      fetchImpl: fetch,
    });

    const initialized = await handle({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    });
    const listed = await handle({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    expect(initialized).toMatchObject({
      id: 1,
      result: { capabilities: { tools: {} } },
    });
    expect(listed).toMatchObject({
      id: 2,
      result: { tools: [{ name: "consultar_execucao" }] },
    });
  });

  it("encaminha o ID no caminho e o token exclusivamente no Bearer", async () => {
    let requestedUrl = "";
    let requestedAuthorization = "";
    const handle = createExecutionMcpHandler({
      baseUrl: "https://app.test/",
      token: "secret",
      fetchImpl: async (input, init) => {
        requestedUrl = String(input);
        requestedAuthorization =
          new Headers(init?.headers).get("authorization") || "";
        return new Response(
          JSON.stringify({ schemaVersion: 1, execution: { id: executionId } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    });

    const result = await handle({
      jsonrpc: "2.0",
      id: "request-1",
      method: "tools/call",
      params: {
        name: "consultar_execucao",
        arguments: { executionId },
      },
    });

    expect(requestedUrl).toBe(
      `https://app.test/api/integrations/execucoes/${executionId}`,
    );
    expect(requestedAuthorization).toBe("Bearer secret");
    expect(result).toMatchObject({
      id: "request-1",
      result: {
        structuredContent: { schemaVersion: 1 },
      },
    });
  });

  it("retorna erro de ferramenta sem vazar detalhes do transporte", async () => {
    const handle = createExecutionMcpHandler({
      baseUrl: "https://app.test",
      token: "secret",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "execution_not_found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    });

    const result = await handle({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "consultar_execucao",
        arguments: { executionId },
      },
    });
    const missingArgument = await handle({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "consultar_execucao", arguments: {} },
    });

    expect(result).toMatchObject({
      id: 3,
      result: {
        isError: true,
        structuredContent: { error: "execution_not_found" },
      },
    });
    expect(missingArgument).toMatchObject({
      id: 4,
      result: { isError: true },
    });
  });
});
