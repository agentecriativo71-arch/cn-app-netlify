import { createServerFn } from "@tanstack/react-start";
import * as fal from "@fal-ai/serverless-client";
import {
  saveLook,
  updateLook,
  searchProducts,
  createUploadSession,
  getUploadSession,
  confirmUploadSession,
  updateUploadSession,
  updateUploadSessionStatus,
  claimUploadSessionForGeneration,
  type UploadSession,
} from "./db";
import type { JsonObject } from "./db";
import {
  getBackgroundInstruction,
  getMannequinUrl,
  buildSleevelessInstruction,
  buildMannequinSurfaceInstruction,
  getPieceFlowRules,
  SLEEVELESS_DECOTES,
} from "../lib/noivaUtils";
import { buildCatalogElementPromptFragment } from "../lib/garmentPrompt";
import {
  REFERENCE_PROMPT_VERSION,
  REFERENCE_PIECES,
  buildVisionPromptForReferencePart,
  buildVisionPromptForCompositeReference,
  buildVisionPromptForSingleReference,
  mergeCompositeReferenceAnalyses,
  relabelReferenceAnalysisPart,
  referenceAnalysisToCroquiSpecs,
  validateReferenceAnalysisForMode,
  type ReferenceAnalysis,
  type ReferencePiece,
} from "../lib/referenceUtils";
import { decideReferenceAnalysis } from "../lib/referenceDecision";
import {
  createReferenceVisionAnalyzer,
  ReferenceVisionError,
  resolveVisionModel,
  type ReferenceVisionResult,
  type VisionProvider,
  type VisionInput,
} from "./referenceVision";
import {
  validateReferenceDataUrl,
  validateReferenceImages,
  ReferenceInputError,
} from "./referenceInput";
import {
  assertReferenceGenerationTextOnly,
  buildReferenceSeedreamInput,
} from "./referenceGeneration";
import {
  evaluateFabricCandidates,
  runFabricPipeline,
  scoreFabricCandidate,
} from "./fabricPipeline";
import {
  buildCandidateGatePrompt,
  buildCroquiEvaluationPrompt,
  buildCroquiReferenceDescriptors,
  buildCroquiReferenceImageUrls,
  buildCroquiReferenceRoleInstruction,
  chooseCroquiCandidate,
  rankCroquiCandidates,
  CROQUI_VISION_ASSESSMENT_VERSION,
  CROQUI_CANDIDATE_COUNT,
  CROQUI_GENERATOR,
  CROQUI_PROMPT_VERSION,
  FEMALE_CROQUI_INVARIANT,
  MANNEQUIN_TEMPLATE_INSTRUCTION,
  occasionInstruction,
  parseCroquiGenerationRequest,
  scoreCroquiCandidate,
  validateCroquiReferenceDescriptors,
  type CroquiGenerationRequest,
  type CroquiGenerationMetadata,
  type CroquiVisualAssessment,
} from "../lib/croquiGeneration";
import { classifyFalGenerationError } from "./falDiagnostics";
import {
  failOpenOperationalAnalytics,
  operationalAnalytics,
} from "./analyticsRuntime";
import type {
  FailOpenTrackedExecution,
  FailOpenTrackedStep,
} from "./operationalAnalytics";
import {
  createProviderCallTrace,
  providerReferenceDigest,
  providerResponseSummary,
  type ProviderReferenceInput,
} from "./executionTrace";
import { deriveGarmentDetailDataUrls } from "./executionAssets";
import { getExecutionAssetStore } from "./executionAssetsRuntime";
import {
  getCrmSupabaseAdminClient,
  getOperationalSupabaseAdminClient,
} from "./supabaseClients";

const crmSupabase = getCrmSupabaseAdminClient();
const operationalSupabase = getOperationalSupabaseAdminClient();
const CROQUI_CANDIDATE_CONCURRENCY = 2;

const PECA_EN: Record<string, string> = {
  Vestido: "dress",
  Saia: "skirt",
  Blusa: "blouse",
  Calça: "pants",
  Macacão: "jumpsuit",
  Top: "crop top",
  "Short/Bermuda": "shorts",
  Blazer: "blazer",
};

const COMPRIMENTO_EN: Record<string, string> = {
  Curto: "mini",
  Médio: "knee-length",
  Midi: "midi",
  Longo: "floor-length",
};

// Precise anatomical hem placement for the AI
const COMPRIMENTO_HEM: Record<string, string> = {
  Curto:
    "CRITICAL LENGTH: This is a MINI / SHORT garment (~35-45cm from waist). The hem MUST end at MID-THIGH, well ABOVE the knee — showing most of the thigh. Do NOT make it knee-length or longer. Think mini-skirt.",
  Médio:
    "CRITICAL LENGTH: The hem MUST end exactly AT the kneecap (~55-60cm from waist). Not above the knee, not below — right at knee level.",
  Midi: "CRITICAL LENGTH: The hem MUST end at MID-CALF (~70-80cm from waist), halfway between the knee and the ankle. Not at the knee, not at the ankle.",
  Longo:
    "CRITICAL LENGTH: The hem MUST reach the ANKLE or the floor (~95-110cm from waist). This is a full-length maxi garment.",
};

const CORES_EN: Record<string, string> = {
  "Verde C&N": "emerald green",
  Preto: "black",
  Branco: "white",
  "Azul Marinho": "navy blue",
  "Vermelho Rubi": "ruby red",
  "Rosa Pastel": "pastel pink",
  "Roxo Imperial": "imperial purple",
  Terracota: "terracotta",
  "Amarelo Mostarda": "mustard yellow",
  "Nude/Bege": "nude beige",
  Lilás: "lilac",
  "Verde Menta": "mint green",
};

// Bottom-only garment keywords (skirt, pants, shorts, bermuda)
const _BOTTOM_KEYWORDS = [
  "skirt",
  "saia",
  "pants",
  "calça",
  "shorts",
  "bermuda",
];
function isBottomGarment(pecaEn: string, pecaPt: string): boolean {
  const combined = `${pecaEn} ${pecaPt}`.toLowerCase();
  return _BOTTOM_KEYWORDS.some((kw) => combined.includes(kw));
}

// Top-only garment keywords (blouse, shirt, top)
const _TOP_KEYWORDS = ["blouse", "blusa", "shirt", "top", "crop", "blazer"];
function isTopGarment(pecaEn: string, pecaPt: string): boolean {
  const combined = `${pecaEn} ${pecaPt}`.toLowerCase();
  return _TOP_KEYWORDS.some((kw) => combined.includes(kw));
}

export type TypedCroquiGenerationRequest = CroquiGenerationRequest;

async function internalGenerateCroqui(
  data: TypedCroquiGenerationRequest,
): Promise<string> {
  const {
    peca,
    biotipo,
    comprimento,
    decote,
    manga,
    possuiManga,
    saia,
    renda,
    comentario,
    tipoCerimonia,
    rendaDecisao,
    ocasiao,
    previousCroquiUrl,
    referenceAnalysis,
  } = data;

  if (ocasiao === "Noiva" && peca !== "Vestido")
    throw new Error("Noiva aceita somente Vestido.");
  if (
    ocasiao === "Noiva" &&
    !referenceAnalysis &&
    (!tipoCerimonia ||
      rendaDecisao === null ||
      rendaDecisao === undefined ||
      !comprimento ||
      !biotipo ||
      !comentario?.trim())
  ) {
    throw new Error(
      "O fluxo de Noiva exige cerimônia, renda, comprimento, biotipo e comentário.",
    );
  }
  const bottomPiece = ["Vestido", "Saia", "Macacão"].includes(peca);
  const { showDecote, showManga } = getPieceFlowRules(peca, decote);
  if (showDecote && !decote)
    throw new Error("Decote ou gola é obrigatório para esta peça.");
  if (showManga && possuiManga !== false && !manga)
    throw new Error(
      "Manga é obrigatória para esta peça, exceto quando sem manga for confirmado.",
    );
  if (bottomPiece && !saia)
    throw new Error("Modelagem de saia é obrigatória para esta peça.");
  if (rendaDecisao === true && !renda)
    throw new Error("O tipo de renda é obrigatório quando a decisão é sim.");

  if (referenceAnalysis && !peca) {
    throw new Error(
      "A análise da referência não identificou a peça com confiança suficiente.",
    );
  }

  if (referenceAnalysis) {
    assertReferenceGenerationTextOnly(data);
    for (const referenceImageUrl of data.referenceImageUrls || []) {
      // O fluxo de referência só aceita Data URLs validadas do recorte
      // anonimizado. URLs remotas poderiam reintroduzir a foto original.
      validateReferenceDataUrl(referenceImageUrl);
    }
  }

  // Se houver um croqui anterior (ajuste/edição), usamos o endpoint de EDIT do Seedream para alterar a imagem existente
  if (previousCroquiUrl) {
    const editPrompt = `CRITICAL INSTRUCTION FOR CROQUI EDIT: The reference image is an existing hand-drawn fashion croqui sketch.
Modify this exact croqui drawing by applying ONLY the following requested design adjustment: "${comentario || "update details"}".
Preserve the exact composition, mannequin body shape, hand-drawn black pencil line-art sketch style, fabric drape, and side-by-side front/back layout from the reference image.
Do NOT redraw a completely different dress or alter unrelated parts of the garment. Only alter the specified elements (such as adding long sleeves, changing neckline, or adding details) while maintaining maximum fidelity to the original reference croqui image.
Style: hand-drawn black pencil on white paper. No color, no photo, no background, no text, no facial features.`;

    try {
      const result: any = await fal.subscribe(
        "fal-ai/bytedance/seedream/v4/edit",
        {
          input: {
            prompt: editPrompt,
            image_urls: [previousCroquiUrl],
            image_size: "portrait_4_3",
            num_images: 1,
            enable_safety_checker: false,
          },
        },
      );

      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) throw new Error("No image returned from Fal.ai");
      return imageUrl;
    } catch (error) {
      console.error("[CROQUI EDIT] Error editing croqui:", error);
      throw error;
    }
  }

  let bodyContext = "";
  if (biotipo)
    bodyContext = ` CRITICAL — IMAGE 1 is the sole authority for the selected female biotype ${biotipo}. Preserve its proportions exactly; do not infer or redraw this body from a textual description.`;

  const pecaEn = PECA_EN[peca as keyof typeof PECA_EN] || peca || "garment";
  const comprimentoEn = comprimento
    ? COMPRIMENTO_EN[comprimento as keyof typeof COMPRIMENTO_EN] || comprimento
    : "";

  const elementFragment = buildCatalogElementPromptFragment({
    decote,
    manga,
    possuiManga,
    saia,
    renda: rendaDecisao === false ? null : renda,
    peca,
  });
  const isBottom = isBottomGarment(pecaEn, peca || "");
  const isTop = isTopGarment(pecaEn, peca || "");
  const hemInstruction = comprimento
    ? COMPRIMENTO_HEM[comprimento as keyof typeof COMPRIMENTO_HEM] || ""
    : "";
  const sleevelessInstruction = referenceAnalysis
    ? possuiManga === false
      ? buildSleevelessInstruction(decote, null)
      : ""
    : buildSleevelessInstruction(decote, manga);

  // Build the leading instruction block — garment type + length come FIRST
  let leadingInstructions = "";
  // Determina se a peça é de uma única peça (vestido, macacão)
  const isOnePiece =
    pecaEn === "dress" || pecaEn === "jumpsuit" || ocasiao === "Noiva";

  if (ocasiao === "Noiva") {
    let cerimonyCtx = "";
    if (tipoCerimonia === "Civil") cerimonyCtx = " for a civil ceremony";
    else if (tipoCerimonia === "Igreja")
      cerimonyCtx = " for a traditional church wedding";
    else if (tipoCerimonia === "Cerimônia Aberta")
      cerimonyCtx = " for an outdoor open wedding ceremony";

    let laceCtx = "";
    if (rendaDecisao === true) {
      laceCtx = renda
        ? ` It features ${renda} lace details and applications.`
        : " It features lace details and applications.";
    } else if (rendaDecisao === false) {
      laceCtx = " It is absolutely plain with NO lace anywhere.";
    }

    leadingInstructions = `CRITICAL — ONE-PIECE GARMENT: This is a SINGLE bridal wedding dress${cerimonyCtx} — NOT a two-piece outfit. The dress is ONE continuous garment from neckline to hem with NO visible separation between bodice and skirt. Do NOT draw a top and separate skirt. The bodice and skirt are structurally integrated as one unified dress.${laceCtx}\nPresent the dress fully visible from neckline to hem.\n${hemInstruction}`;
  } else if (isBottom) {
    leadingInstructions = `IMPORTANT: This is a BOTTOM garment ONLY — a ${pecaEn}. Do NOT draw any top, blouse, shirt, or upper body clothing. Show ONLY the ${pecaEn} from waistband to hem. The mannequin torso above the waistband MUST be completely bare and clean — no seam lines, no zippers, no closure lines, no stitching, no fabric details above the waist. The upper body is just an empty mannequin form.\n${hemInstruction}`;
  } else if (isTop) {
    leadingInstructions = `IMPORTANT: This is a TOP garment ONLY — a ${pecaEn}. Do NOT draw any skirt, pants, dress, or lower body clothing. Show ONLY the ${pecaEn} from neckline to the natural hem at the waist/hips. The mannequin legs and lower body below the hem of the ${pecaEn} MUST be completely bare and clean — no fabric details, no skirt, no pants. The lower body is just an empty mannequin form.`;
  } else {
    const lengthPrefix = comprimentoEn ? `${comprimentoEn} ` : "";
    const onePieceNote = isOnePiece
      ? ` CRITICAL — ONE-PIECE GARMENT: This is a SINGLE unified ${pecaEn} — NOT a two-piece outfit. The bodice and lower portion are ONE continuous integrated garment. Do NOT draw a separate top and separate bottom. The waistline is a seam detail WITHIN the garment, not a separation point between two pieces.`
      : "";
    leadingInstructions = `This is a ${lengthPrefix}${pecaEn}.${onePieceNote} Present the garment fully visible from neckline/collar to hem, showing the complete silhouette: neckline, sleeves, body fit, waistline, and hem.\n${hemInstruction}`;
  }

  // Build strong front/back consistency instruction
  const isSleevelessDesign = SLEEVELESS_DECOTES.includes(decote || "");
  const sleevelessBackRule = isSleevelessDesign
    ? ` CRITICAL BACK VIEW RULE: The front of this garment is strapless/sleeveless (${decote}). The back MUST also be strapless — do NOT add any straps, racerback, halter neck, shoulder coverage, tank-top back, or any fabric covering the shoulders or upper back that does not exist on the front. The back neckline must match the same strapless construction as the front. The upper back and shoulders must be completely bare, matching the front.`
    : "";

  const backViewInstruction = isBottom
    ? "The back view must show closure details and seam lines ONLY on the garment itself (below the waistband). The mannequin torso above the waistband must remain completely bare — no zippers, seams, or lines on the upper back."
    : isTop
      ? `The back view must show closure details and seam lines ONLY on the garment itself (above the waist/hips). The mannequin lower body below the hem of the ${pecaEn} must remain completely bare.`
      : `CRITICAL FRONT/BACK CONSISTENCY: The back view must be structurally consistent with the front view — same neckline type, same sleeve type (or lack thereof), same overall silhouette and construction. Do NOT add structural elements to the back (straps, sleeves, coverage) that do not exist on the front. The back view should show: the reverse of the same garment construction, any back closure details (invisible zipper, buttons), back seam lines, and darts — but the overall structure must match the front exactly.${sleevelessBackRule}`;

  const prompt = `${FEMALE_CROQUI_INVARIANT}
${MANNEQUIN_TEMPLATE_INSTRUCTION}
${buildCroquiReferenceRoleInstruction(data)}
${occasionInstruction(ocasiao)}
${sleevelessInstruction}${leadingInstructions}
Professional fashion design croqui of a ${comprimentoEn} ${pecaEn}.${elementFragment}${bodyContext}
${isOnePiece ? `REMINDER: This is ONE single piece of clothing — bodice and skirt/lower portion are NOT separate items. Draw it as one unified garment with continuous fabric flow from top to bottom.\n` : ""}${comentario ? `Extra design instructions: ${comentario}\n` : ""}
CRITICAL: Show BOTH front view AND back view of the garment side by side in a single composition — front view on the left, back view on the right, as in professional fashion croquis.
The figure is a faceless fashion mannequin form — no facial features, no face detail, just a smooth featureless head or implied head shape. The focus is entirely on the garment.
Style: hand-drawn black pencil on white paper. Use hatching and cross-hatching for volume and shadow, directional strokes following the fabric grain to convey drape and texture, fine contour lines for garment structure, and stippling for any textured surfaces.
Clearly render garment construction details: seam lines, darts, stitch lines, closures, hemlines, and any decorative elements.
CAIMENTO AND MOVEMENT: show directional fabric grain, gravity-aware folds, realistic volume, hem movement and fluid drape. Preserve every visible construction detail from the selected catalog/reference; do not simplify the garment into a blank basic shape.
${backViewInstruction}
No color, no photographs, no realistic rendering, no 3D, no shading gradients, no painted or digital look.
No text, no labels, no annotations, no watermarks, no faces, no facial features.`;

  const referenceImageUrls = buildCroquiReferenceImageUrls(
    data,
    data.referenceImageUrls || [],
  );
  const input = buildReferenceSeedreamInput(
    prompt,
    referenceImageUrls,
    data.seed,
  );
  const result: any = await fal.subscribe(
    "fal-ai/bytedance/seedream/v4/edit",
    {
      input,
    },
  );

  const imageUrl = result.images?.[0]?.url;
  if (!imageUrl) throw new Error("No image returned from Fal.ai");

  return imageUrl;
}

async function generateCroquiCandidates(
  request: TypedCroquiGenerationRequest,
  execution: FailOpenTrackedExecution | null = null,
): Promise<{
  url: string;
  metadata: CroquiGenerationMetadata;
  artifactId: string | null;
}> {
  const candidates: CroquiGenerationMetadata["candidates"] = [];
  const candidateStepIds = new Map<number, string>();
  const evaluationStepIds = new Map<number, string>();
  const candidateArtifactIds = new Map<number, string>();
  const overallStep = await execution?.startStep({
    stage: "croqui_generation",
    promptVersion: CROQUI_PROMPT_VERSION,
  });

  // Cada imagem gerada é copiada para o bucket privado e registrada antes da
  // seleção. Assim, uma execução que termina sem candidato aprovado continua
  // auditável, sem persistir a URL temporária do provedor.
  const persistCandidateArtifact = async (
    candidate: CroquiGenerationMetadata["candidates"][number],
  ): Promise<void> => {
    if (!execution || !candidate.url) return;
    const storageStep = await execution.startStep({
      stage: "generated_artifact_storage",
      parentStepId:
        evaluationStepIds.get(candidate.seed) ||
        candidateStepIds.get(candidate.seed) ||
        overallStep?.stepId,
      seed: candidate.seed,
    });
    let stored: {
      storageBucket: string;
      storagePath: string;
      mimeType: string;
    } | null = null;
    try {
      const assets = getExecutionAssetStore();
      if (!assets) throw new Error("storage_unavailable");
      stored = await assets.saveGeneratedImage({
        executionId: execution.executionId,
        kind: "croqui_candidate",
        sourceUrl: candidate.url,
      });
      await storageStep?.succeed({
        provider: "supabase",
        model: "storage",
        metadata: { kind: "croqui_candidate" },
      });
    } catch {
      await storageStep?.fail("generated_artifact_storage_failed");
    }
    const artifact = await execution.recordArtifact({
      kind: "croqui_candidate",
      selected: false,
      stepId:
        evaluationStepIds.get(candidate.seed) ||
        candidateStepIds.get(candidate.seed) ||
        null,
      // O URL temporário do provedor pode conter tokens; a URL oficial será
      // criada sob demanda pelo dashboard a partir do objeto privado.
      sourceUrl: null,
      storageBucket: stored?.storageBucket || null,
      storagePath: stored?.storagePath || null,
      mimeType: stored?.mimeType || null,
      status: stored ? "available" : "storage_failed",
      metadata: {
        schemaVersion: "croqui-candidate-v2",
        attempt: candidate.attempt || 1,
        seed: candidate.seed,
        referenceDigest: candidate.url
          ? providerReferenceDigest(candidate.url)
          : null,
        score: candidate.score,
        technicalScore: candidate.score,
        averageConfidence: candidate.averageConfidence ?? null,
        eligible: candidate.eligible !== false,
        rejected: candidate.rejected,
        rejectionReasons: candidate.rejectionReasons,
        qualityWarnings: candidate.qualityWarnings || [],
        assessment: candidate.assessment,
        visionAnalysis: candidate.visionAnalysis,
      },
      retentionDays: 90,
    });
    if (artifact) candidateArtifactIds.set(candidate.seed, artifact.artifactId);
  };

  const references = buildCroquiReferenceDescriptors(
    request,
    request.referenceImageUrls || [],
  );
  const referenceValidation = validateCroquiReferenceDescriptors(references);
  const referenceValidationStep = await execution?.startStep({
    stage: "croqui_reference_validation",
    parentStepId: overallStep?.stepId,
    attempt: 1,
    promptVersion: CROQUI_PROMPT_VERSION,
  });
  if (!referenceValidation.valid) {
    const invalid = referenceValidation.invalid;
    const errorCode =
      invalid.role === "customer_crop"
        ? "invalid_customer_reference_url"
        : "invalid_catalog_reference_url";
    await referenceValidationStep?.fail(errorCode, {
      provider: "catalog",
      model: "catalog-assets",
      metadata: {
        errorCode,
        referenceRole: invalid.role,
        referenceValue: invalid.selectedValue,
        assetName: invalid.assetName,
        referenceCount: references.length,
      },
    });
    await overallStep?.fail(errorCode, {
      provider: "catalog",
      model: "catalog-assets",
      metadata: {
        errorCode,
        referenceRole: invalid.role,
        referenceValue: invalid.selectedValue,
        assetName: invalid.assetName,
        referenceCount: references.length,
      },
    });
    const failure = new Error(
      "Uma referência de croqui não possui URL pública acessível.",
    ) as Error & {
      metadata?: CroquiGenerationMetadata;
      errorCode?: string;
    };
    failure.errorCode = errorCode;
    failure.metadata = {
      generator: CROQUI_GENERATOR,
      promptVersion: CROQUI_PROMPT_VERSION,
      candidates: [],
    };
    throw failure;
  }
  await referenceValidationStep?.succeed({
    provider: "catalog",
    model: "catalog-assets",
    metadata: {
      referenceCount: references.length,
      referenceRoles: references.map((reference) => reference.role),
    },
  });

  let abortAfterNonRetryableFailure = false;
  const processCandidate = async (
    index: number,
  ): Promise<CroquiGenerationMetadata["candidates"][number]> => {
    const seed = 260826 + index;
    const attempt = index + 1;
    const generationStep = await execution?.startStep({
      stage: "croqui_candidate_generation",
      parentStepId: overallStep?.stepId,
      attempt,
      seed,
      promptVersion: CROQUI_PROMPT_VERSION,
    });
    if (generationStep) candidateStepIds.set(seed, generationStep.stepId);

    let url: string | null = null;
    let finalDiagnostic: ReturnType<typeof classifyFalGenerationError> | null = null;
    let providerAttempts = 0;
    for (let providerAttempt = 1; providerAttempt <= 2; providerAttempt += 1) {
      providerAttempts = providerAttempt;
      const providerStep = await execution?.startStep({
        stage: "croqui_provider_request",
        parentStepId: generationStep?.stepId || overallStep?.stepId,
        attempt: providerAttempt,
        seed,
        promptVersion: CROQUI_PROMPT_VERSION,
      });
      const providerReferences: ProviderReferenceInput[] = request.previousCroquiUrl
        ? [{
            role: "croqui_anterior",
            source: "generated_artifact",
            value: request.previousCroquiUrl,
          }]
        : references.map((reference) => ({
            role: reference.role,
            source:
              reference.role === "customer_crop" ? "customer_crop" : "catalog",
            selectedValue: reference.selectedValue,
            assetName: reference.assetName,
            value: reference.url,
          }));
      const providerTrace = createProviderCallTrace({
        phase: `Geração do candidato ${attempt} · tentativa Fal.ai ${providerAttempt}`,
        operation: "fal-ai/bytedance/seedream/v4/edit",
        references: providerReferences,
        templateVersion: CROQUI_PROMPT_VERSION,
        requestSummary: {
          candidateIndex: attempt,
          providerAttempt,
          seed,
          imageSize: "portrait_4_3",
          numImages: 1,
          safetyCheckerEnabled: false,
        },
      });
      try {
        url = await internalGenerateCroqui({ ...request, seed });
        await providerStep?.succeed({
          provider: "fal",
          model: CROQUI_GENERATOR,
          metadata: {
            ...providerTrace,
            candidateIndex: attempt,
            providerAttempt,
            responseSummary: providerResponseSummary({
              outputImageCount: url ? 1 : 0,
            }),
          },
        });
        break;
      } catch (error) {
        finalDiagnostic = classifyFalGenerationError(error, {
          model: CROQUI_GENERATOR,
          candidateIndex: attempt,
          providerAttempt,
          referenceSummary: references.map((reference) => ({
            role: reference.role,
            selectedValue: reference.selectedValue,
            assetName: reference.assetName,
          })),
        });
        console.error("[CROQUI] Fal.ai generation failed", finalDiagnostic);
        await providerStep?.fail(finalDiagnostic.errorCode, {
          provider: finalDiagnostic.provider,
          model: finalDiagnostic.model,
          metadata: { ...providerTrace, ...finalDiagnostic },
        });
        if (!finalDiagnostic.retryable) {
          abortAfterNonRetryableFailure = true;
          break;
        }
      }
    }

    if (!url) {
      const errorCode = finalDiagnostic?.errorCode || "fal_generation_failed";
      await generationStep?.fail(errorCode, {
        provider: "fal",
        model: CROQUI_GENERATOR,
        metadata: {
          candidateIndex: attempt,
          providerAttempts,
          ...(finalDiagnostic || {}),
        },
      });
      return {
        url: "",
        seed,
        attempt,
        score: 0,
        rejected: true,
        eligible: false,
        averageConfidence: null,
        assessment: null,
        visionAnalysis: null,
        rejectionReasons: [errorCode],
      };
    }

    await generationStep?.succeed({
      provider: "fal",
      model: CROQUI_GENERATOR,
      metadata: { attempt, candidateIndex: attempt, providerAttempts },
    });
    const evaluationStep = await execution?.startStep({
      stage: "croqui_candidate_evaluation",
      parentStepId: generationStep?.stepId || overallStep?.stepId,
      attempt,
      seed,
      promptVersion: CROQUI_PROMPT_VERSION,
    });
    if (evaluationStep) evaluationStepIds.set(seed, evaluationStep.stepId);
    const evaluationPrompt = buildCroquiEvaluationPrompt(request);
    const evaluator = createReferenceVisionAnalyzer();
    const evaluationTrace = createProviderCallTrace({
      phase: `Avaliação Vision do candidato ${attempt}`,
      operation: "openrouter/router/vision",
      references: [{
        role: "croqui_candidate",
        source: "generated_artifact",
        value: url,
      }],
      templateVersion: CROQUI_VISION_ASSESSMENT_VERSION,
      template: evaluationPrompt,
      requestSummary: {
        candidateIndex: attempt,
        imageCount: 1,
        mode: "single",
      },
    });
    try {
      const evaluated = await evaluator.analyze({
        mode: "single",
        occasion: request.ocasiao || undefined,
        targetPiece: request.peca as ReferencePiece,
        imageDataUrls: [url],
        prompt: evaluationPrompt,
      });
      const visual: CroquiVisualAssessment = {
        comprimento: evaluated.analysis.comprimento,
        peca: evaluated.analysis.peca,
        decote: evaluated.analysis.decote,
        possuiManga: evaluated.analysis.possuiManga,
        manga: evaluated.analysis.manga,
        saia: evaluated.analysis.saia,
        renda: evaluated.analysis.renda,
      };
      const candidate = scoreCroquiCandidate(
        request,
        buildCandidateGatePrompt(request),
        url,
        seed,
        visual,
        attempt,
      );
      candidate.visionAnalysis = evaluated.analysis;
      await evaluationStep?.succeed({
        provider: evaluator.providerName,
        model: evaluator.modelName,
        metadata: {
          ...evaluationTrace,
          responseSummary: providerResponseSummary({
            outputText: true,
            resultCount: 1,
          }),
          candidateIndex: attempt,
          seed,
          schemaVersion: CROQUI_VISION_ASSESSMENT_VERSION,
          technicalScore: candidate.score,
          averageConfidence: candidate.averageConfidence ?? null,
          eligible: candidate.eligible !== false,
          disqualifiers: candidate.rejectionReasons,
          qualityWarnings: candidate.qualityWarnings || [],
          criteria: candidate.assessment?.criteria,
          visionAnalysis: evaluated.analysis,
        },
      });
      await persistCandidateArtifact(candidate);
      return candidate;
    } catch {
      await evaluationStep?.fail("vision_evaluation_failed", {
        provider: evaluator.providerName,
        model: evaluator.modelName,
        metadata: {
          ...evaluationTrace,
          candidateIndex: attempt,
          seed,
        },
      });
      const candidate = {
        url,
        seed,
        attempt,
        score: 0,
        rejected: true,
        eligible: false,
        averageConfidence: null,
        assessment: null,
        visionAnalysis: null,
        rejectionReasons: ["vision_evaluation_failed"],
      };
      await persistCandidateArtifact(candidate);
      return candidate;
    }
  };

  // Duas tarefas independentes rodam em paralelo; cada lote termina antes do
  // próximo, preservando limite de concorrência e parada após erro fatal.
  for (
    let batchStart = 0;
    batchStart < CROQUI_CANDIDATE_COUNT && !abortAfterNonRetryableFailure;
    batchStart += CROQUI_CANDIDATE_CONCURRENCY
  ) {
    const batchIndexes = Array.from(
      { length: Math.min(CROQUI_CANDIDATE_CONCURRENCY, CROQUI_CANDIDATE_COUNT - batchStart) },
      (_, offset) => batchStart + offset,
    );
    const batchCandidates = await Promise.all(
      batchIndexes.map((index) => processCandidate(index)),
    );
    candidates.push(...batchCandidates);
  }
  const ranked = rankCroquiCandidates(candidates);
  let selected: CroquiGenerationMetadata["candidates"][number];
  try {
    selected = chooseCroquiCandidate(ranked);
  } catch {
    const generatedCandidateCount = candidates.filter(
      (candidate) => Boolean(candidate.url),
    ).length;
    const errorCode =
      generatedCandidateCount === 0
        ? "candidate_generation_failed"
        : "no_eligible_candidate";
    await overallStep?.fail(errorCode, {
      provider: generatedCandidateCount === 0 ? "fal" : "vision",
      model:
        generatedCandidateCount === 0
          ? CROQUI_GENERATOR
          : "google/gemini-2.5-flash",
      metadata: {
        plannedCandidateCount: CROQUI_CANDIDATE_COUNT,
        generatedCandidateCount,
        evaluatedCandidateCount: candidates.filter(
          (candidate) => candidate.visionAnalysis,
        ).length,
        eligibleCandidateCount: candidates.filter(
          (candidate) => candidate.eligible,
        ).length,
        failedCandidateCount: candidates.filter(
          (candidate) => candidate.rejectionReasons.length > 0,
        ).length,
        primaryFailureCode:
          candidates.find((candidate) => candidate.rejectionReasons.length > 0)
            ?.rejectionReasons[0] || null,
      },
    });
    const failure = new Error(
      "Nenhum candidato de croqui pôde ser selecionado.",
    ) as Error & {
      metadata?: CroquiGenerationMetadata;
      errorCode?: string;
    };
    failure.errorCode = errorCode;
    failure.metadata = {
      generator: CROQUI_GENERATOR,
      promptVersion: CROQUI_PROMPT_VERSION,
      candidates: ranked,
    };
    throw failure;
  }
  const selectedArtifactId = candidateArtifactIds.get(selected.seed) || null;
  for (const candidate of ranked) {
    const artifactId = candidateArtifactIds.get(candidate.seed);
    if (!artifactId) continue;
    await execution?.updateArtifact(artifactId, {
      kind: candidate.selected ? "croqui" : "croqui_candidate",
      selected: Boolean(candidate.selected),
      metadata: {
        schemaVersion: "croqui-candidate-v2",
        attempt: candidate.attempt || 1,
        seed: candidate.seed,
        referenceDigest: candidate.url
          ? providerReferenceDigest(candidate.url)
          : null,
        score: candidate.score,
        technicalScore: candidate.score,
        averageConfidence: candidate.averageConfidence ?? null,
        eligible: candidate.eligible !== false,
        rejected: candidate.rejected,
        rejectionReasons: candidate.rejectionReasons,
        qualityWarnings: candidate.qualityWarnings || [],
        rank: candidate.rank ?? null,
        selected: Boolean(candidate.selected),
        assessment: candidate.assessment ?? null,
        visionAnalysis: candidate.visionAnalysis ?? null,
      },
    });
  }
  await overallStep?.succeed({
    provider: "fal",
    model: CROQUI_GENERATOR,
    metadata: {
      plannedCandidateCount: CROQUI_CANDIDATE_COUNT,
      generatedCandidateCount: candidates.filter(
        (candidate) => Boolean(candidate.url),
      ).length,
      evaluatedCandidateCount: candidates.filter(
        (candidate) => candidate.visionAnalysis,
      ).length,
      eligibleCandidateCount: candidates.filter(
        (candidate) => candidate.eligible,
      ).length,
      failedCandidateCount: candidates.filter(
        (candidate) => candidate.rejectionReasons.length > 0,
      ).length,
      candidateCount: candidates.length,
      selectedSeed: selected.seed,
      selectedScore: selected.score,
      candidateCountExpected: CROQUI_CANDIDATE_COUNT,
    },
  });
  return {
    url: selected.url,
    metadata: {
      generator: CROQUI_GENERATOR,
      promptVersion: CROQUI_PROMPT_VERSION,
      candidates: ranked,
    },
    artifactId: selectedArtifactId,
  };
}

type GenerateCroquiClientOptions = { data: TypedCroquiGenerationRequest };
type GenerateCroquiClientResult = {
  url: string;
  metadata: CroquiGenerationMetadata;
  executionId: string | null;
  artifactId: string | null;
  trackingStatus: "healthy" | "degraded";
};

const generateCroquiServerFn = createServerFn({ method: "POST" }).handler<
  Promise<GenerateCroquiClientResult>
>(async ({ data }: { data: unknown }) => {
  const request = parseCroquiGenerationRequest(data);
  const tracking = await failOpenOperationalAnalytics.startExecution({
    source: "manual",
    specification: request,
  });
  const formStep =
    (await tracking.execution?.startStep({ stage: "form_submission" })) || null;
  await formStep?.succeed({
    metadata: {
      fields: Object.keys(request).filter(
        (field) =>
          field !== "referenceImageUrls" && field !== "previousCroquiUrl",
      ),
    },
  });
  try {
    const result = await generateCroquiCandidates(request, tracking.execution);
    await tracking.execution?.complete();
    return {
      ...result,
      executionId: tracking.execution?.executionId || null,
      trackingStatus:
        tracking.execution?.trackingStatus || tracking.trackingStatus,
    };
  } catch (error) {
    const errorCode =
      error &&
      typeof error === "object" &&
      "errorCode" in error &&
      typeof (error as { errorCode?: unknown }).errorCode === "string"
        ? (error as { errorCode: string }).errorCode
        : "croqui_generation_failed";
    await tracking.execution?.fail(errorCode);
    throw error;
  }
});

// O compilador do TanStack precisa enxergar a chamada direta de createServerFn
// no inicializador. A asserção fica somente no alias tipado consumido pela UI;
// assim o build ainda extrai o handler para RPC e mantém o payload conhecido.
export const generateCroquiFn = generateCroquiServerFn as unknown as (
  options: GenerateCroquiClientOptions,
) => Promise<GenerateCroquiClientResult>;

function hexToColorDescription(hex: string): string {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) return hex;

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  const rNormal = r / 255;
  const gNormal = g / 255;
  const bNormal = b / 255;

  const max = Math.max(rNormal, gNormal, bNormal);
  const min = Math.min(rNormal, gNormal, bNormal);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rNormal) {
      h = ((gNormal - bNormal) / delta) % 6;
    } else if (max === gNormal) {
      h = (bNormal - rNormal) / delta + 2;
    } else {
      h = (rNormal - gNormal) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  let prefix = "";
  if (l < 0.3) prefix = "dark ";
  else if (l > 0.7) prefix = "light ";

  if (s < 0.08) {
    if (l < 0.12) return "matte black";
    if (l > 0.88) return "clean white";
    return "muted gray";
  }

  if (l < 0.08) return "deep charcoal black";
  if (l > 0.93) return "soft off-white";

  let colorName = "color";

  // Classificação rica baseada em Matiz (Hue), Saturação e Luminosidade
  if ((h >= 0 && h < 15) || (h >= 330 && h <= 360)) {
    if (l < 0.15) {
      prefix = "";
      colorName = "deep burgundy / wine-red";
    } else if (l < 0.35) {
      prefix = "";
      colorName = "rich maroon / bordeaux red";
    } else if (s > 0.7) colorName = "crimson red";
    else colorName = "rose red";
  } else if (h >= 15 && h < 45) {
    if (l < 0.15) {
      prefix = "";
      colorName = "deep espresso chocolate brown";
    } else if (l < 0.35) {
      prefix = "";
      colorName = "rich dark golden-brown (ochre / olive-gold)";
    } else if (s > 0.7) colorName = "terracotta orange";
    else colorName = "warm beige / tan";
  } else if (h >= 45 && h < 70) {
    if (l < 0.15) {
      prefix = "";
      colorName = "dark olive-bronze";
    } else if (l < 0.35) {
      prefix = "";
      colorName = "mustard gold / dark olive-gold";
    } else if (s > 0.7) colorName = "warm yellow / mustard yellow";
    else colorName = "creamy sand beige";
  } else if (h >= 70 && h < 150) {
    if (l < 0.15) {
      prefix = "";
      colorName = "deep forest green";
    } else if (l < 0.35) {
      prefix = "";
      colorName = "olive green";
    } else if (s > 0.7) colorName = "emerald green";
    else colorName = "sage green / pastel mint green";
  } else if (h >= 150 && h < 200) {
    if (l < 0.15) {
      prefix = "";
      colorName = "dark slate teal";
    } else if (l < 0.35) {
      prefix = "";
      colorName = "deep petrol teal";
    } else if (s > 0.7) colorName = "cyan blue / turquoise";
    else colorName = "pale aqua teal";
  } else if (h >= 200 && h < 255) {
    if (l < 0.15) {
      prefix = "";
      colorName = "deep midnight navy blue";
    } else if (l < 0.35) {
      prefix = "";
      colorName = "navy blue";
    } else if (s > 0.7) colorName = "royal blue";
    else colorName = "soft pastel blue";
  } else if (h >= 255 && h < 290) {
    if (l < 0.15) {
      prefix = "";
      colorName = "deep plum / eggplant purple";
    } else if (l < 0.35) {
      prefix = "";
      colorName = "grape purple / violet";
    } else if (s > 0.7) colorName = "vivid purple";
    else colorName = "soft lavender lilac";
  } else if (h >= 290 && h < 330) {
    if (l < 0.15) {
      prefix = "";
      colorName = "deep mulberry";
    } else if (l < 0.35) {
      prefix = "";
      colorName = "rich magenta";
    } else if (s > 0.7) colorName = "hot pink / fuchsia";
    else colorName = "soft blush pink";
  }

  return `${prefix}${colorName}`;
}

export const searchProductsFn: any = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: any }) => {
    const term = data?.term || "";
    const results = await searchProducts(term);
    return { results };
  },
);

export const generateRealistaFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: any }) => {
  const tracking = data.executionId
    ? await failOpenOperationalAnalytics.resumeExecution(data.executionId)
    : await failOpenOperationalAnalytics.startExecution({
        source: "manual",
        specification: data,
      });
  const generationStep =
    (await tracking.execution?.startStep({ stage: "realistic_generation" })) ||
    null;
  try {
    const {
      peca,
      cor,
      userImageUrl,
      croquiUrl,
      modo,
      biotipo,
      comprimento,
      decote,
      manga,
      possuiManga,
      saia,
      renda,
      comentario,
      tecidoImageUrl,
      tecidoPantone,
      tecidoSku,
      tecidoNome,
      ocasiao,
    } = data;

    const pecaEn = PECA_EN[peca as keyof typeof PECA_EN] || peca || "garment";
    const corEn = cor
      ? cor.startsWith("#")
        ? `${hexToColorDescription(cor)} color (hex: ${cor})`
        : CORES_EN[cor as keyof typeof CORES_EN] || cor
      : "a beautiful";

    let result: any;

    if (modo === "foto") {
      if (!userImageUrl) {
        throw new Error("Foto do usuário é obrigatória para este passo.");
      }

      const imageUrls = [userImageUrl, croquiUrl];
      let fabricInstruction = "";

      if (tecidoImageUrl) {
        imageUrls.push(tecidoImageUrl);
        fabricInstruction = `\nCRITICAL FABRIC REFERENCE: The THIRD image provided is a real fabric swatch photo (${tecidoNome || tecidoSku || "fabric"}). Dress the person in a ${pecaEn} made of THIS EXACT FABRIC. Transfer the fabric color, material texture, weave, pattern, and finish from the third image onto the garment.`;
      }

      const prompt = `CRITICAL: Reference images are provided.
The FIRST image shows a real person — preserve their exact face, identity, skin tone, hair, body shape, and natural pose with absolute fidelity. Do NOT alter their appearance.
The SECOND image shows a complete fashion croqui/sketch of the ${pecaEn}.${fabricInstruction}
Dress the person from the FIRST image in this exact ${pecaEn} design from the SECOND image${tecidoImageUrl ? " using the fabric from the THIRD image" : ` in ${corEn} color`}.
Transfer the garment with precision: preserve its design, silhouette, cut, and every construction detail.
The garment must drape naturally over the person's body, fitting their actual posture and proportions.
Keep the original background, lighting, and environment from the person's photo unchanged.
Result must look like a real editorial fashion photograph — photorealistic, sharp focus, high resolution.
${comentario ? `Extra design details and styling adjustments: ${comentario}\n` : ""}
The garment sits naturally on the body with realistic draping and proportions.
Do not add other people, do not change the subject's face or body.
No illustrations, no sketches, no cartoons.`;

      const providerStep = await tracking.execution?.startStep({
        stage: "realistic_provider_request",
        parentStepId: generationStep?.stepId || null,
        attempt: 1,
        promptVersion: "realista-foto-v1",
      });
      const providerTrace = createProviderCallTrace({
        phase: "Geração da foto realista da pessoa",
        operation: "fal-ai/bytedance/seedream/v4/edit",
        references: [
          { role: "customer_photo", source: "customer_photo", value: userImageUrl },
          { role: "croqui", source: "generated_artifact", value: croquiUrl },
          ...(tecidoImageUrl
            ? [{ role: "fabric", source: "fabric" as const, value: tecidoImageUrl }]
            : []),
        ],
        templateVersion: "realista-foto-v1",
        template: prompt,
        requestSummary: {
          mode: "foto",
          imageCount: imageUrls.length,
          imageSize: "square_hd",
          numImages: 1,
          safetyCheckerEnabled: false,
        },
      });

      try {
        result = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
          input: {
            prompt,
            image_urls: imageUrls,
            image_size: "square_hd",
            num_images: 1,
            enable_safety_checker: false,
          },
        });
        await providerStep?.succeed({
          provider: "fal",
          model: "seedream-v4",
          metadata: {
            ...providerTrace,
            responseSummary: providerResponseSummary({ outputImageCount: 1 }),
          },
        });
      } catch (error) {
        await providerStep?.fail("realistic_provider_request_failed", {
          provider: "fal",
          model: "seedream-v4",
          metadata: providerTrace,
        });
        console.error("[REALISTA FOTO] Error generating:", error);
        throw error;
      }
    } else {
      // Modo Manequim (gera a foto realista a partir do croqui de referência)
      const mannequinUrl = getMannequinUrl(biotipo);

      const comprimentoEn = comprimento
        ? COMPRIMENTO_EN[comprimento as keyof typeof COMPRIMENTO_EN] ||
          comprimento
        : "";
      const elementFragment = buildCatalogElementPromptFragment({
        decote,
        manga,
        possuiManga,
        saia,
        renda: data.rendaDecisao === false ? null : renda,
        peca,
      });
      const isBottom = isBottomGarment(pecaEn, peca || "");
      const isTop = isTopGarment(pecaEn, peca || "");
      const hemInstruction = comprimento
        ? COMPRIMENTO_HEM[comprimento as keyof typeof COMPRIMENTO_HEM] || ""
        : "";
      const sleevelessInstruction = buildSleevelessInstruction(
        decote,
        possuiManga === false ? "Sem Manga" : manga,
      );

      let garmentTypeInstruction = "";
      if (isBottom) {
        garmentTypeInstruction = `IMPORTANT: This is a BOTTOM garment ONLY — a ${pecaEn}. Do NOT include any top, blouse, shirt, or upper body clothing. Show ONLY the ${pecaEn} from waistband to hem on the mannequin.\n${hemInstruction}`;
      } else if (isTop) {
        garmentTypeInstruction = `IMPORTANT: This is a TOP garment ONLY — a ${pecaEn}. Do NOT include any skirt, pants, dress, or lower body clothing. Show ONLY the ${pecaEn} from neckline to the hem at the waist/hips on the mannequin. The lower body of the mannequin must be completely bare.`;
      } else {
        garmentTypeInstruction = `Present the garment from the front, fully visible from neckline/collar to hem, showing the complete silhouette clearly: neckline, sleeves, body fit, waistline, and hem.\n${hemInstruction}`;
      }

      const lengthPrefix = comprimentoEn ? `${comprimentoEn} ` : "";
      const bgInstruction = getBackgroundInstruction(ocasiao);
      const mannequinSurfaceInstruction = mannequinUrl
        ? buildMannequinSurfaceInstruction()
        : "";
      const fabricVisionModel =
        process.env.FAL_VISION_MODEL || "google/gemini-2.5-flash";

      if (
        process.env.REALISTA_FABRIC_PIPELINE_V1 === "true" &&
        tecidoImageUrl
      ) {
        try {
          const pipeline = await runFabricPipeline({
            client: fal,
            execution: tracking.execution,
            parentStepId: generationStep?.stepId || null,
            visionModel: fabricVisionModel,
            croquiUrl,
            tecidoImageUrl,
            tecidoSku,
            tecidoNome,
            pecaEn,
            mannequinUrl,
            background: bgInstruction,
            elementFragment,
            garmentTypeInstruction,
            sleevelessInstruction,
            mannequinSurfaceInstruction,
            comentario,
            evaluate: (candidates, context) =>
              evaluateFabricCandidates({
                client: fal,
                normalizedFabricUrl: context.normalizedFabricUrl,
                intermediateUrl: context.intermediateUrl,
                candidates,
                model: fabricVisionModel,
              }),
          });

          result = { images: [{ url: pipeline.url }] };
          console.info("[REALISTA TECIDO V1] Seleção concluída:", {
            tecidoSku: tecidoSku || null,
            generationModel: "fal-ai/bytedance/seedream/v4/edit",
            visionModel: fabricVisionModel,
            seeds: pipeline.seeds,
            selectedVariant: pipeline.selected.index,
            scores: pipeline.candidates.map((candidate) => ({
              index: candidate.index,
              score: scoreFabricCandidate(candidate.scores),
            })),
          });
        } catch (error) {
          console.warn(
            "[REALISTA TECIDO V1] Falhou; usando geração legada:",
            error,
          );
        }
      }

      if (!result) {
        // Monta array de imagens: [manequim?, croqui, tecido?]
        const imageUrls: string[] = [];
        if (mannequinUrl) imageUrls.push(mannequinUrl);
        imageUrls.push(croquiUrl);

        let fabricInstruction = "";
        let mannequinRef = "";
        let croquiRef = "";

        if (mannequinUrl) {
          mannequinRef = `IMAGE 1 is a photorealistic dressmaking mannequin — it defines the exact body shape, silhouette and proportions to preserve.\nIMAGE 2 is a hand-drawn fashion croqui sketch of a ${lengthPrefix}${pecaEn}.`;
          if (tecidoImageUrl) {
            imageUrls.push(tecidoImageUrl);
            croquiRef = `IMAGE 3 is a real fabric swatch (${tecidoNome || tecidoSku || "fabric"}).`;
            fabricInstruction = `\nCRITICAL FABRIC: Use the EXACT color, texture, pattern and material finish from IMAGE 3 to dress the garment.`;
          } else {
            fabricInstruction = `\nDress the garment in ${corEn} color.`;
          }
        } else {
          // fallback sem manequim de referência
          mannequinRef = `IMAGE 1 is a hand-drawn fashion croqui sketch of a ${lengthPrefix}${pecaEn}.`;
          if (tecidoImageUrl) {
            imageUrls.push(tecidoImageUrl);
            croquiRef = `IMAGE 2 is a real fabric swatch (${tecidoNome || tecidoSku || "fabric"}).`;
            fabricInstruction = `\nCRITICAL FABRIC: Use the EXACT color, texture, pattern and material finish from IMAGE 2.`;
          } else {
            fabricInstruction = `\nConvert this flat sketch into a photorealistic, ready-to-wear finished garment in ${corEn} color, worn on a headless featureless dress mannequin.`;
          }
        }

        const prompt = mannequinUrl
          ? `CRITICAL: ${mannequinUrl ? String(imageUrls.length) : "1"} reference images are provided.
${mannequinRef}${croquiRef ? "\n" + croquiRef : ""}
TASK: Dress the mannequin from IMAGE 1 with the exact garment shown in IMAGE 2.${fabricInstruction}
${sleevelessInstruction}${garmentTypeInstruction}
${elementFragment}
${mannequinSurfaceInstruction}
Maintain absolute fidelity to the mannequin body shape and proportions from IMAGE 1.
Maintain high fidelity to the cut, shape, style and construction of the garment from IMAGE 2.
The final result must look like a professional editorial fashion photograph with soft natural studio lighting and ${bgInstruction}, showing the real fabric texture.
${comentario ? `Extra design details: ${comentario}\n` : ""}
No face, no person, just the mannequin with the garment. No text, no watermark, no illustration, no sketch, no cartoon, no flat drawing.`
          : `${sleevelessInstruction}${garmentTypeInstruction}
CRITICAL: The first reference image is a hand-drawn fashion design croqui sketch of a ${lengthPrefix}${pecaEn}.${elementFragment}${fabricInstruction}
Maintain high fidelity to the cut, shape, style and construction shown in the reference sketch.
The final result must look like a professional editorial fashion photograph with soft natural studio lighting and ${bgInstruction}, showing the real fabric texture.
${comentario ? `Extra design details: ${comentario}\n` : ""}
No face, no person, just the mannequin with the garment. No text, no watermark, no illustration, no sketch, no cartoon, no flat drawing.`;

        const providerStep = await tracking.execution?.startStep({
          stage: "realistic_provider_request",
          parentStepId: generationStep?.stepId || null,
          attempt: 1,
          promptVersion: "realista-manequim-v1",
        });
        const providerTrace = createProviderCallTrace({
          phase: "Geração da foto realista do manequim",
          operation: "fal-ai/bytedance/seedream/v4/edit",
          references: [
            ...(mannequinUrl
              ? [{ role: "mannequin", source: "mannequin" as const, value: mannequinUrl }]
              : []),
            { role: "croqui", source: "generated_artifact", value: croquiUrl },
            ...(tecidoImageUrl
              ? [{ role: "fabric", source: "fabric" as const, value: tecidoImageUrl }]
              : []),
          ],
          templateVersion: "realista-manequim-v1",
          template: prompt,
          requestSummary: {
            mode: "manequim",
            imageCount: imageUrls.length,
            imageSize: "square_hd",
            numImages: 1,
            safetyCheckerEnabled: false,
          },
        });

        try {
          result = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
            input: {
              prompt,
              image_urls: imageUrls,
              image_size: "square_hd",
              num_images: 1,
              enable_safety_checker: false,
            },
          });
          await providerStep?.succeed({
            provider: "fal",
            model: "seedream-v4",
            metadata: {
              ...providerTrace,
              responseSummary: providerResponseSummary({ outputImageCount: 1 }),
            },
          });
        } catch (error) {
          await providerStep?.fail("realistic_provider_request_failed", {
            provider: "fal",
            model: "seedream-v4",
            metadata: providerTrace,
          });
          console.error("[REALISTA MANEQUIM] Error generating:", error);
          throw error;
        }
      }
    }

    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image returned from Fal.ai");

    await generationStep?.succeed({
      provider: "fal",
      model: "seedream-v4",
      metadata: {
        modo: modo || "manequim",
        fabricPipeline:
          process.env.REALISTA_FABRIC_PIPELINE_V1 === "true" &&
          Boolean(tecidoImageUrl),
      },
    });
    let artifactId: string | null = null;
    if (tracking.execution) {
      const storageStep = await tracking.execution.startStep({
        stage: "generated_artifact_storage",
        parentStepId: generationStep?.stepId || null,
      });
      let stored: {
        storageBucket: string;
        storagePath: string;
        mimeType: string;
      } | null = null;
      try {
        const assets = getExecutionAssetStore();
        if (!assets) throw new Error("storage_unavailable");
        stored = await assets.saveGeneratedImage({
          executionId: tracking.execution.executionId,
          kind: "realistic",
          sourceUrl: imageUrl,
        });
        await storageStep?.succeed({ provider: "supabase", model: "storage" });
      } catch {
        await storageStep?.fail("generated_artifact_storage_failed");
      }
      const artifact = await tracking.execution.recordArtifact({
        kind: "realistic",
        selected: true,
        stepId: generationStep?.stepId || null,
        sourceUrl: null,
        storageBucket: stored?.storageBucket || null,
        storagePath: stored?.storagePath || null,
        mimeType: stored?.mimeType || null,
        status: stored ? "available" : "storage_failed",
        retentionDays: 90,
      });
      artifactId = artifact?.artifactId || null;
      await tracking.execution.complete();
    }
    return {
      url: imageUrl,
      executionId: tracking.execution?.executionId || data.executionId || null,
      artifactId,
      trackingStatus:
        tracking.execution?.trackingStatus || tracking.trackingStatus,
    };
  } catch (error) {
    await generationStep?.fail("realistic_generation_failed");
    await tracking.execution?.fail("realistic_generation_failed");
    throw error;
  }
});

export const saveLookDbFn: any = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: any }) => {
    const tracking = await failOpenOperationalAnalytics.resumeExecution(
      data.execution_id,
    );
    const persistenceStep =
      (await tracking.execution?.startStep({ stage: "persistence" })) || null;
    try {
      const id = await saveLook(data);
      await persistenceStep?.succeed({ provider: "postgres", model: "looks" });
      await tracking.execution?.complete();
      return { id };
    } catch (error) {
      await persistenceStep?.fail("persistence_failed");
      await tracking.execution?.fail("persistence_failed");
      console.error("[DB] Error saving look:", error);
      throw error;
    }
  },
);

export const updateLookDbFn: any = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: any }) => {
    const tracking = await failOpenOperationalAnalytics.resumeExecution(
      data.execution_id || data.update?.execution_id,
    );
    const persistenceStep =
      (await tracking.execution?.startStep({ stage: "persistence" })) || null;
    try {
      await updateLook(data.id, data.update);
      await persistenceStep?.succeed({ provider: "postgres", model: "looks" });
      await tracking.execution?.complete();
      return { success: true };
    } catch (error) {
      await persistenceStep?.fail("persistence_failed");
      await tracking.execution?.fail("persistence_failed");
      console.error("[DB] Error updating look:", error);
      throw error;
    }
  },
);

export const rateArtifactFn: any = createServerFn({ method: "POST" }).handler(
  async ({ data }: any) => {
    const artifactId =
      typeof data?.artifactId === "string" ? data.artifactId : "";
    const executionId =
      typeof data?.executionId === "string" ? data.executionId : undefined;
    const score = Number(data?.score);
    if (!artifactId || !Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error("Informe uma nota entre 1 e 5 estrelas.");
    }
    await operationalAnalytics.rateArtifact({ artifactId, executionId, score });
    return { success: true, score };
  },
);

export const sendWhatsAppLookFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: any }) => {
  const {
    nome,
    telefone,
    croquiUrl,
    realistaUrl,
    peca,
    ocasiao,
    tipoCerimonia,
    rendaDecisao,
    biotipo,
    comprimento,
    decote,
    manga,
    possuiManga,
    saia,
    renda,
    cor,
    comentario,
  } = data;

  const evolutionUrl =
    process.env.EVOLUTION_API_URL || import.meta.env.EVOLUTION_API_URL || "";
  const evolutionInstance =
    process.env.EVOLUTION_INSTANCE || import.meta.env.EVOLUTION_INSTANCE || "";
  const evolutionKey =
    process.env.EVOLUTION_API_KEY || import.meta.env.EVOLUTION_API_KEY || "";

  if (!evolutionUrl || !evolutionInstance || !evolutionKey) {
    console.error("[WPP] Evolution API credentials are missing!");
    throw new Error("Evolution API credentials not configured on the server.");
  }

  const cleanPhone = (phone: string) => {
    const num = phone.replace(/\D/g, "");
    return num.startsWith("55") && num.length >= 12 ? num : `55${num}`;
  };

  const targetNumber = cleanPhone(telefone);
  const baseUrl = evolutionUrl.replace(/\/$/, "");
  const headers = {
    apikey: evolutionKey,
    "Content-Type": "application/json",
  };

  try {
    // 1. Send introductory text message
    const textMsg = `Olá, ${nome}! Seguem as imagens da sua criação na C&N Tecidos. Ficamos muito felizes em fazer parte da sua jornada de moda! 👗✨`;
    await fetch(`${baseUrl}/message/sendText/${evolutionInstance}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: targetNumber,
        text: textMsg,
        delay: 1000,
      }),
    });

    // 2. Send Croqui image
    await fetch(`${baseUrl}/message/sendMedia/${evolutionInstance}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: targetNumber,
        mediatype: "image",
        mimetype: "image/jpeg",
        caption: "Aqui está o croqui do seu look personalizado! 🎨",
        media: croquiUrl,
      }),
    });

    // 3. Send Realistic image if available
    if (realistaUrl) {
      await fetch(`${baseUrl}/message/sendMedia/${evolutionInstance}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: targetNumber,
          mediatype: "image",
          mimetype: "image/jpeg",
          caption: "Aqui está a visualização realista da sua peça! ✨",
          media: realistaUrl,
        }),
      });
    }

    // Integração do CRM Supabase (Projeto zynk)
    try {
      const orgId = process.env.CN_ORGANIZATION_ID;
      if (!orgId) {
        throw new Error("CN_ORGANIZATION_ID não configurado no ambiente.");
      }
      if (!crmSupabase) {
        throw new Error("Supabase do CRM não configurado no ambiente.");
      }
      const phone = targetNumber;

      // 1. Garantir contato na tabela crm_contacts
      let contactId: string | null = null;
      const resCont = await crmSupabase
        .from("crm_contacts")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("phone", phone);

      if (resCont.error) {
        console.error("[CRM] Erro ao buscar contato:", resCont.error);
      }

      if (resCont.data && resCont.data.length > 0) {
        contactId = resCont.data[0].id;
        if (
          resCont.data[0].name.startsWith("Paciente") ||
          !resCont.data[0].name
        ) {
          const upRes = await crmSupabase
            .from("crm_contacts")
            .update({ name: nome })
            .eq("id", contactId);
          if (upRes.error) {
            console.error(
              "[CRM] Erro ao atualizar nome do contato:",
              upRes.error,
            );
          }
        }
      } else {
        const insCont = await crmSupabase
          .from("crm_contacts")
          .insert({
            organization_id: orgId,
            phone: phone,
            name: nome,
            status: "lead",
          })
          .select("id")
          .single();
        if (insCont.error) {
          console.error("[CRM] Erro ao criar contato:", insCont.error);
        }
        if (insCont.data) {
          contactId = insCont.data.id;
        }
      }

      if (contactId) {
        // 2. Garantir estágio crm_stages "Criador de Looks"
        const stageName = "Criador de Looks";
        let stageId: string | null = null;

        const resStages = await crmSupabase
          .from("crm_stages")
          .select("id, name, position")
          .eq("organization_id", orgId);

        if (resStages.error) {
          console.error("[CRM] Erro ao buscar estágios:", resStages.error);
        }

        const stages = resStages.data || [];
        const targetStage = stages.find(
          (s) => s.name.toLowerCase() === stageName.toLowerCase(),
        );

        if (targetStage) {
          stageId = targetStage.id;
        } else {
          const maxPos = Math.max(...stages.map((s) => s.position || 0), 0);
          const insStage = await crmSupabase
            .from("crm_stages")
            .insert({
              organization_id: orgId,
              name: stageName,
              color: "#10b981", // Verde esmeralda
              position: maxPos + 1,
              probability: 80,
            })
            .select("id")
            .single();
          if (insStage.error) {
            console.error(
              "[CRM] Erro ao criar estágio 'Criador de Looks':",
              insStage.error,
            );
          }
          if (insStage.data) {
            stageId = insStage.data.id;
          }
        }

        if (stageId) {
          // 3. Verificar duplicidade de Deal no mesmo estágio
          const resDupDeals = await crmSupabase
            .from("crm_deals")
            .select("id")
            .eq("contact_id", contactId)
            .eq("stage_id", stageId)
            .eq("status", "open");

          if (resDupDeals.error) {
            console.error(
              "[CRM] Erro ao buscar duplicidade de deals:",
              resDupDeals.error,
            );
          }

          const dealExists = resDupDeals.data && resDupDeals.data.length > 0;
          let dealId: string | null = null;

          if (!dealExists) {
            const dealTitle = `Look Criativo - ${peca || "Personalizado"}`;
            const insDeal = await crmSupabase
              .from("crm_deals")
              .insert({
                organization_id: orgId,
                contact_id: contactId,
                stage_id: stageId,
                title: dealTitle,
                value: 0.0,
                status: "open",
                position: 0,
                score: 0,
              })
              .select("id")
              .single();
            if (insDeal.error) {
              console.error("[CRM] Erro ao criar deal:", insDeal.error);
            }
            if (insDeal.data) {
              dealId = insDeal.data.id;

              const insAct = await crmSupabase.from("crm_activity").insert({
                deal_id: dealId,
                type: "deal_created",
                payload: { title: dealTitle },
              });
              if (insAct.error) {
                console.error(
                  "[CRM] Erro ao registrar crm_activity:",
                  insAct.error,
                );
              }
            }
          } else {
            dealId = resDupDeals.data[0].id;
          }

          if (dealId) {
            // 4. Inserir nota com os detalhes da peça gerada (histórico de look)
            const detailsList = [
              peca ? `Peça: ${peca}` : "",
              ocasiao ? `Ocasião: ${ocasiao}` : "",
              tipoCerimonia ? `Tipo Cerimônia: ${tipoCerimonia}` : "",
              rendaDecisao !== undefined && rendaDecisao !== null
                ? `Terá Renda: ${rendaDecisao ? "Sim" : "Não"}`
                : "",
              biotipo ? `Biotipo: ${biotipo}` : "",
              comprimento ? `Comprimento: ${comprimento}` : "",
              decote ? `Decote: ${decote}` : "",
              manga ? `Manga: ${manga}` : "",
              possuiManga === false ? "Sem manga" : "",
              saia ? `Saia: ${saia}` : "",
              renda ? `Renda: ${renda}` : "",
              cor ? `Cor: ${cor}` : "",
              comentario ? `Comentários: ${comentario}` : "",
            ]
              .filter(Boolean)
              .join("\n");

            const noteContent = `Look gerado pela IA:\n${detailsList}\n\nCroqui: ${croquiUrl}${realistaUrl ? `\nFoto Realista: ${realistaUrl}` : ""}`;

            const insNote = await crmSupabase.from("crm_notes").insert({
              organization_id: orgId,
              deal_id: dealId,
              contact_id: contactId,
              content: noteContent,
              author_type: "ai",
            });
            if (insNote.error) {
              console.error("[CRM] Erro ao criar nota do deal:", insNote.error);
            }
          }
        }
      }
    } catch (crmErr) {
      console.warn("[CRM] Erro ao registrar contato/negócio no CRM:", crmErr);
    }

    return { success: true };
  } catch (error) {
    console.error(
      "[WPP] Error sending WhatsApp message via Evolution API:",
      error,
    );
    throw error;
  }
});

export const createUploadSessionFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: any }) => {
  if (!REFERENCE_PIECES.includes(data.peca as ReferencePiece))
    throw new Error("Selecione o tipo de peça antes de criar a referência.");
  if (data.ocasiao === "Noiva" && data.peca !== "Vestido")
    throw new Error("Noiva aceita somente Vestido.");
  const tracking = await failOpenOperationalAnalytics.startExecution({
    source: "reference",
    specification: { ocasiao: data.ocasiao, peca: data.peca },
  });
  const formStep =
    (await tracking.execution?.startStep({ stage: "form_submission" })) || null;
  await formStep?.succeed({
    metadata: { fields: ["nomeCliente", "ocasiao", "peca"] },
  });
  const session = await createUploadSession(
    data.nomeCliente,
    data.ocasiao,
    data.peca as ReferencePiece,
    tracking.execution?.executionId || null,
  );
  return {
    session,
    trackingStatus:
      tracking.execution?.trackingStatus || tracking.trackingStatus,
  };
});

export const pollUploadSessionFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: any }) => {
  const session = await getUploadSession(data.sessionId);
  return { session };
});

export const confirmUploadFn: any = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: any }) => {
    await confirmUploadSession(data.sessionId, data.croquiUrl);
    return { success: true };
  },
);

async function uploadBase64ToStorage(
  fileBase64: string,
  path: string,
): Promise<string> {
  try {
    if (!operationalSupabase) {
      return fileBase64.startsWith("data:")
        ? fileBase64
        : `data:image/jpeg;base64,${fileBase64}`;
    }
    const buffer = Buffer.from(
      fileBase64.replace(/^data:image\/\w+;base64,/, ""),
      "base64",
    );
    const { error } = await operationalSupabase.storage
      .from("croqui-uploads")
      .upload(path, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.warn("[STORAGE] Falling back to base64 data URL:", error.message);
      return fileBase64.startsWith("data:")
        ? fileBase64
        : `data:image/jpeg;base64,${fileBase64}`;
    }

    const { data: publicUrlData } = operationalSupabase.storage
      .from("croqui-uploads")
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn("[STORAGE] Storage upload error, using base64 fallback:", err);
    return fileBase64.startsWith("data:")
      ? fileBase64
      : `data:image/jpeg;base64,${fileBase64}`;
  }
}

async function analyzeVisionWithTracking(input: {
  analyzer: {
    analyze: (request: VisionInput) => Promise<ReferenceVisionResult>;
    providerName: VisionProvider;
    modelName: string;
    lastAttempts: number;
  };
  request: VisionInput;
  execution: FailOpenTrackedExecution | null | undefined;
  parentStepId?: string | null;
  phase: string;
  references: ProviderReferenceInput[];
}): Promise<ReferenceVisionResult> {
  const operation =
    input.analyzer.providerName === "fal"
      ? "openrouter/router/vision"
      : "OpenAI Responses API";
  const step = await input.execution?.startStep({
    stage: "reference_vision_request",
    parentStepId: input.parentStepId || null,
    attempt: 1,
    promptVersion: REFERENCE_PROMPT_VERSION,
  });
  const trace = createProviderCallTrace({
    phase: input.phase,
    operation,
    references: input.references,
    templateVersion: REFERENCE_PROMPT_VERSION,
    template: input.request.prompt,
    requestSummary: {
      mode: input.request.mode,
      imageCount: input.request.imageDataUrls.length,
      targetPiece: input.request.targetPiece || null,
    },
  });
  try {
    const result = await input.analyzer.analyze(input.request);
    await step?.succeed({
      provider: input.analyzer.providerName,
      model: input.analyzer.modelName,
      metadata: {
        ...trace,
        responseSummary: providerResponseSummary({
          outputText: true,
          resultCount: 1,
          retryCount: Math.max(0, input.analyzer.lastAttempts - 1),
        }),
        providerExtrasCount: result.providerExtras.length,
      },
    });
    return result;
  } catch (error) {
    await step?.fail("vision_provider_error", {
      provider: input.analyzer.providerName,
      model: input.analyzer.modelName,
      metadata: {
        ...trace,
        diagnosticCode:
          error instanceof ReferenceVisionError
            ? error.diagnosticCode || null
            : null,
      },
    });
    throw error;
  }
}

async function analyzeReferenceImages(params: {
  mode: "single" | "composite";
  ocasiao?: string;
  targetPiece?: ReferencePiece | null;
  imageDataUrls: string[];
  detailImageDataUrls?: string[];
  execution?: FailOpenTrackedExecution | null;
  parentStepId?: string | null;
}): Promise<ReferenceVisionResult> {
  if (params.mode === "composite") {
    const roles = ["top", "bottom"] as const;
    const startedAt = Date.now();
    const parts = await Promise.all(
      roles.map(async (role, index) => {
        const analyzer = createReferenceVisionAnalyzer();
        const partStartedAt = Date.now();
        try {
          const prompt = buildVisionPromptForReferencePart(
            role,
            params.ocasiao,
            params.targetPiece,
          );
          const result = await analyzeVisionWithTracking({
            analyzer,
            execution: params.execution,
            parentStepId: params.parentStepId,
            phase: `Análise da parte ${role} da referência`,
            request: {
              mode: "single",
              occasion: params.ocasiao,
              targetPiece: params.targetPiece,
              imageDataUrls: [params.imageDataUrls[index]],
              prompt,
            },
            references: [{
              role: `reference_${role}`,
              source: "customer_crop",
              value: params.imageDataUrls[index],
            }],
          });
          const analysis = relabelReferenceAnalysisPart(result.analysis, role);
          console.info("[REFERENCE VISION] parte concluída", {
            model: analyzer.modelName,
            provider: analyzer.providerName,
            promptVersion: REFERENCE_PROMPT_VERSION,
            mode: "composite",
            role,
            imageCount: 1,
            durationMs: Date.now() - partStartedAt,
            retries: Math.max(0, analyzer.lastAttempts - 1),
            status: "success",
            responseContract:
              result.providerExtras.length > 0 ? "legacy-adapted" : "canonical",
            providerExtrasCount: result.providerExtras.length,
          });
          return { analysis, providerExtras: analysis.providerExtras || [] };
        } catch (error) {
          console.warn("[REFERENCE VISION] parte falhou", {
            model: analyzer.modelName,
            provider: analyzer.providerName,
            promptVersion: REFERENCE_PROMPT_VERSION,
            mode: "composite",
            role,
            imageCount: 1,
            durationMs: Date.now() - partStartedAt,
            retries: Math.max(0, analyzer.lastAttempts - 1),
            status: "error",
            code: errorCodeForVision(error),
            diagnosticCode:
              error instanceof ReferenceVisionError
                ? error.diagnosticCode
                : undefined,
          });
          throw error;
        }
      }),
    );
    // Segunda leitura conjunta evita costuras incompatíveis entre top e bottom.
    const reconciliationAnalyzer = createReferenceVisionAnalyzer();
    const reconciliationPrompt = buildVisionPromptForCompositeReference(
      params.ocasiao,
      params.targetPiece,
    );
    const reconciliation = await analyzeVisionWithTracking({
      analyzer: reconciliationAnalyzer,
      execution: params.execution,
      parentStepId: params.parentStepId,
      phase: "Reconciliação conjunta da referência",
      request: {
        mode: "composite",
        occasion: params.ocasiao,
        targetPiece: params.targetPiece,
        imageDataUrls: params.imageDataUrls,
        prompt: reconciliationPrompt,
      },
      references: params.imageDataUrls.map((value, index) => ({
        role: index === 0 ? "reference_top" : "reference_bottom",
        source: "customer_crop" as const,
        value,
      })),
    });
    const independent = mergeCompositeReferenceAnalyses({
      top: parts[0].analysis,
      bottom: parts[1].analysis,
      targetPiece: params.targetPiece,
    });
    let joint = independent;
    if (reconciliation.analysis.mode === "composite") {
      try {
        joint = validateReferenceAnalysisForMode(
          reconciliation.analysis,
          "composite",
        );
      } catch {
        // Reconciliação é melhoria, nunca pode invalidar duas leituras parciais válidas.
        joint = independent;
      }
    }
    const chooseObserved = <T extends { confidence: number }>(
      value: T,
      fallback: T,
    ): T => (value.confidence >= fallback.confidence ? value : fallback);
    const chooseJoint = <T extends keyof ReferenceAnalysis>(
      field: T,
    ): ReferenceAnalysis[T] =>
      chooseObserved(
        joint[field] as { confidence: number },
        independent[field] as { confidence: number },
      ) as ReferenceAnalysis[T];
    const jointDetails = joint.detalhesTecnicos;
    const independentDetails = independent.detalhesTecnicos;
    const analysis: ReferenceAnalysis = {
      ...independent,
      peca: chooseJoint("peca"),
      comprimento: chooseJoint("comprimento"),
      decote: chooseJoint("decote"),
      possuiManga: chooseJoint("possuiManga"),
      manga: chooseJoint("manga"),
      saia: chooseJoint("saia"),
      rendaDecisao: chooseJoint("rendaDecisao"),
      renda: chooseJoint("renda"),
      detalhesTecnicos: {
        corpete: chooseObserved(
          jointDetails.corpete,
          independentDetails.corpete,
        ),
        cintura: chooseObserved(
          jointDetails.cintura,
          independentDetails.cintura,
        ),
        caimento: chooseObserved(
          jointDetails.caimento,
          independentDetails.caimento,
        ),
        volume: chooseObserved(jointDetails.volume, independentDetails.volume),
        barra: chooseObserved(jointDetails.barra, independentDetails.barra),
        transparencia: chooseObserved(
          jointDetails.transparencia,
          independentDetails.transparencia,
        ),
        tecido: chooseObserved(jointDetails.tecido, independentDetails.tecido),
        costas: chooseObserved(jointDetails.costas, independentDetails.costas),
        fechamento: chooseObserved(
          jointDetails.fechamento,
          independentDetails.fechamento,
        ),
      },
      providerExtras: [
        ...(independent.providerExtras || []),
        ...(joint.providerExtras || []),
      ],
    };
    console.info("[REFERENCE VISION] composta concluída", {
      mode: "composite",
      imageCount: 2,
      durationMs: Date.now() - startedAt,
      status: "success",
      responseContract: "parallel-parts-merged",
      providerExtrasCount: analysis.providerExtras?.length || 0,
    });
    return { analysis, providerExtras: analysis.providerExtras || [] };
  }

  const analyzer = createReferenceVisionAnalyzer();
  const startedAt = Date.now();
  try {
    const primaryPrompt = buildVisionPromptForSingleReference(
      params.ocasiao,
      params.targetPiece,
    );
    const result = await analyzeVisionWithTracking({
      analyzer,
      execution: params.execution,
      parentStepId: params.parentStepId,
      phase: "Análise principal da referência",
      request: {
        mode: params.mode,
        occasion: params.ocasiao,
        targetPiece: params.targetPiece,
        imageDataUrls: params.imageDataUrls,
        prompt: primaryPrompt,
      },
      references: params.imageDataUrls.map((value) => ({
        role: "reference_primary",
        source: "customer_crop" as const,
        value,
      })),
    });
    let enrichedAnalysis = result.analysis;
    if (params.mode === "single" && params.detailImageDataUrls?.length) {
      const details = await Promise.all(
        params.detailImageDataUrls.map((detailImageDataUrl, index) => {
          const prompt = `${buildVisionPromptForSingleReference(params.ocasiao, params.targetPiece)}\nThis is a detail crop from the confirmed garment crop. Resolve small neckline, waist, skirt and hem details only.`;
          return analyzeVisionWithTracking({
            analyzer,
            execution: params.execution,
            parentStepId: params.parentStepId,
            phase: `Análise Vision do recorte de detalhe ${index + 1}`,
            request: {
              mode: "single",
              occasion: params.ocasiao,
              targetPiece: params.targetPiece,
              imageDataUrls: [detailImageDataUrl],
              prompt,
            },
            references: [{
              role: `reference_detail_${index + 1}`,
              source: "customer_crop",
              value: detailImageDataUrl,
            }],
          });
        }),
      );
      for (const detailResult of details) {
        const detail = detailResult.analysis;
        const fields = [
          "decote",
          "possuiManga",
          "manga",
          "saia",
          "rendaDecisao",
          "renda",
          "comprimento",
        ] as const;
        for (const field of fields) {
          if (
            detail[field].value !== null &&
            detail[field].confidence > enrichedAnalysis[field].confidence
          )
            enrichedAnalysis = { ...enrichedAnalysis, [field]: detail[field] };
        }
        enrichedAnalysis = {
          ...enrichedAnalysis,
          detalhesTecnicos: Object.fromEntries(
            Object.entries(enrichedAnalysis.detalhesTecnicos).map(
              ([key, current]) => {
                const candidate =
                  detail.detalhesTecnicos[
                    key as keyof typeof detail.detalhesTecnicos
                  ];
                return [
                  key,
                  candidate.value !== null &&
                  candidate.confidence > current.confidence
                    ? candidate
                    : current,
                ];
              },
            ),
          ) as ReferenceAnalysis["detalhesTecnicos"],
        };
      }
    }
    const enrichedResult = { ...result, analysis: enrichedAnalysis };
    const focusConfidence =
      enrichedResult.analysis.focus.reduce(
        (sum, focus) => sum + focus.confidence,
        0,
      ) / enrichedResult.analysis.focus.length;
    console.info("[REFERENCE VISION] concluída", {
      model: analyzer.modelName,
      provider: analyzer.providerName,
      promptVersion: REFERENCE_PROMPT_VERSION,
      mode: params.mode,
      imageCount: params.imageDataUrls.length,
      durationMs: Date.now() - startedAt,
      retries: Math.max(0, analyzer.lastAttempts - 1),
      status: "success",
      responseContract:
        enrichedResult.providerExtras.length > 0
          ? "legacy-adapted"
          : "canonical",
      providerExtrasCount: enrichedResult.providerExtras.length,
      focusConfidence,
    });
    return enrichedResult;
  } catch (error) {
    console.warn("[REFERENCE VISION] falhou", {
      model: analyzer.modelName,
      provider: analyzer.providerName,
      promptVersion: REFERENCE_PROMPT_VERSION,
      mode: params.mode,
      imageCount: params.imageDataUrls.length,
      durationMs: Date.now() - startedAt,
      retries: Math.max(0, analyzer.lastAttempts - 1),
      status: "error",
      code: errorCodeForVision(error),
      diagnosticCode:
        error instanceof ReferenceVisionError
          ? error.diagnosticCode
          : undefined,
    });
    throw error;
  }
}

export type AnalyzeReferenceRequest = {
  sessionId: string;
  mode: "single" | "composite";
  targetPiece: ReferencePiece;
  images: Array<{ role: "single" | "top" | "bottom"; dataUrl: string }>;
  detailCrops?: string[];
};

export type AnalyzeReferenceResponse =
  | {
      status: "uploaded" | "generation_failed";
      analysis: ReferenceAnalysis;
      croquiUrl?: string;
      metadata?: CroquiGenerationMetadata;
      code?: string;
      retryable?: boolean;
      message?: string;
    }
  | { status: "analysis_ready"; analysis: ReferenceAnalysis }
  | {
      status: "needs_recrop" | "unsupported_garment" | "analysis_failed";
      code: string;
      retryable: boolean;
      message: string;
    };

function errorCodeForVision(error: unknown): string {
  if (error instanceof ReferenceVisionError) return error.code;
  if (error instanceof ReferenceInputError) return error.code;
  return "vision_failed";
}

function configuredVisionMetadata(): {
  provider: VisionProvider;
  model: string;
} {
  const provider: VisionProvider =
    process.env.VISION_PROVIDER === "openai" ? "openai" : "fal";
  return { provider, model: resolveVisionModel(provider) };
}

async function ensureReferenceTracking(session: UploadSession): Promise<{
  execution: FailOpenTrackedExecution | null;
  trackingStatus: "healthy" | "degraded";
}> {
  if (session.execution_id)
    return failOpenOperationalAnalytics.resumeExecution(session.execution_id);
  const tracking = await failOpenOperationalAnalytics.startExecution({
    source: "reference",
    specification: { ocasiao: session.ocasiao, peca: session.reference_piece },
  });
  if (tracking.execution) {
    session.execution_id = tracking.execution.executionId;
    await updateUploadSession(session.id, {
      executionId: tracking.execution.executionId,
    });
  }
  return tracking;
}

async function retainReferenceCrops(
  execution: FailOpenTrackedExecution | null,
  images: Array<{ role: "single" | "top" | "bottom"; dataUrl: string }>,
): Promise<void> {
  if (!execution) return;
  const assets = getExecutionAssetStore();
  for (const image of images) {
    const storageStep = await execution.startStep({
      stage: "reference_crop_storage",
    });
    try {
      if (!assets) throw new Error("storage_unavailable");
      const stored = await assets.saveReferenceCrop({
        executionId: execution.executionId,
        role: image.role,
        dataUrl: image.dataUrl,
      });
      await execution.recordArtifact({
        kind: "reference_crop",
        stepId: storageStep?.stepId || null,
        storageBucket: stored.storageBucket,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
        metadata: {
          role: image.role,
          anonymized: true,
          referenceDigest: providerReferenceDigest(image.dataUrl),
        },
        retentionDays: 30,
      });
      await storageStep?.succeed({
        provider: "supabase",
        model: "storage",
        metadata: { role: image.role },
      });
    } catch {
      await execution.recordArtifact({
        kind: "reference_crop",
        stepId: storageStep?.stepId || null,
        status: "storage_failed",
        metadata: {
          role: image.role,
          anonymized: true,
          referenceDigest: providerReferenceDigest(image.dataUrl),
        },
        retentionDays: 30,
      });
      await storageStep?.fail("reference_storage_failed");
    }
  }
}

async function loadRetainedReferenceImages(
  session: UploadSession,
): Promise<string[]> {
  if (!session.execution_id) return [];
  const assets = getExecutionAssetStore();
  if (!assets) return [];
  try {
    const detail = await operationalAnalytics.getExecutionDetail(
      session.execution_id,
    );
    if (!detail) return [];
    const latestByRole = new Map<string, (typeof detail.artifacts)[number]>();
    for (const artifact of detail.artifacts) {
      const role =
        typeof artifact.metadata.role === "string"
          ? artifact.metadata.role
          : null;
      if (
        artifact.kind === "reference_crop" &&
        artifact.status === "available" &&
        artifact.storagePath &&
        role
      )
        latestByRole.set(role, artifact);
    }
    const roles =
      session.reference_analysis?.mode === "composite"
        ? ["top", "bottom"]
        : ["single"];
    const primary = (
      await Promise.all(
        roles.map(async (role) => {
          const artifact = latestByRole.get(role);
          return artifact?.storagePath
            ? assets.loadReferenceCrop(artifact.storagePath)
            : null;
        }),
      )
    ).filter((value): value is string => Boolean(value));
    if (session.reference_analysis?.mode !== "single" || primary.length !== 1)
      return primary;
    try {
      return [...primary, ...(await deriveGarmentDetailDataUrls(primary[0]))];
    } catch {
      return primary;
    }
  } catch {
    return [];
  }
}

export const uploadReferenceFilesFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: any }) => {
  const {
    sessionId,
    ocasiao,
    singleFileBase64,
    topFileBase64,
    bottomFileBase64,
  } = data;
  const mode =
    data.mode === "composite"
      ? "composite"
      : data.mode === "single"
        ? "single"
        : null;

  const currentSession = await getUploadSession(sessionId);
  if (!currentSession || currentSession.status === "expired")
    throw new Error("Sessão de referência expirada ou inexistente.");
  if (
    !["pending", "needs_recrop", "analysis_failed"].includes(
      currentSession.status,
    )
  ) {
    throw new Error("Esta sessão não aceita um novo recorte neste estado.");
  }
  const occasion =
    typeof ocasiao === "string" && ocasiao.trim()
      ? ocasiao
      : currentSession.ocasiao || undefined;
  const visionMetadata = configuredVisionMetadata();
  const tracking = await ensureReferenceTracking(currentSession);
  let uploadStep: FailOpenTrackedStep | null = null;
  let visionStep: FailOpenTrackedStep | null = null;

  try {
    uploadStep =
      (await tracking.execution?.startStep({ stage: "reference_upload" })) ||
      null;
    if (!mode)
      throw new ReferenceInputError(
        "invalid_count",
        "Modo de referência inválido.",
      );
    const submittedImages: unknown[] = Array.isArray(data.images)
      ? data.images
      : mode === "composite"
        ? [
            { role: "top", dataUrl: topFileBase64 },
            { role: "bottom", dataUrl: bottomFileBase64 },
          ]
        : [{ role: "single", dataUrl: singleFileBase64 }];
    const validatedImages = validateReferenceImages(mode, submittedImages);
    const imageDataUrls = validatedImages.map((image) => image.dataUrl);
    const detailImageDataUrls =
      mode === "single" && Array.isArray(data.detailCrops)
        ? data.detailCrops
            .map((value: unknown) => validateReferenceDataUrl(value).dataUrl)
            .slice(0, 3)
        : [];
    await retainReferenceCrops(tracking.execution, validatedImages);
    await uploadStep?.succeed({
      metadata: {
        mode,
        primaryImageCount: imageDataUrls.length,
        derivedDetailCount: detailImageDataUrls.length,
      },
    });
    await updateUploadSessionStatus(sessionId, "analyzing");
    visionStep =
      (await tracking.execution?.startStep({
        stage: "reference_vision",
        promptVersion: REFERENCE_PROMPT_VERSION,
      })) || null;
    const visionResult = await analyzeReferenceImages({
      mode,
      ocasiao: occasion,
      targetPiece: currentSession.reference_piece,
      imageDataUrls,
      detailImageDataUrls,
      execution: tracking.execution,
      parentStepId: visionStep?.stepId || null,
    });
    const analysis = validateReferenceAnalysisForMode(
      visionResult.analysis,
      mode,
    );
    const decision = decideReferenceAnalysis(
      analysis,
      currentSession.reference_piece,
    );
    await visionStep?.succeed({
      provider: visionMetadata.provider,
      model: visionMetadata.model,
      metadata: {
        mode,
        decision: decision.status,
        code: decision.code,
        primaryImageCount: imageDataUrls.length,
        derivedDetailCount: detailImageDataUrls.length,
      },
    });
    console.info("[REFERENCE ANALYSIS] decisão", {
      status: decision.status,
      code: decision.code,
      provider: visionMetadata.provider,
      model: visionMetadata.model,
      promptVersion: REFERENCE_PROMPT_VERSION,
      focusConfidence:
        analysis.focus.reduce((sum, focus) => sum + focus.confidence, 0) /
        analysis.focus.length,
    });
    await updateUploadSession(sessionId, {
      status: decision.status,
      referenceAnalysis: analysis,
      analysisErrorCode: decision.code,
      visionProvider: visionMetadata.provider,
      visionModel: visionMetadata.model,
      promptVersion: REFERENCE_PROMPT_VERSION,
    });
    if (decision.status !== "analysis_ready")
      return {
        status: decision.status,
        code: decision.code,
        retryable: decision.retryable,
        message: decision.message,
        executionId:
          tracking.execution?.executionId ||
          currentSession.execution_id ||
          null,
        trackingStatus:
          tracking.execution?.trackingStatus || tracking.trackingStatus,
      };
    try {
      const generated = await generateReferenceCroqui(
        sessionId,
        [...imageDataUrls, ...detailImageDataUrls],
        tracking.execution,
      );
      return {
        status: "uploaded",
        analysis: generated.analysis,
        croquiUrl: generated.croquiUrl,
        metadata: generated.metadata,
        executionId: generated.executionId,
        artifactId: generated.artifactId,
        trackingStatus: generated.trackingStatus,
      };
    } catch {
      // A análise continua persistida; geração pode ser repetida sem chamar Vision novamente.
      console.warn("[REFERENCE ANALYSIS] geração automática falhou:", {
        code: "generation_failed",
      });
      return {
        status: "generation_failed",
        analysis,
        code: "generation_failed",
        retryable: true,
        message:
          "A referência foi analisada, mas o croqui não pôde ser gerado. Tente novamente no totem.",
        executionId:
          tracking.execution?.executionId ||
          currentSession.execution_id ||
          null,
        trackingStatus:
          tracking.execution?.trackingStatus || tracking.trackingStatus,
      };
    }
  } catch (error) {
    const code = errorCodeForVision(error);
    if (visionStep) await visionStep.fail(code);
    else await uploadStep?.fail(code);
    // O erro pode conter detalhes do provedor ou ecoar parte da requisição.
    // Persistimos/logamos somente o código controlado para não expor conteúdo da imagem.
    console.error("[REFERENCE ANALYSIS] Vision falhou:", {
      code,
      diagnosticCode:
        error instanceof ReferenceVisionError
          ? error.diagnosticCode
          : undefined,
    });
    await updateUploadSession(sessionId, {
      status: "analysis_failed",
      analysisErrorCode: code,
      visionProvider: visionMetadata.provider,
      visionModel: visionMetadata.model,
      promptVersion: REFERENCE_PROMPT_VERSION,
    });
    return {
      status: "analysis_failed",
      code,
      retryable:
        error instanceof ReferenceVisionError
          ? error.retryable
          : error instanceof ReferenceInputError,
      message:
        "Não foi possível analisar os recortes. Tente selecionar e recortar novamente.",
      executionId:
        tracking.execution?.executionId || currentSession.execution_id || null,
      trackingStatus:
        tracking.execution?.trackingStatus || tracking.trackingStatus,
    };
  }
});

async function generateReferenceCroqui(
  sessionId: string,
  referenceImageUrls: string[] = [],
  existingExecution: FailOpenTrackedExecution | null = null,
): Promise<{
  croquiUrl: string;
  analysis: ReferenceAnalysis;
  metadata?: CroquiGenerationMetadata;
  executionId: string | null;
  artifactId: string | null;
  trackingStatus: "healthy" | "degraded";
}> {
  const claimed = await claimUploadSessionForGeneration(sessionId);
  const session = await getUploadSession(sessionId);
  if (!session) throw new Error("Sessão de referência não encontrada.");
  if (
    session.status === "uploaded" &&
    session.croqui_url &&
    session.reference_analysis
  )
    return {
      croquiUrl: session.croqui_url,
      analysis: session.reference_analysis,
      executionId: session.execution_id || null,
      artifactId: session.croqui_artifact_id || null,
      trackingStatus: session.execution_id ? "healthy" : "degraded",
    };
  if (!claimed || !session.reference_analysis)
    throw new Error(
      "A análise da referência ainda não está pronta para confirmação.",
    );
  const tracking = existingExecution
    ? {
        execution: existingExecution,
        trackingStatus: existingExecution.trackingStatus,
      }
    : await ensureReferenceTracking(session);

  const generationStartedAt = Date.now();
  try {
    const analysis = validateReferenceAnalysisForMode(
      session.reference_analysis,
      session.reference_analysis.mode,
    );
    const specs = referenceAnalysisToCroquiSpecs(
      analysis,
      session.ocasiao || undefined,
    );
    const decision = decideReferenceAnalysis(analysis, session.reference_piece);
    if (decision.status !== "analysis_ready")
      throw new Error(
        decision.message || "A análise da referência não está pronta.",
      );
    const generated = await generateCroquiCandidates(
      {
        ...specs,
        referenceAnalysis: analysis,
        referenceImageUrls,
        ocasiao: session.ocasiao || undefined,
      },
      tracking.execution,
    );
    const croquiUrl = generated.url;
    console.info("[REFERENCE GENERATION] concluída", {
      model: CROQUI_GENERATOR,
      promptVersion: CROQUI_PROMPT_VERSION,
      durationMs: Date.now() - generationStartedAt,
      status: "success",
      candidateCount: generated.metadata.candidates.length,
    });
    await updateUploadSession(sessionId, {
      status: "uploaded",
      croquiUrl,
      referenceAnalysis: analysis,
      generationProvider: "fal",
      generationModel: CROQUI_GENERATOR,
      generationPromptVersion: CROQUI_PROMPT_VERSION,
      generationCandidates: generated.metadata.candidates,
      specification: specs as unknown as JsonObject,
      executionId:
        tracking.execution?.executionId || session.execution_id || null,
      croquiArtifactId: generated.artifactId,
    });
    await tracking.execution?.complete();
    return {
      croquiUrl,
      analysis,
      metadata: generated.metadata,
      executionId:
        tracking.execution?.executionId || session.execution_id || null,
      artifactId: generated.artifactId,
      trackingStatus:
        tracking.execution?.trackingStatus || tracking.trackingStatus,
    };
  } catch (error) {
    console.warn("[REFERENCE GENERATION] falhou", {
      model: CROQUI_GENERATOR,
      promptVersion: CROQUI_PROMPT_VERSION,
      durationMs: Date.now() - generationStartedAt,
      status: "error",
      code: "generation_failed",
    });
    await updateUploadSession(sessionId, {
      status: "generation_failed",
      analysisErrorCode: "generation_failed",
      generationProvider: "fal",
      generationModel: CROQUI_GENERATOR,
      generationPromptVersion: CROQUI_PROMPT_VERSION,
      generationCandidates:
        (error as Error & { metadata?: CroquiGenerationMetadata }).metadata
          ?.candidates || null,
    });
    await tracking.execution?.fail("reference_croqui_generation_failed");
    throw error;
  }
}

export const confirmReferenceGenerationFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: any }) => {
  const result = await generateReferenceCroqui(data.sessionId);
  return { success: true, ...result };
});

export const retryReferenceGenerationFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: any }) => {
  const session = await getUploadSession(data.sessionId);
  if (!session || session.status === "expired")
    throw new Error("Sessão de referência expirada ou inexistente.");
  if (session.status !== "generation_failed")
    throw new Error("Somente uma geração que falhou pode ser repetida.");
  await updateUploadSession(data.sessionId, {
    status: "analysis_ready",
    analysisErrorCode: null,
  });
  const referenceImageUrls = await loadRetainedReferenceImages(session);
  const result = await generateReferenceCroqui(
    data.sessionId,
    referenceImageUrls,
  );
  return { success: true, ...result };
});

export const requestReferenceRecropFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: any }) => {
  const session = await getUploadSession(data.sessionId);
  if (!session || session.status === "expired")
    throw new Error("Sessão de referência expirada ou inexistente.");
  await updateUploadSession(data.sessionId, {
    status: "needs_recrop",
    analysisErrorCode: "user_requested_recrop",
  });
  return { success: true };
});

export const uploadCroquiFileFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: any }) => {
  const { sessionId, fileBase64, fileName } = data;
  const url = await uploadBase64ToStorage(
    fileBase64,
    `croquis/${sessionId}_${Date.now()}_${fileName || "croqui.jpg"}`,
  );
  await confirmUploadSession(sessionId, url);
  return { url };
});
