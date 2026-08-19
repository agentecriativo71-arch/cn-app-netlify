import OpenAI from "openai";
import * as fal from "@fal-ai/serverless-client";
import {
  REFERENCE_ANALYSIS_VERSION,
  buildVisionPromptForCompositeReference,
  buildVisionPromptForSingleReference,
  getReferenceAnalysisJsonSchema,
  normalizeReferenceAnalysis,
  referenceAnalysisSchema,
  validateReferenceAnalysisForMode,
  type ReferenceAnalysis,
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
export type ReferenceVisionDiagnostic = "response_shape" | "invalid_json" | "contract_mismatch" | "source_role_mismatch";

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
  analyze: (input: VisionInput) => Promise<ReferenceAnalysis>;
  modelName: string;
  providerName: VisionProvider;
  lastAttempts: number;
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

function enforceSourceRoleContract(analysis: ReferenceAnalysis, mode: VisionInput["mode"]): ReferenceAnalysis {
  const allowed = mode === "single" ? ["single"] : ["top", "bottom"];
  const observations = [analysis.peca, analysis.comprimento, analysis.decote, analysis.possuiManga, analysis.manga, analysis.saia, analysis.rendaDecisao, analysis.renda, ...Object.values(analysis.detalhesTecnicos)];
  const invalid = observations.map((observation) => observation.sourceRole).some((role) => role !== null && !allowed.includes(role));
  if (invalid) throw new ReferenceVisionError("invalid_response", "A resposta não preservou os papéis das imagens de referência.", undefined, false, "source_role_mismatch");
  return analysis;
}

function parseResponse(raw: string, sourceRole: ReferenceSourceRole, mode: VisionInput["mode"], options: { normalizePartial?: boolean } = {}): ReferenceAnalysis {
  try {
    const parsed = parseJsonText(raw);
    if (parsed && typeof parsed === "object" && "schemaVersion" in parsed && parsed.schemaVersion !== REFERENCE_ANALYSIS_VERSION) {
      throw new Error("A versão do contrato de análise não é compatível.");
    }

    // OpenAI recebe Structured Outputs e continua exigindo resposta estrita.
    // Fal/OpenRouter fornece texto livre; neste caminho, normalização permite
    // campos ausentes como null, mas mantém rejeição do catálogo/roles.
    const normalized = options.normalizePartial ? normalizeReferenceAnalysis(parsed, sourceRole, mode) : referenceAnalysisSchema.parse(parsed);
    const validated = validateReferenceAnalysisForMode(normalized, mode);
    return enforceSourceRoleContract(validated, mode);
  } catch (error) {
    if (error instanceof ReferenceVisionError) throw error;
    const diagnosticCode = error instanceof SyntaxError ? "invalid_json" : "contract_mismatch";
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

  async analyze(input: VisionInput): Promise<ReferenceAnalysis> {
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

  async analyze(input: VisionInput): Promise<ReferenceAnalysis> {
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
