import OpenAI from "openai";
import * as fal from "@fal-ai/serverless-client";
import {
  REFERENCE_ANALYSIS_VERSION,
  REFERENCE_PROMPT_VERSION,
  CATALOG_ELEMENTS,
  buildVisionPromptForCompositeReference,
  buildVisionPromptForSingleReference,
  getReferenceAnalysisJsonSchema,
  normalizeReferenceAnalysis,
  referenceAnalysisSchema,
  validateReferenceAnalysisForMode,
  type ReferenceAnalysis,
  type ReferenceProviderExtra,
  type ReferencePiece,
  type ReferenceSourceRole,
} from "../lib/referenceUtils";

export const DEFAULT_OPENAI_VISION_MODEL = "gpt-5.4-mini";
export const FAL_VISION_ENDPOINT = "openrouter/router/vision";
export const DEFAULT_FAL_VISION_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_VISION_MAX_OUTPUT_TOKENS = 1800;

type ResponsesClient = {
  responses: {
    create: (input: Record<string, unknown>) => Promise<{ output_text?: string; output?: unknown }>;
  };
};

export type FalVisionClient = {
  subscribe: (endpointId: string, options: { input: Record<string, unknown> }) => Promise<unknown>;
};

export type VisionProvider = "fal" | "openai";
export type ReferenceVisionDiagnostic =
  | "response_shape"
  | "invalid_json"
  | "contract_mismatch"
  | "source_role_mismatch"
  | "legacy_focus_status"
  | "legacy_observed_shape"
  | "missing_evidence"
  | "invalid_catalog_value"
  | "invalid_details_shape"
  | "missing_required_field"
  | "invalid_mode"
  | "invalid_confidence";

export function resolveVisionModel(provider: VisionProvider, explicitModel?: string): string {
  if (explicitModel) return explicitModel;
  return process.env.VISION_MODEL || (provider === "fal" ? process.env.FAL_VISION_MODEL : process.env.OPENAI_VISION_MODEL) || (provider === "fal" ? DEFAULT_FAL_VISION_MODEL : DEFAULT_OPENAI_VISION_MODEL);
}

export function resolveVisionMaxOutputTokens(provider: VisionProvider, explicitValue?: number): number {
  if (explicitValue) return explicitValue;
  const configuredValue = process.env.VISION_MAX_OUTPUT_TOKENS || (provider === "fal" ? process.env.FAL_VISION_MAX_OUTPUT_TOKENS : process.env.OPENAI_VISION_MAX_OUTPUT_TOKENS);
  const parsedValue = Number(configuredValue || DEFAULT_VISION_MAX_OUTPUT_TOKENS);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_VISION_MAX_OUTPUT_TOKENS;
}

export type VisionAnalyzer = {
  analyze: (input: VisionInput) => Promise<ReferenceVisionResult>;
  modelName: string;
  providerName: VisionProvider;
  lastAttempts: number;
};

export type ReferenceVisionResult = {
  analysis: ReferenceAnalysis;
  providerExtras: ReferenceProviderExtra[];
};

export type VisionInput = {
  mode: "single" | "composite";
  occasion?: string;
  targetPiece?: ReferencePiece | null;
  imageDataUrls: string[];
};

export type VisionAnalyzerOptions = {
  client?: ResponsesClient | FalVisionClient;
  falClient?: FalVisionClient;
  provider?: VisionProvider;
  apiKey?: string;
  model?: string;
  maxAttempts?: number;
  retryDelayMs?: number;
  reasoningEffort?: string;
  detail?: "low" | "medium" | "high" | "auto";
  maxOutputTokens?: number;
  temperature?: number;
  reasoning?: boolean;
};

export class ReferenceVisionError extends Error {
  readonly code: "missing_api_key" | "invalid_response" | "provider_error" | "refusal" | "invalid_image";
  readonly retryable: boolean;
  readonly diagnosticCode?: ReferenceVisionDiagnostic;

  constructor(code: ReferenceVisionError["code"], message: string, options?: ErrorOptions, retryable = false, diagnosticCode?: ReferenceVisionDiagnostic) {
    super(message, options);
    this.name = "ReferenceVisionError";
    this.code = code;
    this.retryable = retryable;
    this.diagnosticCode = diagnosticCode;
  }
}

function createDefaultClient(apiKey: string): ResponsesClient {
  return new OpenAI({ apiKey }) as unknown as ResponsesClient;
}

function createDefaultFalClient(): FalVisionClient {
  return fal as unknown as FalVisionClient;
}

function isFalVisionClient(client: VisionAnalyzerOptions["client"]): client is FalVisionClient {
  return Boolean(client && "subscribe" in client);
}

function buildInputContent(input: VisionInput, prompt: string, detail: "low" | "medium" | "high" | "auto") {
  const roles = input.mode === "composite" ? ["top", "bottom"] : ["single"];
  return [
    { type: "input_text", text: prompt },
    ...input.imageDataUrls.flatMap((imageUrl, index) => [
      { type: "input_text", text: `IMAGE ${index + 1} ROLE: ${roles[index]}. The role is determined by the order and must not be changed.` },
      { type: "input_image", image_url: imageUrl, detail },
    ]),
  ];
}

function outputText(response: { output_text?: string; output?: unknown }): string {
  if (Array.isArray(response.output) && response.output.some((item) => {
    if (!item || typeof item !== "object") return false;
    const value = item as { type?: string; content?: unknown[]; refusal?: unknown };
    return value.type === "refusal" || typeof value.refusal === "string" || (Array.isArray(value.content) && value.content.some((content) => content && typeof content === "object" && (content as { type?: string }).type === "refusal"));
  })) {
    throw new ReferenceVisionError("refusal", "O GPT-5.4 mini recusou a análise da referência.");
  }
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text;
  throw new ReferenceVisionError("invalid_response", "A resposta do GPT-5.4 mini Vision não continha JSON estruturado.", undefined, true);
}

function textFromFalValue(value: unknown, depth = 0): string | null {
  if (depth > 4 || value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const parts = value.map((item) => textFromFalValue(item, depth + 1)).filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join("\n") : null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["output", "output_text", "text", "content", "message", "result", "data"]) {
    const text = textFromFalValue(record[key], depth + 1);
    if (text) return text;
  }
  return null;
}

function falOutputText(response: unknown): string {
  const value = textFromFalValue(response);
  if (value) return value;
  throw new ReferenceVisionError("invalid_response", "A resposta do Gemini Vision na Fal não continha texto analisável.", undefined, true, "response_shape");
}

function parseJsonText(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed].filter((candidate): candidate is string => Boolean(candidate));
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("A resposta não continha um objeto JSON.");
}

type CatalogField = "decote" | "manga" | "saia" | "renda";

function catalogComparisonKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[()\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function catalogValueAliases(field: CatalogField, value: string): string[] {
  const key = catalogComparisonKey(value);
  const labelsByField: Record<CatalogField, string[]> = {
    decote: ["decote", "neckline", "neck"],
    manga: ["manga", "sleeve"],
    saia: ["saia", "skirt"],
    renda: ["renda", "lace"],
  };
  const withoutFieldLabel = labelsByField[field].reduce((current, label) => current.replace(new RegExp(`^${label}\\s+`), ""), key);
  return [...new Set([key, withoutFieldLabel])];
}

function resolveCatalogValueAlias(field: CatalogField, value: string): string | null {
  const requestedAliases = new Set(catalogValueAliases(field, value));
  const candidates = CATALOG_ELEMENTS.filter((item) => item.categoria === field);
  for (const candidate of candidates) {
    const candidateAliases = [
      ...catalogValueAliases(field, candidate.nome),
      ...catalogValueAliases(field, candidate.nome_en),
      ...catalogValueAliases(field, candidate.nome.split("(")[0].trim()),
    ];
    if (candidateAliases.some((alias) => requestedAliases.has(alias))) return candidate.nome;
  }
  return null;
}

function normalizeProviderCatalogAliases(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const raw = { ...(input as Record<string, unknown>) };
  const fields: CatalogField[] = ["decote", "manga", "saia", "renda"];
  for (const field of fields) {
    const observation = raw[field];
    if (!observation || typeof observation !== "object") continue;
    const candidate = observation as Record<string, unknown>;
    if (typeof candidate.value !== "string") continue;
    const canonicalValue = resolveCatalogValueAlias(field, candidate.value);
    raw[field] = canonicalValue
      ? { ...candidate, value: canonicalValue }
      : { ...candidate, value: null, confidence: 0, evidence: null, sourceRole: null };
  }
  return raw;
}

const LEGACY_VISIBLE_EVIDENCE = "Evidência visual sinalizada pelo provedor; descrição textual não fornecida.";
const CANONICAL_DETAIL_KEYS = new Set(["corpete", "cintura", "caimento", "volume", "barra", "transparencia", "tecido", "costas", "fechamento"]);

function evidenceFromProvider(candidate: Record<string, unknown>): string | null {
  if (typeof candidate.evidence === "string" && candidate.evidence.trim()) return candidate.evidence;
  return candidate.visibleEvidence === true ? LEGACY_VISIBLE_EVIDENCE : null;
}

function normalizeLegacyObservedShape(raw: unknown, sourceRole: ReferenceSourceRole): unknown {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw !== "object") {
    if (typeof raw === "boolean") return { value: raw, confidence: 0, evidence: null, sourceRole };
    return raw;
  }
  const candidate = { ...(raw as Record<string, unknown>) };
  if ("value" in candidate || "visibleEvidence" in candidate) {
    return {
      ...candidate,
      confidence: typeof candidate.confidence === "number" ? candidate.confidence : 0,
      evidence: evidenceFromProvider(candidate),
      sourceRole: candidate.sourceRole === undefined ? sourceRole : candidate.sourceRole,
    };
  }
  return candidate;
}

function isProviderScalar(value: unknown): value is string | boolean | null {
  return typeof value === "string" || typeof value === "boolean" || value === null;
}

function collectProviderExtras(raw: unknown, path: string, fallbackRole: ReferenceSourceRole, extras: ReferenceProviderExtra[]): void {
  if (raw === null || raw === undefined) return;
  if (typeof raw !== "object") {
    if (isProviderScalar(raw)) extras.push({ path, value: raw, confidence: null, evidence: null, sourceRole: fallbackRole });
    return;
  }

  const candidate = raw as Record<string, unknown>;
  if ("value" in candidate) {
    const value = isProviderScalar(candidate.value) ? candidate.value : typeof candidate.value === "number" ? String(candidate.value) : null;
    const confidence = typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence) && candidate.confidence >= 0 && candidate.confidence <= 1
      ? candidate.confidence
      : null;
    const source = candidate.sourceRole === "single" || candidate.sourceRole === "top" || candidate.sourceRole === "bottom"
      ? candidate.sourceRole
      : fallbackRole;
    extras.push({
      path,
      value,
      confidence,
      evidence: evidenceFromProvider(candidate),
      sourceRole: source,
      ...(typeof candidate.visibleEvidence === "boolean" ? { visibleEvidence: candidate.visibleEvidence } : {}),
    });
    return;
  }

  for (const [key, value] of Object.entries(candidate)) collectProviderExtras(value, `${path}.${key}`, fallbackRole, extras);
}

function adaptLegacyProviderResponse(input: unknown, sourceRole: ReferenceSourceRole, mode: VisionInput["mode"]): { input: unknown; providerExtras: ReferenceProviderExtra[] } {
  if (!input || typeof input !== "object") return { input, providerExtras: [] };
  const raw = { ...(input as Record<string, unknown>) };
  const roles: ReferenceSourceRole[] = mode === "single" ? ["single"] : ["top", "bottom"];
  const focus = Array.isArray(raw.focus) ? raw.focus : [];
  const focusEntries = focus.length > 0 && focus.length < roles.length
    ? [...focus, ...Array.from({ length: roles.length - focus.length }, () => undefined)]
    : focus;
  raw.focus = focusEntries.map((value, index) => {
    const candidate = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
    const candidateCount = typeof candidate.candidateCount === "number" && candidate.candidateCount >= 0 ? Math.floor(candidate.candidateCount) : 0;
    const visibleEvidence = candidate.visibleEvidence === true || typeof candidate.evidence === "string";
    let status = candidate.status;
    if (status === "ready") {
      status = candidateCount > 1 ? "ambiguous" : candidateCount === 0 || !visibleEvidence ? "insufficient_visibility" : "identified";
    }
    return {
      role: candidate.role === undefined ? roles[index] : candidate.role,
      status,
      targetDescription: typeof candidate.targetDescription === "string" ? candidate.targetDescription : null,
      candidateCount,
      confidence: typeof candidate.confidence === "number" ? candidate.confidence : 0,
      evidence: evidenceFromProvider(candidate),
    };
  });

  for (const field of ["peca", "comprimento", "decote", "manga", "saia", "renda"] as const) {
    raw[field] = normalizeLegacyObservedShape(raw[field], sourceRole);
  }
  raw.possuiManga = normalizeLegacyObservedShape(raw.possuiManga, sourceRole);
  raw.rendaDecisao = normalizeLegacyObservedShape(raw.rendaDecisao, sourceRole);

  const providerExtras: ReferenceProviderExtra[] = [];
  const rawDetails = raw.detalhesTecnicos && typeof raw.detalhesTecnicos === "object" ? raw.detalhesTecnicos as Record<string, unknown> : {};
  const canonicalDetails: Record<string, unknown> = {};
  for (const key of CANONICAL_DETAIL_KEYS) {
    const value = rawDetails[key];
    if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
      canonicalDetails[key] = normalizeLegacyObservedShape(value, sourceRole);
    } else {
      canonicalDetails[key] = undefined;
      if (value !== undefined) collectProviderExtras(value, `detalhesTecnicos.${key}`, sourceRole, providerExtras);
    }
  }
  for (const [key, value] of Object.entries(rawDetails)) {
    if (!CANONICAL_DETAIL_KEYS.has(key)) collectProviderExtras(value, `detalhesTecnicos.${key}`, sourceRole, providerExtras);
  }
  raw.detalhesTecnicos = canonicalDetails;
  return { input: raw, providerExtras };
}

function enforceSourceRoleContract(analysis: ReferenceAnalysis, mode: VisionInput["mode"]): ReferenceAnalysis {
  const allowed = mode === "single" ? ["single"] : ["top", "bottom"];
  const observations = [analysis.peca, analysis.comprimento, analysis.decote, analysis.possuiManga, analysis.manga, analysis.saia, analysis.rendaDecisao, analysis.renda, ...Object.values(analysis.detalhesTecnicos)];
  const invalid = observations.map((observation) => observation.sourceRole).some((role) => role !== null && !allowed.includes(role));
  if (invalid) throw new ReferenceVisionError("invalid_response", "A resposta não preservou os papéis das imagens de referência.", undefined, false, "source_role_mismatch");
  return analysis;
}

function diagnosticCodeForNormalization(error: unknown): ReferenceVisionDiagnostic {
  const message = error instanceof Error ? error.message : "";
  if (/Foco fora/.test(message)) return "legacy_focus_status";
  if (/catálogo/.test(message)) return "invalid_catalog_value";
  if (/confian/i.test(message)) return "invalid_confidence";
  if (/Papel de imagem/.test(message) || /papéis das imagens/.test(message)) return "source_role_mismatch";
  if (/Modo/.test(message)) return "invalid_mode";
  if (/detalhesTecnicos/.test(message)) return "invalid_details_shape";
  if (/required|obrigat/i.test(message)) return "missing_required_field";
  return "contract_mismatch";
}

function parseResponse(raw: string, sourceRole: ReferenceSourceRole, mode: VisionInput["mode"], options: { normalizePartial?: boolean } = {}): ReferenceVisionResult {
  try {
    const parsed = parseJsonText(raw);
    if (parsed && typeof parsed === "object" && "schemaVersion" in parsed && parsed.schemaVersion !== REFERENCE_ANALYSIS_VERSION) {
      throw new Error("A versão do contrato de análise não é compatível.");
    }

    // OpenAI recebe Structured Outputs e continua exigindo resposta estrita.
    // Fal/OpenRouter fornece texto livre; neste caminho, normalização permite
    // campos ausentes como null, mas mantém rejeição do catálogo/roles.
    const adapted = options.normalizePartial ? adaptLegacyProviderResponse(parsed, sourceRole, mode) : { input: parsed, providerExtras: [] };
    const providerInput = options.normalizePartial ? normalizeProviderCatalogAliases(adapted.input) : adapted.input;
    const normalized = options.normalizePartial ? normalizeReferenceAnalysis(providerInput, sourceRole, mode) : referenceAnalysisSchema.parse(providerInput);
    const validated = validateReferenceAnalysisForMode(normalized, mode);
    const analysis = { ...enforceSourceRoleContract(validated, mode), providerExtras: adapted.providerExtras };
    return { analysis, providerExtras: adapted.providerExtras };
  } catch (error) {
    if (error instanceof ReferenceVisionError) throw error;
    const diagnosticCode = error instanceof SyntaxError ? "invalid_json" : diagnosticCodeForNormalization(error);
    throw new ReferenceVisionError("invalid_response", "A resposta do Vision não respeitou o contrato de análise.", { cause: error }, true, diagnosticCode);
  }
}

function isRetryableProviderError(error: unknown): boolean {
  const candidate = error as { status?: number; code?: string; name?: string };
  return Boolean(
    (typeof candidate.status === "number" && (candidate.status === 408 || candidate.status === 429 || candidate.status >= 500)) ||
    candidate.code === "ECONNRESET" || candidate.code === "ETIMEDOUT" || candidate.name === "APIConnectionError",
  );
}

export class OpenAIReferenceVisionAnalyzer {
  private readonly client: ResponsesClient;
  private readonly model: string;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly reasoningEffort: string;
  private readonly detail: "low" | "medium" | "high" | "auto";
  private readonly maxOutputTokens: number;
  private attemptsUsed = 0;
  readonly providerName = "openai" as const;

  constructor(options: VisionAnalyzerOptions = {}) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    const client = options.client && !isFalVisionClient(options.client) ? options.client : undefined;
    if (!client && !apiKey) {
      throw new ReferenceVisionError("missing_api_key", "OPENAI_API_KEY não configurada para o Vision.");
    }
    this.client = client || createDefaultClient(apiKey as string);
    this.model = resolveVisionModel("openai", options.model);
    this.maxAttempts = Math.max(1, Math.min(options.maxAttempts || 2, 2));
    this.retryDelayMs = Math.max(0, options.retryDelayMs || 0);
    // GPT-5.4 mini continua usando contrato estruturado; low/medium reduz latência.
    this.reasoningEffort = options.reasoningEffort || process.env.OPENAI_VISION_REASONING_EFFORT || "low";
    this.detail = options.detail || (process.env.OPENAI_VISION_DETAIL as VisionAnalyzerOptions["detail"] || "medium");
    this.maxOutputTokens = resolveVisionMaxOutputTokens("openai", options.maxOutputTokens);
  }

  get modelName(): string { return this.model; }
  get lastAttempts(): number { return this.attemptsUsed; }

  async analyze(input: VisionInput): Promise<ReferenceVisionResult> {
    this.attemptsUsed = 0;
    if (input.imageDataUrls.length !== (input.mode === "composite" ? 2 : 1)) {
      throw new ReferenceVisionError("invalid_response", "A quantidade de imagens não corresponde ao modo de referência.");
    }

    const prompt = input.mode === "composite"
      ? buildVisionPromptForCompositeReference(input.occasion, input.targetPiece)
      : buildVisionPromptForSingleReference(input.occasion, input.targetPiece);
    const sourceRole = input.mode === "composite" ? "top" : "single";
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      this.attemptsUsed = attempt;
      try {
        const response = await this.client.responses.create({
          model: this.model,
          store: false,
          reasoning: { effort: this.reasoningEffort },
          max_output_tokens: this.maxOutputTokens,
          input: [{ role: "user", content: buildInputContent(input, prompt, this.detail) }],
          text: {
            format: {
              type: "json_schema",
              name: REFERENCE_ANALYSIS_VERSION.replaceAll("-", "_"),
              strict: true,
              schema: getReferenceAnalysisJsonSchema(),
            },
          },
        });
        return parseResponse(outputText(response), sourceRole, input.mode);
      } catch (error) {
        const normalizedError = error instanceof ReferenceVisionError
          ? error
          : new ReferenceVisionError("provider_error", "Falha transitória ao chamar o GPT-5.4 mini Vision.", { cause: error }, isRetryableProviderError(error));
        lastError = normalizedError;
        if (attempt < this.maxAttempts && normalizedError.retryable && this.retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        }
        if (attempt >= this.maxAttempts || !normalizedError.retryable) break;
      }
    }

    if (lastError instanceof ReferenceVisionError) throw lastError;
    throw new ReferenceVisionError("provider_error", "O GPT-5.4 mini Vision falhou após duas tentativas.", { cause: lastError });
  }
}

export class FalGeminiReferenceVisionAnalyzer {
  private readonly client: FalVisionClient;
  private readonly model: string;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly maxOutputTokens: number;
  private readonly temperature: number;
  private readonly reasoning: boolean;
  private attemptsUsed = 0;
  readonly providerName = "fal" as const;

  constructor(options: VisionAnalyzerOptions = {}) {
    const apiKey = options.apiKey || process.env.FAL_KEY;
    if (!options.client && !options.falClient && !apiKey) {
      throw new ReferenceVisionError("missing_api_key", "FAL_KEY não configurada para o Gemini Vision.");
    }
    this.client = options.falClient || (isFalVisionClient(options.client) ? options.client : createDefaultFalClient());
    this.model = resolveVisionModel("fal", options.model);
    this.maxAttempts = Math.max(1, Math.min(options.maxAttempts || 2, 2));
    this.retryDelayMs = Math.max(0, options.retryDelayMs || 0);
    this.maxOutputTokens = resolveVisionMaxOutputTokens("fal", options.maxOutputTokens);
    this.temperature = options.temperature ?? Number(process.env.FAL_VISION_TEMPERATURE || 0);
    this.reasoning = options.reasoning ?? process.env.FAL_VISION_REASONING === "true";
  }

  get modelName(): string { return this.model; }
  get lastAttempts(): number { return this.attemptsUsed; }

  async analyze(input: VisionInput): Promise<ReferenceVisionResult> {
    this.attemptsUsed = 0;
    if (input.imageDataUrls.length !== (input.mode === "composite" ? 2 : 1)) {
      throw new ReferenceVisionError("invalid_response", "A quantidade de imagens não corresponde ao modo de referência.");
    }

    const prompt = input.mode === "composite"
      ? buildVisionPromptForCompositeReference(input.occasion, input.targetPiece)
      : buildVisionPromptForSingleReference(input.occasion, input.targetPiece);
    const sourceRole = input.mode === "composite" ? "top" : "single";
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      this.attemptsUsed = attempt;
      try {
        const response = await this.client.subscribe(FAL_VISION_ENDPOINT, {
          input: {
            image_urls: input.imageDataUrls,
            prompt,
            system_prompt: "Analise somente as imagens recebidas. Retorne somente um objeto JSON válido, sem markdown, comentários ou texto adicional.",
            model: this.model,
            temperature: this.temperature,
            reasoning: this.reasoning,
            max_tokens: this.maxOutputTokens,
          },
        });
        return parseResponse(falOutputText(response), sourceRole, input.mode, { normalizePartial: true });
      } catch (error) {
        const normalizedError = error instanceof ReferenceVisionError
          ? error
          : new ReferenceVisionError("provider_error", "Falha transitória ao chamar o Gemini Vision na Fal.", { cause: error }, isRetryableProviderError(error));
        lastError = normalizedError;
        if (attempt < this.maxAttempts && normalizedError.retryable && this.retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        }
        if (attempt >= this.maxAttempts || !normalizedError.retryable) break;
      }
    }

    if (lastError instanceof ReferenceVisionError) throw lastError;
    throw new ReferenceVisionError("provider_error", "O Gemini Vision na Fal falhou após duas tentativas.", { cause: lastError });
  }
}

export function createReferenceVisionAnalyzer(options: VisionAnalyzerOptions = {}): VisionAnalyzer {
  const provider = options.provider || process.env.VISION_PROVIDER || "fal";
  if (provider === "openai") return new OpenAIReferenceVisionAnalyzer(options);
  if (provider === "fal") return new FalGeminiReferenceVisionAnalyzer(options);
  throw new ReferenceVisionError("provider_error", `VISION_PROVIDER inválido: ${provider}.`);
}
