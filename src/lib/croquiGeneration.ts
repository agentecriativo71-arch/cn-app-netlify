import { getCatalogGenerationSpec } from "./garmentPrompt";
import { getMannequinUrl, MANNEQUIN_URLS } from "./noivaUtils";
import { z } from "zod";
import { CATALOG_VALUES, type ReferenceAnalysis } from "./referenceUtils";
import { isCatalogPublicAssetUrl } from "./catalogAssets";

export const CROQUI_GENERATOR = "seedream-v4" as const;
export const CROQUI_PROMPT_VERSION = "croqui-fidelity-v3" as const;
export const CROQUI_VISION_ASSESSMENT_VERSION =
  "croqui-vision-assessment-v1" as const;
export const CROQUI_CANDIDATE_COUNT = 4;

export const CROQUI_TEMPLATES = Object.entries(MANNEQUIN_URLS).map(
  ([biotipo, imageUrl]) => ({
    biotipo,
    imageUrl,
    style: "hand-drawn black-and-white croqui",
    pose: "neutral standing female fashion pose",
    scale: "same scale for both views",
    views: "front and back side by side",
    garmentArea:
      "neckline or collar through hem; exposed limbs remain clean mannequin surface",
  }),
) as Array<{
  biotipo: string;
  imageUrl: string;
  style: string;
  pose: string;
  scale: string;
  views: string;
  garmentArea: string;
}>;

export type CroquiGenerationRequest = {
  peca: string;
  biotipo?: string | null;
  comprimento?: string | null;
  decote?: string | null;
  manga?: string | null;
  possuiManga?: boolean | null;
  saia?: string | null;
  renda?: string | null;
  rendaDecisao?: boolean | null;
  comentario?: string | null;
  ocasiao?: string | null;
  tipoCerimonia?: string | null;
  previousCroquiUrl?: string | null;
  referenceAnalysis?: unknown;
  referenceImageUrls?: string[];
  seed?: number;
};

const croquiGenerationRequestSchema = z
  .object({
    peca: z.enum([
      "Vestido",
      "Saia",
      "Blusa",
      "Calça",
      "Macacão",
      "Top",
      "Short/Bermuda",
      "Blazer",
    ]),
    biotipo: z.string().nullable().optional(),
    comprimento: z.string().nullable().optional(),
    decote: z.string().nullable().optional(),
    manga: z.string().nullable().optional(),
    possuiManga: z.boolean().nullable().optional(),
    saia: z.string().nullable().optional(),
    renda: z.string().nullable().optional(),
    rendaDecisao: z.boolean().nullable().optional(),
    comentario: z.string().nullable().optional(),
    ocasiao: z.string().nullable().optional(),
    tipoCerimonia: z.string().nullable().optional(),
    previousCroquiUrl: z.string().nullable().optional(),
    referenceAnalysis: z.unknown().optional(),
    referenceImageUrls: z.array(z.string()).max(10).optional(),
    seed: z.number().int().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [field, allowed] of [
      ["decote", CATALOG_VALUES.decote],
      ["manga", CATALOG_VALUES.manga],
      ["saia", CATALOG_VALUES.saia],
      ["renda", CATALOG_VALUES.renda],
    ] as const) {
      const candidate = value[field];
      if (
        candidate != null &&
        !(allowed as readonly string[]).includes(candidate)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Elemento fora do catálogo.",
        });
    }
  });

export function parseCroquiGenerationRequest(
  value: unknown,
): CroquiGenerationRequest {
  return croquiGenerationRequestSchema.parse(value);
}

export type CroquiCandidate = {
  url: string;
  seed: number;
  attempt?: number;
  score: number;
  rejected: boolean;
  rejectionReasons: string[];
  qualityWarnings?: string[];
  eligible?: boolean;
  averageConfidence?: number | null;
  assessment?: CroquiVisionAssessment | null;
  visionAnalysis?: ReferenceAnalysis | null;
  rank?: number;
  selected?: boolean;
};

type VisualObservation<T> = {
  value: T | null;
  confidence: number;
  evidence?: string | null;
};

export type CroquiVisualAssessment = {
  peca?: VisualObservation<string>;
  comprimento?: VisualObservation<string>;
  decote?: VisualObservation<string>;
  possuiManga?: VisualObservation<boolean>;
  manga?: VisualObservation<string>;
  saia?: VisualObservation<string>;
  renda?: VisualObservation<string>;
  handDrawnStyle?: boolean;
  colorFree?: boolean;
  frontAndBackVisible?: VisualObservation<boolean>;
  handDrawnStyleObservation?: VisualObservation<boolean>;
  blackAndWhite?: VisualObservation<boolean>;
  photographicOr3d?: VisualObservation<boolean>;
  adultFemale?: VisualObservation<boolean>;
};

export type CroquiAssessmentCriterion = {
  expected: string | boolean | null;
  observed: string | boolean | null;
  applicable: boolean;
  matched: boolean;
  confidence: number;
  evidence: string | null;
};

export type CroquiVisionAssessment = {
  schemaVersion: typeof CROQUI_VISION_ASSESSMENT_VERSION;
  criteria: Record<string, CroquiAssessmentCriterion>;
  technicalScore: number;
  averageConfidence: number;
  eligible: boolean;
  disqualifiers: string[];
};

export type CroquiGenerationMetadata = {
  generator: typeof CROQUI_GENERATOR;
  promptVersion: typeof CROQUI_PROMPT_VERSION;
  candidates: CroquiCandidate[];
};

export type CroquiReferenceRole =
  | "biotipo"
  | "decote"
  | "manga"
  | "saia"
  | "renda"
  | "customer_crop";

export type CroquiReferenceDescriptor = {
  role: CroquiReferenceRole;
  selectedValue: string | null;
  assetName: string | null;
  url: string;
};

export const FEMALE_CROQUI_INVARIANT =
  "CRITICAL GLOBAL INVARIANT: Every figure and mannequin is an adult female fashion figure. This is women's fashion only. Never draw a male body, masculine mannequin, menswear model, male anatomy or menswear styling.";
export const MANNEQUIN_TEMPLATE_INSTRUCTION =
  "TEMPLATE AUTHORITY: IMAGE 1 is the canonical existing female mannequin template for the selected biotype. Preserve its female body proportions, neutral standing pose, identical scale, front-left/back-right placement and usable garment area from neckline or collar through hem. It controls body and croqui style; catalog/reference images control garment elements only.";

export function buildCroquiReferenceRoleInstruction(
  request: CroquiGenerationRequest,
): string {
  const catalogCount = [
    request.decote,
    request.manga,
    request.saia,
    request.renda,
  ].filter((value) =>
    Boolean(getCatalogGenerationSpec(value)?.imageUrl),
  ).length;
  const photoCount = request.referenceImageUrls?.length || 0;
  return `REFERENCE IMAGE ROLES: IMAGE 1 is the selected female biotype template. The next ${catalogCount} image(s), when present, are catalog element references and define construction only. The final ${photoCount} image(s), when present, are anonymized garment crops and define visible clothing details only. Do not copy faces, people, background or body from crop images.`;
}

export function occasionInstruction(occasion?: string | null): string {
  if (occasion === "Fardamento")
    return "OCCASION: women's professional uniform. Keep a polished female professional-uniform silhouette, never menswear.";
  if (occasion === "Noiva")
    return "OCCASION: bridal fashion. Keep the result feminine and suitable for the selected ceremony.";
  if (occasion)
    return `OCCASION: ${occasion}. Keep styling appropriate to this occasion.`;
  return "";
}

export function buildCroquiReferenceImageUrls(
  specs: Pick<
    CroquiGenerationRequest,
    "biotipo" | "decote" | "manga" | "saia" | "renda"
  >,
  extraUrls: string[] = [],
): string[] {
  return buildCroquiReferenceDescriptors(specs, extraUrls).map(
    (reference) => reference.url,
  );
}

function assetNameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").at(-1);
    return name || null;
  } catch {
    return null;
  }
}

export function buildCroquiReferenceDescriptors(
  specs: Pick<
    CroquiGenerationRequest,
    "biotipo" | "decote" | "manga" | "saia" | "renda"
  >,
  extraUrls: string[] = [],
): CroquiReferenceDescriptor[] {
  const template =
    CROQUI_TEMPLATES.find((item) => item.biotipo === specs.biotipo) ||
    CROQUI_TEMPLATES[0];
  const references: CroquiReferenceDescriptor[] = [
    {
      role: "biotipo",
      selectedValue: specs.biotipo || null,
      assetName: assetNameFromUrl(template?.imageUrl || getMannequinUrl(specs.biotipo)),
      url: template?.imageUrl || getMannequinUrl(specs.biotipo),
    },
  ];
  for (const [role, value] of [
    ["decote", specs.decote],
    ["manga", specs.manga],
    ["saia", specs.saia],
    ["renda", specs.renda],
  ] as const) {
    const imageUrl = getCatalogGenerationSpec(value)?.imageUrl;
    if (imageUrl) {
      references.push({
        role,
        selectedValue: value || null,
        assetName: assetNameFromUrl(imageUrl),
        url: imageUrl,
      });
    }
  }
  for (const url of extraUrls)
    if (typeof url === "string" && url.trim()) {
      references.push({
        role: "customer_crop",
        selectedValue: null,
        assetName: null,
        url,
      });
    }
  return references.filter(
    (reference, index, all) =>
      all.findIndex((item) => item.url === reference.url) === index,
  ).slice(0, 10);
}

export function validateCroquiReferenceDescriptors(
  references: CroquiReferenceDescriptor[],
): { valid: true } | { valid: false; invalid: CroquiReferenceDescriptor } {
  for (const reference of references) {
    if (reference.role === "customer_crop") {
      if (!reference.url.startsWith("data:image/")) {
        return { valid: false, invalid: reference };
      }
      continue;
    }
    if (!isCatalogPublicAssetUrl(reference.url)) {
      return { valid: false, invalid: reference };
    }
  }
  return { valid: true };
}

function normalizedConfidence(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function criterion(
  expected: string | boolean | null,
  observation: VisualObservation<string | boolean> | undefined,
  applicable = true,
): CroquiAssessmentCriterion {
  const observed = observation?.value ?? null;
  const confidence = normalizedConfidence(observation?.confidence);
  return {
    expected,
    observed,
    applicable,
    matched: applicable && observed !== null && observed === expected,
    confidence: applicable ? confidence : 0,
    evidence: observation?.evidence || null,
  };
}

function observationFor<T>(
  visual: CroquiVisualAssessment | undefined,
  key: keyof CroquiVisualAssessment,
): VisualObservation<T> | undefined {
  const value = visual?.[key];
  if (!value || typeof value !== "object" || !("value" in value))
    return undefined;
  return value as VisualObservation<T>;
}

export function buildCroquiVisionAssessment(
  request: CroquiGenerationRequest,
  visual?: CroquiVisualAssessment,
): CroquiVisionAssessment | null {
  if (!visual) return null;
  const criteria: Record<string, CroquiAssessmentCriterion> = {
    peca: criterion(request.peca, observationFor<string>(visual, "peca")),
    comprimento: criterion(
      request.comprimento || null,
      observationFor<string>(visual, "comprimento"),
      Boolean(request.comprimento),
    ),
    decote: criterion(
      request.decote || null,
      observationFor<string>(visual, "decote"),
      Boolean(request.decote),
    ),
    possuiManga: criterion(
      request.possuiManga ?? null,
      observationFor<boolean>(visual, "possuiManga"),
      request.possuiManga !== null && request.possuiManga !== undefined,
    ),
    manga: criterion(
      request.manga || null,
      observationFor<string>(visual, "manga"),
      Boolean(request.manga) && request.possuiManga !== false,
    ),
    saia: criterion(
      request.saia || null,
      observationFor<string>(visual, "saia"),
      Boolean(request.saia),
    ),
    renda: criterion(
      request.renda || null,
      observationFor<string>(visual, "renda"),
      Boolean(request.renda && request.rendaDecisao !== false),
    ),
    frontAndBackVisible: criterion(
      true,
      observationFor<boolean>(visual, "frontAndBackVisible"),
      Boolean(observationFor<boolean>(visual, "frontAndBackVisible")),
    ),
    handDrawnStyle: criterion(
      true,
      visual.handDrawnStyleObservation ||
        (typeof visual.handDrawnStyle === "boolean"
          ? { value: visual.handDrawnStyle, confidence: 1, evidence: null }
          : undefined),
      Boolean(
        visual.handDrawnStyleObservation ||
        typeof visual.handDrawnStyle === "boolean",
      ),
    ),
    blackAndWhite: criterion(
      true,
      observationFor<boolean>(visual, "blackAndWhite") ||
        (typeof visual.colorFree === "boolean"
          ? { value: visual.colorFree, confidence: 1, evidence: null }
          : undefined),
      Boolean(
        observationFor<boolean>(visual, "blackAndWhite") ||
        typeof visual.colorFree === "boolean",
      ),
    ),
    photographicOr3d: criterion(
      false,
      observationFor<boolean>(visual, "photographicOr3d"),
      Boolean(observationFor<boolean>(visual, "photographicOr3d")),
    ),
    adultFemale: criterion(
      true,
      observationFor<boolean>(visual, "adultFemale"),
      Boolean(observationFor<boolean>(visual, "adultFemale")),
    ),
  };
  const groups = [
    { weight: 0.25, keys: ["peca"] },
    {
      weight: 0.35,
      keys: ["comprimento", "decote", "possuiManga", "manga", "saia", "renda"],
    },
    { weight: 0.15, keys: ["frontAndBackVisible"] },
    {
      weight: 0.15,
      keys: ["handDrawnStyle", "blackAndWhite", "photographicOr3d"],
    },
    { weight: 0.1, keys: ["adultFemale"] },
  ];
  const groupScore = (keys: string[]) => {
    const applicable = keys
      .map((key) => criteria[key])
      .filter((item) => item.applicable);
    return applicable.length
      ? applicable.reduce(
          (sum, item) => sum + (item.matched ? item.confidence : 0),
          0,
        ) / applicable.length
      : null;
  };
  const applicableGroups = groups
    .map((group) => ({ ...group, score: groupScore(group.keys) }))
    .filter((group) => group.score !== null);
  const totalWeight =
    applicableGroups.reduce((sum, group) => sum + group.weight, 0) || 1;
  const weightedScore =
    applicableGroups.reduce(
      (sum, group) => sum + (group.score || 0) * group.weight,
      0,
    ) / totalWeight;
  const observations = Object.values(criteria).filter(
    (item) => item.applicable,
  );
  const averageConfidence = observations.length
    ? observations.reduce((sum, item) => sum + item.confidence, 0) /
      observations.length
    : 0;
  const disqualifiers: string[] = [];
  const hardMismatch = (key: string, code: string) => {
    const item = criteria[key];
    if (
      item.applicable &&
      item.observed !== null &&
      !item.matched &&
      item.confidence >= 0.75
    )
      disqualifiers.push(code);
  };
  hardMismatch("peca", "piece_visual_mismatch");
  hardMismatch("adultFemale", "female_figure_visual_mismatch");
  const style = criteria.photographicOr3d;
  if (style.applicable && style.observed === true && style.confidence >= 0.75)
    disqualifiers.push("photographic_or_3d_visual_mismatch");
  return {
    schemaVersion: CROQUI_VISION_ASSESSMENT_VERSION,
    criteria,
    technicalScore: Math.round(weightedScore * 500) / 100,
    averageConfidence: Math.round(averageConfidence * 100) / 100,
    eligible: disqualifiers.length === 0,
    disqualifiers,
  };
}

export function scoreCroquiCandidate(
  request: CroquiGenerationRequest,
  prompt: string,
  url: string,
  seed: number,
  visual?: CroquiVisualAssessment,
  attempt = 1,
): CroquiCandidate {
  const rejectionReasons: string[] = [];
  const qualityWarnings: string[] = [];
  const normalizedPrompt = prompt.toLowerCase();
  if (!url) rejectionReasons.push("empty_image_url");
  if (
    !normalizedPrompt.includes("adult female") ||
    !normalizedPrompt.includes("women's fashion")
  )
    rejectionReasons.push("female_invariant_missing");
  if (
    !normalizedPrompt.includes("hand-drawn black pencil") ||
    !normalizedPrompt.includes("both front view") ||
    !normalizedPrompt.includes("black-and-white") ||
    !normalizedPrompt.includes("no color") ||
    !normalizedPrompt.includes("no photograph") ||
    !normalizedPrompt.includes("no 3d") ||
    normalizedPrompt.includes("photographic rendering")
  )
    rejectionReasons.push("style_or_layout_mismatch");
  if (
    ["Saia", "Calça", "Short/Bermuda"].includes(request.peca) &&
    !normalizedPrompt.includes("bottom garment only")
  )
    rejectionReasons.push("piece_scope_missing");
  if (
    ["Blusa", "Top", "Blazer"].includes(request.peca) &&
    !normalizedPrompt.includes("top garment only")
  )
    rejectionReasons.push("piece_scope_missing");
  if (
    request.saia === "Godê Simples" &&
    (!normalizedPrompt.includes("no mermaid") ||
      !normalizedPrompt.includes("no peplum"))
  )
    rejectionReasons.push("gode_negative_guard_missing");
  if (visual) {
    const genderEvidence = visual.peca?.evidence?.toLowerCase() || "";
    if (/(\bmale\b|masculin|menswear|homem|masculino)/i.test(genderEvidence))
      rejectionReasons.push("male_figure_visual_mismatch");
    if (
      visual.peca &&
      visual.peca.value !== request.peca &&
      visual.peca.confidence >= 0.75
    )
      rejectionReasons.push("piece_visual_mismatch");
    if (
      request.decote &&
      visual.decote &&
      visual.decote.value !== request.decote &&
      visual.decote.confidence >= 0.75
    )
      qualityWarnings.push("neckline_visual_mismatch");
    if (
      request.possuiManga !== null &&
      request.possuiManga !== undefined &&
      visual.possuiManga &&
      visual.possuiManga.value !== request.possuiManga &&
      visual.possuiManga.confidence >= 0.75
    )
      qualityWarnings.push("sleeve_presence_visual_mismatch");
    if (
      request.manga &&
      visual.manga &&
      visual.manga.value !== request.manga &&
      visual.manga.confidence >= 0.75
    )
      qualityWarnings.push("sleeve_visual_mismatch");
    if (
      request.saia &&
      visual.saia &&
      visual.saia.value !== request.saia &&
      visual.saia.confidence >= 0.75
    )
      qualityWarnings.push("skirt_visual_mismatch");
    if (visual.handDrawnStyle === false || visual.colorFree === false)
      rejectionReasons.push("style_visual_mismatch");
  }
  const assessment = buildCroquiVisionAssessment(request, visual);
  const mergedReasons = [
    ...new Set([...rejectionReasons, ...(assessment?.disqualifiers || [])]),
  ];
  const score = assessment?.technicalScore ?? (mergedReasons.length ? 0 : 5);
  return {
    url,
    seed,
    attempt,
    score,
    rejected: mergedReasons.length > 0,
    eligible: mergedReasons.length === 0,
    averageConfidence: assessment?.averageConfidence ?? null,
    assessment,
    rejectionReasons: mergedReasons,
    qualityWarnings,
  };
}

export function buildCroquiEvaluationPrompt(
  request: CroquiGenerationRequest,
): string {
  return `Evaluate this generated fashion croqui against the requested specification. ${FEMALE_CROQUI_INVARIANT} Check exact piece, length, neckline, sleeve presence/type, skirt type, lace, side-by-side front/back structure, hand-drawn black-and-white pencil style and absence of color/photo/3D. Record every observed value with confidence from 0 to 1 and short visible evidence. Use null and confidence 0 when pixels do not support an observation. Do not invent an overall score: the server calculates the technical score. If any figure is male, masculine or menswear, set peca.value to null and cite that visible failure in evidence; never mark a male figure as a valid women's croqui. Return the same strict JSON contract as reference analysis. Requested piece: ${request.peca}. Requested length: ${request.comprimento || "not applicable"}. Requested neckline: ${request.decote || "not applicable"}. Requested sleeve: ${request.possuiManga === false ? "sleeveless" : request.manga || "not applicable"}. Requested skirt: ${request.saia || "not applicable"}. Requested lace: ${request.rendaDecisao === false ? "none" : request.renda || "not applicable"}.`;
}

export function buildCandidateGatePrompt(
  request: CroquiGenerationRequest,
): string {
  const bottom = ["Saia", "Calça", "Short/Bermuda"].includes(request.peca)
    ? " bottom garment only"
    : "";
  const top = ["Blusa", "Top", "Blazer"].includes(request.peca)
    ? " top garment only"
    : "";
  const gode =
    request.saia === "Godê Simples"
      ? " continuous half-circle with no mermaid and no peplum"
      : "";
  return `${FEMALE_CROQUI_INVARIANT} women's fashion hand-drawn black pencil black-and-white both front view and back view side by side${bottom}${top}${gode}. No color, no photograph, no 3D, no digital render.`;
}

export function chooseCroquiCandidate(
  candidates: CroquiCandidate[],
  _minimumScore = 4,
): CroquiCandidate {
  const eligible = candidates.filter(
    (candidate) => candidate.eligible !== false && !candidate.rejected,
  );
  const selected = [...eligible].sort(
    (left, right) =>
      right.score - left.score ||
      (right.averageConfidence || 0) - (left.averageConfidence || 0) ||
      (left.attempt || 1) - (right.attempt || 1),
  )[0];
  if (!selected)
    throw new Error("Nenhum candidato de croqui pôde ser selecionado.");
  return selected;
}

export function rankCroquiCandidates(
  candidates: CroquiCandidate[],
): CroquiCandidate[] {
  return [...candidates]
    .sort((left, right) => {
      if (left.eligible !== right.eligible)
        return left.eligible !== false ? -1 : 1;
      return (
        right.score - left.score ||
        (right.averageConfidence || 0) - (left.averageConfidence || 0) ||
        (left.attempt || 1) - (right.attempt || 1)
      );
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      selected: index === 0 && candidate.eligible !== false,
    }));
}
