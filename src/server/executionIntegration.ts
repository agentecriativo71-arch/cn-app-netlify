import { createHash, timingSafeEqual } from "node:crypto";
import type { ExecutionDetail } from "./operationalAnalytics";

const EXECUTION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ExecutionIntegrationEnvironment = {
  EXECUTION_INTEGRATION_TOKEN?: string;
};

export type ExecutionIntegrationDependencies = {
  request: Request;
  executionId: string;
  environment?: ExecutionIntegrationEnvironment;
  requireAdmin: () => Promise<unknown>;
  getDetail: (executionId: string) => Promise<ExecutionDetail | null>;
  signArtifacts: (detail: ExecutionDetail) => Promise<unknown>;
};

export function resolveExecutionIntegrationToken(
  environment: ExecutionIntegrationEnvironment = process.env,
): string {
  return environment.EXECUTION_INTEGRATION_TOKEN?.trim() || "";
}

function safeTokenEquals(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function isExecutionIntegrationRequestAuthorized(
  request: Pick<Request, "headers">,
  environment: ExecutionIntegrationEnvironment = process.env,
): boolean {
  const expectedToken = resolveExecutionIntegrationToken(environment);
  if (!expectedToken) return false;
  const authorization = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return Boolean(match?.[1] && safeTokenEquals(match[1], expectedToken));
}

function responseBody(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Vary: "Authorization, Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isExecutionId(value: string): boolean {
  return EXECUTION_ID_PATTERN.test(value);
}

/**
 * Serve consulta somente leitura para conectores externos autorizados.
 * O mesmo caminho aceita sessão administrativa do dashboard, mas nunca
 * devolve URL de origem do provedor ou credencial de Storage.
 */
export async function handleExecutionIntegrationRequest(
  input: ExecutionIntegrationDependencies,
): Promise<Response> {
  let authorized = isExecutionIntegrationRequestAuthorized(
    input.request,
    input.environment,
  );
  if (!authorized) {
    try {
      await input.requireAdmin();
      authorized = true;
    } catch {
      authorized = false;
    }
  }
  if (!authorized) return responseBody({ error: "unauthorized" }, 401);

  if (!isExecutionId(input.executionId)) {
    return responseBody({ error: "invalid_execution_id" }, 400);
  }

  try {
    const detail = await input.getDetail(input.executionId);
    if (!detail) return responseBody({ error: "execution_not_found" }, 404);
    const signedDetail = await input.signArtifacts(detail);
    return responseBody(
      {
        schemaVersion: 1,
        execution: signedDetail,
      },
      200,
    );
  } catch {
    return responseBody({ error: "analytics_unavailable" }, 503);
  }
}
