import sharp from "sharp";
import type { FailOpenTrackedExecution } from "./operationalAnalytics";
import {
  createProviderCallTrace,
  providerResponseSummary,
  type ProviderReferenceInput,
} from "./executionTrace";

const MAX_FABRIC_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_FABRIC_IMAGE_DIMENSION = 256;
const FABRIC_PIPELINE_PROMPT_VERSION = "realista-tecido-v1";

export interface FabricVariantSeedInput {
  tecidoSku?: string | null;
  croquiUrl: string;
  variantIndex: number;
}

export interface GarmentReferencePromptInput {
  pecaEn: string;
  tecidoNome?: string | null;
  elementFragment?: string;
}

export interface MannequinFabricPromptInput {
  pecaEn: string;
  background: string;
  elementFragment?: string;
  garmentTypeInstruction?: string;
  sleevelessInstruction?: string;
  mannequinSurfaceInstruction?: string;
  comentario?: string | null;
}

export interface FabricQualityScores {
  colorPattern: number;
  material: number;
  design: number;
  artifactFree: number;
}

export interface FabricCandidate {
  index: number;
  url: string;
  scores: FabricQualityScores;
}

export interface SelectedFabricCandidate extends FabricCandidate {
  score: number;
}

export interface FabricPipelineClient {
  subscribe(endpoint: string, options: { input: Record<string, unknown> }): Promise<any>;
}

export interface FabricPipelineCandidateReference {
  index: number;
  url: string;
}

export interface FabricPipelineInput {
  client: FabricPipelineClient;
  execution?: FailOpenTrackedExecution | null;
  parentStepId?: string | null;
  visionModel?: string | null;
  croquiUrl: string;
  tecidoImageUrl: string;
  tecidoSku?: string | null;
  tecidoNome?: string | null;
  pecaEn: string;
  mannequinUrl: string;
  background: string;
  elementFragment?: string;
  garmentTypeInstruction?: string;
  sleevelessInstruction?: string;
  mannequinSurfaceInstruction?: string;
  comentario?: string | null;
  normalize?: (url: string) => Promise<string>;
  evaluate: (candidates: FabricPipelineCandidateReference[], context: { normalizedFabricUrl: string; intermediateUrl: string }) => Promise<FabricCandidate[]>;
}

export interface FabricPipelineResult {
  url: string;
  intermediateUrl: string;
  candidates: FabricCandidate[];
  selected: SelectedFabricCandidate;
  seeds: number[];
}

export interface FabricEvaluatorInput {
  client: FabricPipelineClient;
  normalizedFabricUrl: string;
  intermediateUrl: string;
  candidates: FabricPipelineCandidateReference[];
  model?: string;
  maxTokens?: number;
}

interface FabricFetchResponse {
  ok: boolean;
  headers: Headers;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface FabricReferenceOptions {
  fetchImpl?: (input: string, init?: RequestInit) => Promise<FabricFetchResponse>;
  transform?: (input: Uint8Array) => Promise<Uint8Array> | Uint8Array;
}

export function deriveFabricVariantSeed(input: FabricVariantSeedInput): number {
  const key = `${input.tecidoSku || "sem-sku"}|${input.croquiUrl}|${input.variantIndex}`;
  let hash = 2166136261;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function buildGarmentReferencePrompt(input: GarmentReferencePromptInput): string {
  return `CRITICAL: Exactly two reference images are provided.
IMAGE 1 is a hand-drawn fashion croqui of the ${input.pecaEn}. Preserve its exact cut, silhouette, construction, proportions, seams, neckline, sleeves, hem, and every visible design detail.
IMAGE 2 is a real fabric swatch photo for ${input.tecidoNome || "the selected fabric"}. It is the only authority for fabric color, weave, pattern, texture, sheen, transparency, and finish.
TASK: Create one clean, front-facing, complete garment reference on a neutral light background. Render the exact garment from IMAGE 1 as a finished fashion piece made from the exact material in IMAGE 2.
Do not add a person, mannequin, body, accessories, styling, jewelry, background objects, text, watermark, illustration, or design details not present in IMAGE 1.
${input.elementFragment || ""}`;
}

export function buildMannequinFabricPrompt(input: MannequinFabricPromptInput): string {
  return `CRITICAL: Exactly two reference images are provided.
IMAGE 1 is a photorealistic dressmaking mannequin. Preserve its exact body shape, silhouette, proportions, pose, and clean bare mannequin surface.
IMAGE 2 is the finished garment reference. Copy its exact cut, silhouette, construction, color, pattern, weave, texture, sheen, transparency, and material finish onto the mannequin.
TASK: Dress the mannequin from IMAGE 1 in the exact ${input.pecaEn} shown in IMAGE 2. Do not infer fabric from the mannequin image. Do not invent, simplify, recolor, smooth, or replace the material from IMAGE 2.
${input.sleevelessInstruction || ""}${input.garmentTypeInstruction || ""}
${input.elementFragment || ""}
${input.mannequinSurfaceInstruction || ""}
The final result must look like a professional editorial fashion photograph with soft natural studio lighting and ${input.background}, while preserving visible fabric texture and construction.
${input.comentario ? `Extra design details: ${input.comentario}\n` : ""}
  No face, no person, no additional clothing, no text, no watermark, no illustration, no sketch, no cartoon, no flat drawing.`;
}

function clampQualityScore(value: number): number {
  return Math.min(5, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function scoreFabricCandidate(scores: FabricQualityScores): number {
  return Number((
    clampQualityScore(scores.colorPattern) * 0.35
    + clampQualityScore(scores.material) * 0.35
    + clampQualityScore(scores.design) * 0.20
    + clampQualityScore(scores.artifactFree) * 0.10
  ).toFixed(4));
}

export function selectBestFabricCandidate(candidates: FabricCandidate[], minimumScore = 3): SelectedFabricCandidate | null {
  const ranked = candidates
    .map((candidate) => ({ ...candidate, score: scoreFabricCandidate(candidate.scores) }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  return best && best.score >= minimumScore ? best : null;
}

function assertSafeFabricUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL da imagem do tecido inválida.");
  }

  const hostname = url.hostname.toLowerCase();
  const blockedHost = hostname === "localhost"
    || hostname === "::1"
    || hostname.endsWith(".local")
    || hostname.startsWith("127.")
    || hostname.startsWith("10.")
    || hostname.startsWith("192.168.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    || hostname === "169.254.169.254";

  if (url.protocol !== "https:" || url.username || url.password || blockedHost) {
    throw new Error("A imagem do tecido precisa estar em uma URL HTTPS pública.");
  }

  return url;
}

async function transformFabricWithSharp(input: Uint8Array): Promise<Uint8Array> {
  const image = sharp(input, { failOn: "error" });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width < MIN_FABRIC_IMAGE_DIMENSION || metadata.height < MIN_FABRIC_IMAGE_DIMENSION) {
    throw new Error(`A imagem do tecido precisa ter pelo menos ${MIN_FABRIC_IMAGE_DIMENSION}x${MIN_FABRIC_IMAGE_DIMENSION}px.`);
  }

  return image
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "contain", background: { r: 245, g: 245, b: 245, alpha: 1 }, withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

export async function normalizeFabricReference(rawUrl: string, options: FabricReferenceOptions = {}): Promise<string> {
  const url = assertSafeFabricUrl(rawUrl);
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(url.toString(), { redirect: "follow" });

  if (!response.ok) throw new Error("Não foi possível baixar a imagem do tecido.");
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (!contentType?.startsWith("image/")) throw new Error("A URL do tecido não retornou uma imagem.");

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FABRIC_IMAGE_BYTES) {
    throw new Error("A imagem do tecido excede o limite de 10 MB.");
  }

  const input = new Uint8Array(await response.arrayBuffer());
  if (input.byteLength === 0 || input.byteLength > MAX_FABRIC_IMAGE_BYTES) {
    throw new Error("A imagem do tecido excede o limite de 10 MB.");
  }

  const output = await (options.transform || transformFabricWithSharp)(input);
  return `data:image/jpeg;base64,${Buffer.from(output).toString("base64")}`;
}

function firstImageUrl(result: any, stage: string): string {
  const url = result?.images?.[0]?.url;
  if (!url || typeof url !== "string") throw new Error(`Fal não retornou imagem na etapa ${stage}.`);
  return url;
}

function extractFalText(result: any): string {
  if (typeof result?.output_text === "string") return result.output_text;
  if (typeof result?.output === "string") return result.output;
  if (Array.isArray(result?.output)) {
    const text = result.output
      .flatMap((item: any) => [item?.text, item?.content?.text, item?.content])
      .find((value: unknown): value is string => typeof value === "string");
    if (text) return text;
  }
  throw new Error("A avaliação Fal não retornou texto.");
}

function parseJsonResponse(text: string): any {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(normalized);
  } catch (error) {
    throw new Error("A avaliação Fal retornou JSON inválido.", { cause: error });
  }
}

export async function evaluateFabricCandidates(input: FabricEvaluatorInput): Promise<FabricCandidate[]> {
  const imageUrls = [
    input.normalizedFabricUrl,
    input.intermediateUrl,
    ...input.candidates.map((candidate) => candidate.url),
  ];
  const response = await input.client.subscribe("openrouter/router/vision", {
    input: {
      image_urls: imageUrls,
      prompt: `Compare IMAGE 1 (the normalized fabric swatch), IMAGE 2 (the clean garment reference), and IMAGE 3 onward (candidate final mannequin photos).
For each candidate, score from 0 to 5: colorPattern (color and print fidelity), material (weave, texture, sheen, transparency and finish), design (faithfulness to IMAGE 2), and artifactFree (absence of visual artifacts).
Use exact visible evidence only. Do not reward generic photorealism over fabric fidelity.
Return only valid JSON: {"candidates":[{"index":0,"scores":{"colorPattern":0,"material":0,"design":0,"artifactFree":0}}]}.
Weights used by the application: colorPattern 35%, material 35%, design 20%, artifactFree 10%.`,
      system_prompt: "Analise somente as imagens recebidas. Retorne somente um objeto JSON válido, sem markdown, comentários ou texto adicional.",
      model: input.model || process.env.FAL_VISION_MODEL || "google/gemini-2.5-flash",
      temperature: 0,
      reasoning: false,
      max_tokens: input.maxTokens || 1200,
    },
  });
  const parsed = parseJsonResponse(extractFalText(response));
  const scoreByIndex = new Map<number, FabricQualityScores>();

  if (!Array.isArray(parsed?.candidates)) throw new Error("A avaliação Fal não retornou candidatos.");
  for (const item of parsed.candidates) {
    if (!Number.isInteger(item?.index)) continue;
    scoreByIndex.set(item.index, {
      colorPattern: Number(item?.scores?.colorPattern),
      material: Number(item?.scores?.material),
      design: Number(item?.scores?.design),
      artifactFree: Number(item?.scores?.artifactFree),
    });
  }

  return input.candidates.map((candidate) => ({
    ...candidate,
    scores: scoreByIndex.get(candidate.index) || { colorPattern: 0, material: 0, design: 0, artifactFree: 0 },
  }));
}

export async function runFabricPipeline(input: FabricPipelineInput): Promise<FabricPipelineResult> {
  const normalizedFabricUrl = await (input.normalize || ((url) => normalizeFabricReference(url)))(input.tecidoImageUrl);
  const garmentReferencePrompt = buildGarmentReferencePrompt({
    pecaEn: input.pecaEn,
    tecidoNome: input.tecidoNome,
    elementFragment: input.elementFragment,
  });
  const referenceSeed = deriveFabricVariantSeed({
    tecidoSku: input.tecidoSku,
    croquiUrl: input.croquiUrl,
    variantIndex: 0,
  });

  const garmentReferences: ProviderReferenceInput[] = [
    { role: "croqui", source: "generated_artifact", value: input.croquiUrl },
    { role: "fabric", source: "fabric", value: normalizedFabricUrl },
  ];
  const garmentStep = await input.execution?.startStep({
    stage: "realistic_provider_request",
    parentStepId: input.parentStepId || null,
    attempt: 1,
    seed: referenceSeed,
    promptVersion: FABRIC_PIPELINE_PROMPT_VERSION,
  });
  const garmentTrace = createProviderCallTrace({
    phase: "Criação da referência intermediária da peça",
    operation: "fal-ai/bytedance/seedream/v4/edit",
    references: garmentReferences,
    templateVersion: FABRIC_PIPELINE_PROMPT_VERSION,
    template: garmentReferencePrompt,
    requestSummary: {
      imageCount: 2,
      imageSize: "square_hd",
      numImages: 1,
      seed: referenceSeed,
      safetyCheckerEnabled: false,
    },
  });
  let intermediateUrl: string;
  try {
    const garmentReferenceResult = await input.client.subscribe("fal-ai/bytedance/seedream/v4/edit", {
      input: {
        prompt: garmentReferencePrompt,
        image_urls: [input.croquiUrl, normalizedFabricUrl],
        image_size: "square_hd",
        num_images: 1,
        seed: referenceSeed,
        enhance_prompt_mode: "standard",
        enable_safety_checker: false,
      },
    });
    intermediateUrl = firstImageUrl(garmentReferenceResult, "referência da peça");
    await garmentStep?.succeed({
      provider: "fal",
      model: "seedream-v4",
      metadata: {
        ...garmentTrace,
        responseSummary: providerResponseSummary({ outputImageCount: 1 }),
      },
    });
  } catch (error) {
    await garmentStep?.fail("provider_request_failed", {
      provider: "fal",
      model: "seedream-v4",
      metadata: garmentTrace,
    });
    throw error;
  }

  const seeds = [0, 1, 2].map((variantIndex) => deriveFabricVariantSeed({
    tecidoSku: input.tecidoSku,
    croquiUrl: input.croquiUrl,
    variantIndex,
  }));
  const candidates = await Promise.all([0, 1, 2].map(async (variantIndex) => {
    const prompt = buildMannequinFabricPrompt({
      pecaEn: input.pecaEn,
      background: input.background,
      elementFragment: input.elementFragment,
      garmentTypeInstruction: input.garmentTypeInstruction,
      sleevelessInstruction: input.sleevelessInstruction,
      mannequinSurfaceInstruction: input.mannequinSurfaceInstruction,
      comentario: input.comentario,
    });
    const variantReferences: ProviderReferenceInput[] = [
      { role: "mannequin", source: "mannequin", value: input.mannequinUrl },
      { role: "intermediate_garment", source: "generated_artifact", value: intermediateUrl },
    ];
    const variantStep = await input.execution?.startStep({
      stage: "realistic_provider_request",
      parentStepId: input.parentStepId || null,
      attempt: variantIndex + 2,
      seed: seeds[variantIndex],
      promptVersion: FABRIC_PIPELINE_PROMPT_VERSION,
    });
    const variantTrace = createProviderCallTrace({
      phase: `Geração da variante realista ${variantIndex + 1}`,
      operation: "fal-ai/bytedance/seedream/v4/edit",
      references: variantReferences,
      templateVersion: FABRIC_PIPELINE_PROMPT_VERSION,
      template: prompt,
      requestSummary: {
        variantIndex,
        imageCount: 2,
        imageSize: "square_hd",
        numImages: 1,
        seed: seeds[variantIndex],
        safetyCheckerEnabled: false,
      },
    });
    try {
      const result = await input.client.subscribe("fal-ai/bytedance/seedream/v4/edit", {
        input: {
          prompt,
          image_urls: [input.mannequinUrl, intermediateUrl],
          image_size: "square_hd",
          num_images: 1,
          seed: seeds[variantIndex],
          enhance_prompt_mode: "standard",
          enable_safety_checker: false,
        },
      });
      const url = firstImageUrl(result, `variante ${variantIndex + 1}`);
      await variantStep?.succeed({
        provider: "fal",
        model: "seedream-v4",
      metadata: {
        ...variantTrace,
        variantIndex,
        responseSummary: providerResponseSummary({ outputImageCount: 1 }),
      },
      });
      return { index: variantIndex, url };
    } catch (error) {
      await variantStep?.fail("provider_request_failed", {
        provider: "fal",
        model: "seedream-v4",
        metadata: variantTrace,
      });
      throw error;
    }
  }));

  const evaluationReferences: ProviderReferenceInput[] = [
    { role: "fabric", source: "fabric", value: normalizedFabricUrl },
    { role: "intermediate_garment", source: "generated_artifact", value: intermediateUrl },
    ...candidates.map((candidate) => ({
      role: `candidate_${candidate.index + 1}`,
      source: "generated_artifact" as const,
      value: candidate.url,
    })),
  ];
  const evaluationStep = await input.execution?.startStep({
    stage: "realistic_vision_evaluation",
    parentStepId: input.parentStepId || null,
    attempt: 1,
    promptVersion: FABRIC_PIPELINE_PROMPT_VERSION,
  });
  const evaluationTrace = createProviderCallTrace({
    phase: "Comparação Vision das variantes realistas",
    operation: "openrouter/router/vision",
    references: evaluationReferences,
    templateVersion: FABRIC_PIPELINE_PROMPT_VERSION,
    requestSummary: {
      imageCount: evaluationReferences.length,
      candidateCount: candidates.length,
      mode: "fabric_fidelity",
    },
  });
  let evaluatedCandidates: FabricCandidate[];
  try {
    evaluatedCandidates = await input.evaluate(candidates, { normalizedFabricUrl, intermediateUrl });
    await evaluationStep?.succeed({
      provider: "fal",
      model: input.visionModel || "google/gemini-2.5-flash",
      metadata: {
        ...evaluationTrace,
        responseSummary: providerResponseSummary({
          outputText: true,
          resultCount: evaluatedCandidates.length,
        }),
      },
    });
  } catch (error) {
    await evaluationStep?.fail("vision_evaluation_failed", {
      provider: "fal",
      model: input.visionModel || "google/gemini-2.5-flash",
      metadata: evaluationTrace,
    });
    throw error;
  }
  const selected = selectBestFabricCandidate(evaluatedCandidates);
  if (!selected) throw new Error("Nenhuma variante atingiu o nível mínimo de fidelidade do tecido.");

  return { url: selected.url, intermediateUrl, candidates: evaluatedCandidates, selected, seeds };
}
