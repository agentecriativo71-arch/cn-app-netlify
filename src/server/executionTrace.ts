import { createHash } from "node:crypto";

/**
 * Referência que foi enviada a um provedor externo. O valor completo nunca é
 * retornado por este módulo: o dashboard precisa explicar a chamada sem
 * transformar o analytics em um depósito de URLs temporárias ou data URLs.
 */
export type ProviderReferenceInput = {
  role: string;
  source:
    | "catalog"
    | "customer_crop"
    | "customer_photo"
    | "generated_artifact"
    | "mannequin"
    | "fabric"
    | "unknown";
  selectedValue?: string | null;
  assetName?: string | null;
  value: string;
};

export type SanitizedProviderReference = {
  position: number;
  role: string;
  source: ProviderReferenceInput["source"];
  selectedValue: string | null;
  assetName: string | null;
  transport: "https_url" | "data_url" | "other_url" | "unknown";
  providerHost: string | null;
  providerPath: string | null;
  referenceDigest: string | null;
};

export type ProviderCallTrace = {
  schemaVersion: "provider-call-v1";
  phase: string;
  operation: string;
  referenceCount: number;
  referenceManifest: SanitizedProviderReference[];
  templateVersion: string | null;
  templateDigest: string | null;
  templateChars: number | null;
  requestSummary: Record<string, string | number | boolean | null>;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function boundedString(value: string | null | undefined, max = 200): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.slice(0, max);
}

function referenceLocation(value: string): Pick<SanitizedProviderReference, "transport" | "providerHost" | "providerPath"> {
  if (value.startsWith("data:")) {
    return { transport: "data_url", providerHost: null, providerPath: null };
  }

  try {
    const parsed = new URL(value);
    return {
      transport:
        parsed.protocol === "https:"
          ? "https_url"
          : parsed.protocol.endsWith(":")
            ? "other_url"
            : "unknown",
      providerHost: boundedString(parsed.hostname, 120),
      // O caminho não contém query nem fragmento. Para recortes privados ele
      // continua omitido abaixo; o digest ainda permite correlacionar chamadas.
      providerPath: boundedString(parsed.pathname, 300),
    };
  } catch {
    return { transport: "unknown", providerHost: null, providerPath: null };
  }
}

export function sanitizeProviderReferences(
  references: ProviderReferenceInput[],
): SanitizedProviderReference[] {
  return references.slice(0, 20).map((reference, index) => {
    const location = referenceLocation(reference.value);
    const isPrivateInput =
      reference.source === "customer_crop" || reference.source === "customer_photo";
    return {
      position: index + 1,
      role: boundedString(reference.role, 80) || "unknown",
      source: reference.source,
      selectedValue: boundedString(reference.selectedValue, 200),
      assetName: boundedString(reference.assetName, 200),
      transport: location.transport,
      providerHost: location.providerHost,
      providerPath: isPrivateInput ? null : location.providerPath,
      referenceDigest:
        typeof reference.value === "string" && reference.value.length > 0
          ? digest(reference.value)
          : null,
    };
  });
}

export function createProviderCallTrace(input: {
  phase: string;
  operation: string;
  references?: ProviderReferenceInput[];
  templateVersion?: string | null;
  template?: string | null;
  requestSummary?: Record<string, string | number | boolean | null>;
}): ProviderCallTrace {
  const template = typeof input.template === "string" ? input.template : null;
  return {
    schemaVersion: "provider-call-v1",
    phase: input.phase,
    operation: input.operation,
    referenceCount: input.references?.length || 0,
    referenceManifest: sanitizeProviderReferences(input.references || []),
    templateVersion: input.templateVersion || null,
    templateDigest: template ? digest(template) : null,
    templateChars: template ? template.length : null,
    requestSummary: input.requestSummary || {},
  };
}

export function providerResponseSummary(input: {
  outputImageCount?: number | null;
  outputText?: boolean | null;
  resultCount?: number | null;
  providerJobId?: string | null;
  retryCount?: number | null;
}): Record<string, string | number | boolean | null> {
  return {
    outputImageCount: input.outputImageCount ?? null,
    outputText: input.outputText ?? null,
    resultCount: input.resultCount ?? null,
    providerJobId: boundedString(input.providerJobId, 200),
    retryCount: input.retryCount ?? null,
  };
}
