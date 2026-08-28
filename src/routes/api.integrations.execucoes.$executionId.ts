import { createFileRoute } from "@tanstack/react-router";
import { operationalAnalytics } from "@/server/analyticsRuntime";
import { requireAdministrativeUser } from "@/server/dashboardAuth.server";
import { signDashboardArtifacts } from "@/server/dashboardApi";
import { handleExecutionIntegrationRequest } from "@/server/executionIntegration";

/**
 * Endpoint de consulta para integrações autorizadas. A consulta é somente
 * leitura e reutiliza a mesma sanitização de artefatos do dashboard.
 */
export const Route = createFileRoute(
  "/api/integrations/execucoes/$executionId",
)({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleExecutionIntegrationRequest({
          request,
          executionId: params.executionId,
          requireAdmin: requireAdministrativeUser,
          getDetail: (executionId) =>
            operationalAnalytics.getExecutionDetail(executionId),
          signArtifacts: signDashboardArtifacts,
        }),
    },
  },
});
