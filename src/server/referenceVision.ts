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

type ResponsesClient = {
  responses: {
    create: (input: Record<string, unknown>) => Promise<{ output_text?: string; output?: unknown }>;
  };
};

export type FalVisionClient = {
  subscribe: (endpointId: string, options: { input: Record<string, unknown> }) => Promise<unknown>;
};

export type VisionProvider = "fal" | "openai";

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

  constructor(code: ReferenceVisionError["code"], message: string, options?: ErrorOptions, retryable = false) {
    super(message, options);
    this.name = "ReferenceVisionError";
    this.code = code;
    this.retryable = retryable;
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

function falOutputText(response: unknown): string {
  const candidate = response && typeof response === "object" ? response as { output?: unknown; data?: unknown } : {};
  const data = candidate.data && typeof candidate.data === "object" ? candidate.data as { output?: unknown } : {};
  const value = typeof candidate.output === "string" ? candidate.output : typeof data.output === "string" ? data.output : null;
  if (value && value.trim()) return value;
  throw new ReferenceVisionError("invalid_response", "A resposta do Gemini Vision na Fal não continha JSON estruturado.", undefined, true);
}

function parseJsonText(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function enforceSourceRoleContract(analysis: ReferenceAnalysis, mode: VisionInput["mode"]): ReferenceAnalysis {
  const allowed = mode === "single" ? ["single"] : ["top", "bottom"];
  const observations = [analysis.peca, analysis.comprimento, analysis.decote, analysis.possuiManga, analysis.manga, analysis.saia, analysis.rendaDecisao, analysis.renda, ...Object.values(analysis.detalhesTecnicos)];
  const invalid = observations.map((observation) => observation.sourceRole).some((role) => role !== null && !allowed.includes(role));
  if (invalid) throw new ReferenceVisionError("invalid_response", "A resposta não preservou os papéis das imagens de referência.");
  return analysis;
}

function parseResponse(raw: string, sourceRole: ReferenceSourceRole, mode: VisionInput["mode"]): ReferenceAnalysis {
  try {
    const parsed = parseJsonText(raw);
    // A resposta bruta também precisa passar pelo schema estrito. Sem esta etapa,
    // a normalização poderia descartar campos extras e mascarar uma resposta
    // incompatível antes do retry controlado.
    const strictParsed = referenceAnalysisSchema.parse(parsed);
    return enforceSourceRoleContract(validateReferenceAnalysisForMode(normalizeReferenceAnalysis(strictParsed, sourceRole, mode), mode), mode);
  } catch (error) {
    if (error instanceof ReferenceVisionError) throw error;
    throw new ReferenceVisionError("invalid_response", "A resposta do GPT-5.4 mini Vision não respeitou o contrato de análise.", { cause: error }, true);
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
    this.model = options.model || process.env.OPENAI_VISION_MODEL || DEFAULT_OPENAI_VISION_MODEL;
    this.maxAttempts = Math.max(1, Math.min(options.maxAttempts || 2, 2));
    this.retryDelayMs = Math.max(0, options.retryDelayMs || 0);
    // GPT-5.4 mini continua usando contrato estruturado; low/medium reduz latência.
    this.reasoningEffort = options.reasoningEffort || process.env.OPENAI_VISION_REASONING_EFFORT || "low";
    this.detail = options.detail || (process.env.OPENAI_VISION_DETAIL as VisionAnalyzerOptions["detail"] || "medium");
    this.maxOutputTokens = options.maxOutputTokens || Number(process.env.OPENAI_VISION_MAX_OUTPUT_TOKENS || 1800);
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
    this.model = options.model || process.env.FAL_VISION_MODEL || DEFAULT_FAL_VISION_MODEL;
    this.maxAttempts = Math.max(1, Math.min(options.maxAttempts || 2, 2));
    this.retryDelayMs = Math.max(0, options.retryDelayMs || 0);
    this.maxOutputTokens = options.maxOutputTokens || Number(process.env.FAL_VISION_MAX_OUTPUT_TOKENS || 1800);
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
        return parseResponse(falOutputText(response), sourceRole, input.mode);
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
