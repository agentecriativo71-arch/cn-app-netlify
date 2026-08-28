import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const TOOL_NAME = "consultar_execucao";
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
  };
};

export type ExecutionMcpConfig = {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
};

function response(
  id: JsonRpcResponse["id"],
  result: Record<string, unknown>,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(
  id: JsonRpcResponse["id"],
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function textResult(body: unknown, isError = false): Record<string, unknown> {
  const serialized = JSON.stringify(body, null, 2);
  return {
    ...(isError ? { isError: true } : {}),
    content: [{ type: "text", text: serialized }],
    structuredContent:
      body && typeof body === "object" ? body : { value: body },
  };
}

function toolDefinition(): Record<string, unknown> {
  return {
    name: TOOL_NAME,
    title: "Consultar execução operacional",
    description:
      "Consulta uma execução por ID, incluindo etapas, candidatos, análises Vision, artefatos, avaliações e notificações.",
    inputSchema: {
      type: "object",
      properties: {
        executionId: {
          type: "string",
          description: "UUID da execução exibido no dashboard operacional.",
        },
      },
      required: ["executionId"],
      additionalProperties: false,
    },
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    throw new Error("APP_BASE_URL precisa usar HTTPS fora do ambiente local.");
  }
  return url.toString().replace(/\/$/, "");
}

function executionIdFromArguments(
  params: Record<string, unknown> | undefined,
): string | null {
  const args = params?.arguments;
  if (!args || typeof args !== "object" || Array.isArray(args)) return null;
  const executionId = (args as Record<string, unknown>).executionId;
  return typeof executionId === "string" && executionId.trim()
    ? executionId.trim()
    : null;
}

export function createExecutionMcpHandler(config: ExecutionMcpConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const token = config.token.trim();
  if (!token) throw new Error("EXECUTION_INTEGRATION_TOKEN não configurado.");
  const fetchImpl = config.fetchImpl || fetch;

  return async (request: JsonRpcRequest): Promise<JsonRpcResponse | null> => {
    const id = request.id ?? null;

    if (request.method === "notifications/initialized") return null;
    if (request.method === "ping") return response(id, {});
    if (request.method === "initialize") {
      return response(id, {
        protocolVersion:
          typeof request.params?.protocolVersion === "string"
            ? request.params.protocolVersion
            : DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "cn-execucoes", version: "1.0.0" },
      });
    }
    if (request.method === "tools/list") {
      return response(id, { tools: [toolDefinition()] });
    }
    if (request.method !== "tools/call") {
      return errorResponse(
        id,
        -32601,
        `Método MCP não suportado: ${request.method}`,
      );
    }

    const toolName = request.params?.name;
    if (toolName !== TOOL_NAME) {
      return errorResponse(
        id,
        -32602,
        `Ferramenta MCP desconhecida: ${String(toolName)}`,
      );
    }
    const executionId = executionIdFromArguments(request.params);
    if (!executionId) {
      return response(
        id,
        textResult({ error: "executionId é obrigatório." }, true),
      );
    }

    const endpoint = `${baseUrl}/api/integrations/execucoes/${encodeURIComponent(executionId)}`;
    try {
      const httpResponse = await fetchImpl(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await httpResponse.json().catch(() => ({
        error: "resposta_invalida",
      }));
      return response(id, textResult(body, !httpResponse.ok));
    } catch {
      return response(
        id,
        textResult(
          { error: "Não foi possível consultar o endpoint de execuções." },
          true,
        ),
      );
    }
  };
}

async function runMcpServer(): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || "";
  const token = process.env.EXECUTION_INTEGRATION_TOKEN || "";
  const handle = createExecutionMcpHandler({ baseUrl, token });
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch {
      process.stdout.write(
        `${JSON.stringify(errorResponse(null, -32700, "JSON inválido."))}\n`,
      );
      continue;
    }
    try {
      const result = await handle(request);
      if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (error) {
      process.stderr.write(
        `[cn-execucoes] falha interna: ${error instanceof Error ? error.message : "erro desconhecido"}\n`,
      );
      if (request.id !== undefined)
        process.stdout.write(
          `${JSON.stringify(errorResponse(request.id ?? null, -32603, "Erro interno do servidor MCP."))}\n`,
        );
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMcpServer().catch((error) => {
    process.stderr.write(
      `[cn-execucoes] não foi possível iniciar: ${error instanceof Error ? error.message : "erro desconhecido"}\n`,
    );
    process.exitCode = 1;
  });
}
