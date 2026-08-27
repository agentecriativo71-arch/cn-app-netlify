export type FalGenerationFailureContext = {
  model: string;
  candidateIndex: number | null;
  providerAttempt: number;
  referenceRole?: string;
  referenceValue?: string;
  assetName?: string;
  referenceSummary?: Array<{
    role: string;
    selectedValue: string | null;
    assetName: string | null;
  }>;
};

export type FalGenerationFailureDiagnostic = FalGenerationFailureContext & {
  errorCode:
    | "fal_reference_download_failed"
    | "fal_input_validation_failed"
    | "fal_authentication_failed"
    | "fal_rate_limited"
    | "fal_provider_unavailable"
    | "fal_network_error"
    | "fal_generation_failed";
  provider: "fal";
  httpStatus: number | null;
  providerField: string | null;
  category: string;
  retryable: boolean;
};

function statusOf(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    Number.isInteger((error as { status?: unknown }).status)
  ) {
    return Number((error as { status: number }).status);
  }
  return null;
}

type FalFieldError = {
  loc?: unknown;
  msg?: unknown;
  type?: unknown;
};

function fieldErrorsOf(error: unknown): FalFieldError[] {
  if (!error || typeof error !== "object") return [];
  const fieldErrors = (error as { fieldErrors?: unknown }).fieldErrors;
  if (Array.isArray(fieldErrors)) return fieldErrors as FalFieldError[];
  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== "object") return [];
  const detail = (body as { detail?: unknown }).detail;
  return Array.isArray(detail) ? (detail as FalFieldError[]) : [];
}

function providerFieldOf(error: unknown): string | null {
  const field = fieldErrorsOf(error)
    .map((item) => (Array.isArray(item.loc) ? item.loc.at(-1) : null))
    .find((value): value is string => typeof value === "string");
  return field || null;
}

function isDownloadFailure(
  error: unknown,
  providerField: string | null,
): boolean {
  if (providerField !== "image_urls") return false;
  return fieldErrorsOf(error).some((item) => {
    const type = typeof item.type === "string" ? item.type.toLowerCase() : "";
    const message = typeof item.msg === "string" ? item.msg.toLowerCase() : "";
    return (
      type.includes("download") ||
      message.includes("failed to download") ||
      message.includes("could not download")
    );
  });
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND"].includes(
    typeof code === "string" ? code : "",
  );
}

export function classifyFalGenerationError(
  error: unknown,
  context: FalGenerationFailureContext,
): FalGenerationFailureDiagnostic {
  const httpStatus = statusOf(error);
  const providerField = providerFieldOf(error);
  let errorCode: FalGenerationFailureDiagnostic["errorCode"] =
    "fal_generation_failed";
  let category = "provider_unknown";
  let retryable = false;

  if (isDownloadFailure(error, providerField)) {
    errorCode = "fal_reference_download_failed";
    category = "reference_download_failed";
  } else if (httpStatus === 422) {
    errorCode = "fal_input_validation_failed";
    category = "input_validation_failed";
  } else if (httpStatus === 401 || httpStatus === 403) {
    errorCode = "fal_authentication_failed";
    category = "authentication_failed";
  } else if (httpStatus === 429) {
    errorCode = "fal_rate_limited";
    category = "rate_limited";
    retryable = true;
  } else if (httpStatus !== null && httpStatus >= 500) {
    errorCode = "fal_provider_unavailable";
    category = "provider_unavailable";
    retryable = true;
  } else if (isNetworkFailure(error)) {
    errorCode = "fal_network_error";
    category = "network_error";
    retryable = true;
  } else if (httpStatus === null) {
    // O SDK também pode propagar Error genérico em falhas de transporte ou
    // interrupções do worker, sem expor status HTTP.
    errorCode = "fal_network_error";
    category = "unknown_transport_error";
    retryable = true;
  }

  return {
    ...context,
    errorCode,
    provider: "fal",
    httpStatus,
    providerField,
    category,
    retryable,
  };
}
