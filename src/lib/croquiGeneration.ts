import { getCatalogGenerationSpec } from "./garmentPrompt";
import { getMannequinUrl, MANNEQUIN_URLS } from "./noivaUtils";
import { z } from "zod";
import { CATALOG_VALUES } from "./referenceUtils";

export const CROQUI_GENERATOR = "seedream-v4" as const;
export const CROQUI_PROMPT_VERSION = "croqui-fidelity-v2" as const;
export const CROQUI_CANDIDATE_COUNT = 3;

export const CROQUI_TEMPLATES = Object.entries(MANNEQUIN_URLS).map(([biotipo, imageUrl]) => ({
  biotipo,
  imageUrl,
  style: "hand-drawn black-and-white croqui",
  pose: "neutral standing female fashion pose",
  scale: "same scale for both views",
  views: "front and back side by side",
  garmentArea: "neckline or collar through hem; exposed limbs remain clean mannequin surface",
})) as Array<{ biotipo: string; imageUrl: string; style: string; pose: string; scale: string; views: string; garmentArea: string }>;

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

const croquiGenerationRequestSchema = z.object({
  peca: z.enum(["Vestido", "Saia", "Blusa", "Calça", "Macacão", "Top", "Short/Bermuda", "Blazer"]),
  biotipo: z.string().nullable().optional(), comprimento: z.string().nullable().optional(), decote: z.string().nullable().optional(), manga: z.string().nullable().optional(), possuiManga: z.boolean().nullable().optional(), saia: z.string().nullable().optional(), renda: z.string().nullable().optional(), rendaDecisao: z.boolean().nullable().optional(), comentario: z.string().nullable().optional(), ocasiao: z.string().nullable().optional(), tipoCerimonia: z.string().nullable().optional(), previousCroquiUrl: z.string().nullable().optional(), referenceAnalysis: z.unknown().optional(), referenceImageUrls: z.array(z.string()).max(10).optional(), seed: z.number().int().optional(),
}).strict().superRefine((value, context) => {
  for (const [field, allowed] of [["decote", CATALOG_VALUES.decote], ["manga", CATALOG_VALUES.manga], ["saia", CATALOG_VALUES.saia], ["renda", CATALOG_VALUES.renda]] as const) {
    const candidate = value[field];
    if (candidate != null && !(allowed as readonly string[]).includes(candidate)) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Elemento fora do catálogo." });
  }
});

export function parseCroquiGenerationRequest(value: unknown): CroquiGenerationRequest {
  return croquiGenerationRequestSchema.parse(value);
}

export type CroquiCandidate = {
  url: string;
  seed: number;
  score: number;
  rejected: boolean;
  rejectionReasons: string[];
};

type VisualObservation<T> = { value: T | null; confidence: number; evidence?: string | null };

export type CroquiVisualAssessment = {
  peca?: VisualObservation<string>;
  decote?: VisualObservation<string>;
  possuiManga?: VisualObservation<boolean>;
  manga?: VisualObservation<string>;
  saia?: VisualObservation<string>;
  handDrawnStyle?: boolean;
  colorFree?: boolean;
};

export type CroquiGenerationMetadata = {
  generator: typeof CROQUI_GENERATOR;
  promptVersion: typeof CROQUI_PROMPT_VERSION;
  candidates: CroquiCandidate[];
};

export const FEMALE_CROQUI_INVARIANT = "CRITICAL GLOBAL INVARIANT: Every figure and mannequin is an adult female fashion figure. This is women's fashion only. Never draw a male body, masculine mannequin, menswear model, male anatomy or menswear styling.";
export const MANNEQUIN_TEMPLATE_INSTRUCTION = "TEMPLATE AUTHORITY: IMAGE 1 is the canonical existing female mannequin template for the selected biotype. Preserve its female body proportions, neutral standing pose, identical scale, front-left/back-right placement and usable garment area from neckline or collar through hem. It controls body and croqui style; catalog/reference images control garment elements only.";

export function buildCroquiReferenceRoleInstruction(request: CroquiGenerationRequest): string {
  const catalogCount = [request.decote, request.manga, request.saia, request.renda].filter((value) => Boolean(getCatalogGenerationSpec(value)?.imageUrl)).length;
  const photoCount = request.referenceImageUrls?.length || 0;
  return `REFERENCE IMAGE ROLES: IMAGE 1 is the selected female biotype template. The next ${catalogCount} image(s), when present, are catalog element references and define construction only. The final ${photoCount} image(s), when present, are anonymized garment crops and define visible clothing details only. Do not copy faces, people, background or body from crop images.`;
}

export function occasionInstruction(occasion?: string | null): string {
  if (occasion === "Fardamento") return "OCCASION: women's professional uniform. Keep a polished female professional-uniform silhouette, never menswear.";
  if (occasion === "Noiva") return "OCCASION: bridal fashion. Keep the result feminine and suitable for the selected ceremony.";
  if (occasion) return `OCCASION: ${occasion}. Keep styling appropriate to this occasion.`;
  return "";
}

export function buildCroquiReferenceImageUrls(specs: Pick<CroquiGenerationRequest, "biotipo" | "decote" | "manga" | "saia" | "renda">, extraUrls: string[] = []): string[] {
  const template = CROQUI_TEMPLATES.find((item) => item.biotipo === specs.biotipo) || CROQUI_TEMPLATES[0];
  const urls = [template?.imageUrl || getMannequinUrl(specs.biotipo)];
  for (const value of [specs.decote, specs.manga, specs.saia, specs.renda]) {
    const imageUrl = getCatalogGenerationSpec(value)?.imageUrl;
    if (imageUrl) urls.push(imageUrl);
  }
  for (const url of extraUrls) if (typeof url === "string" && url.trim()) urls.push(url);
  return [...new Set(urls)].slice(0, 10);
}

export function scoreCroquiCandidate(request: CroquiGenerationRequest, prompt: string, url: string, seed: number, visual?: CroquiVisualAssessment): CroquiCandidate {
  const rejectionReasons: string[] = [];
  const normalizedPrompt = prompt.toLowerCase();
  if (!url) rejectionReasons.push("empty_image_url");
  if (!normalizedPrompt.includes("adult female") || !normalizedPrompt.includes("women's fashion")) rejectionReasons.push("female_invariant_missing");
  if (!normalizedPrompt.includes("hand-drawn black pencil") || !normalizedPrompt.includes("both front view") || !normalizedPrompt.includes("black-and-white") || !normalizedPrompt.includes("no color") || !normalizedPrompt.includes("no photograph") || !normalizedPrompt.includes("no 3d") || normalizedPrompt.includes("photographic rendering")) rejectionReasons.push("style_or_layout_mismatch");
  if (["Saia", "Calça", "Short/Bermuda"].includes(request.peca) && !normalizedPrompt.includes("bottom garment only")) rejectionReasons.push("piece_scope_missing");
  if (["Blusa", "Top", "Blazer"].includes(request.peca) && !normalizedPrompt.includes("top garment only")) rejectionReasons.push("piece_scope_missing");
  if (request.saia === "Godê Simples" && (!normalizedPrompt.includes("no mermaid") || !normalizedPrompt.includes("no peplum"))) rejectionReasons.push("gode_negative_guard_missing");
  if (visual) {
    const genderEvidence = visual.peca?.evidence?.toLowerCase() || "";
    if (/(\bmale\b|masculin|menswear|homem|masculino)/i.test(genderEvidence)) rejectionReasons.push("male_figure_visual_mismatch");
    if (visual.peca && (visual.peca.value !== request.peca || visual.peca.confidence < 0.75)) rejectionReasons.push("piece_visual_mismatch");
    if (request.decote && visual.decote && (visual.decote.value !== request.decote || visual.decote.confidence < 0.75)) rejectionReasons.push("neckline_visual_mismatch");
    if (request.possuiManga !== null && request.possuiManga !== undefined && visual.possuiManga && (visual.possuiManga.value !== request.possuiManga || visual.possuiManga.confidence < 0.75)) rejectionReasons.push("sleeve_presence_visual_mismatch");
    if (request.manga && visual.manga && (visual.manga.value !== request.manga || visual.manga.confidence < 0.75)) rejectionReasons.push("sleeve_visual_mismatch");
    if (request.saia && visual.saia && (visual.saia.value !== request.saia || visual.saia.confidence < 0.75)) rejectionReasons.push("skirt_visual_mismatch");
    if (visual.handDrawnStyle === false || visual.colorFree === false) rejectionReasons.push("style_visual_mismatch");
  }
  const score = rejectionReasons.length ? 0 : 5;
  return { url, seed, score, rejected: rejectionReasons.length > 0, rejectionReasons };
}

export function buildCroquiEvaluationPrompt(request: CroquiGenerationRequest): string {
  return `Evaluate this generated fashion croqui against the requested specification. ${FEMALE_CROQUI_INVARIANT} Check exact piece, neckline, sleeve presence/type, skirt type, side-by-side front/back structure, hand-drawn black-and-white pencil style and absence of color/photo/3D. If any figure is male, masculine or menswear, set peca.value to null and cite that visible failure in evidence; never mark a male figure as a valid women's croqui. Return the same strict JSON contract as reference analysis, with confidence based only on visible pixels. Requested piece: ${request.peca}. Requested neckline: ${request.decote || "not applicable"}. Requested sleeve: ${request.possuiManga === false ? "sleeveless" : request.manga || "not applicable"}. Requested skirt: ${request.saia || "not applicable"}.`;
}

export function buildCandidateGatePrompt(request: CroquiGenerationRequest): string {
  const bottom = ["Saia", "Calça", "Short/Bermuda"].includes(request.peca) ? " bottom garment only" : "";
  const top = ["Blusa", "Top", "Blazer"].includes(request.peca) ? " top garment only" : "";
  const gode = request.saia === "Godê Simples" ? " continuous half-circle with no mermaid and no peplum" : "";
  return `${FEMALE_CROQUI_INVARIANT} women's fashion hand-drawn black pencil black-and-white both front view and back view side by side${bottom}${top}${gode}. No color, no photograph, no 3D, no digital render.`;
}

export function chooseCroquiCandidate(candidates: CroquiCandidate[], minimumScore = 4): CroquiCandidate {
  const selected = candidates.find((candidate) => !candidate.rejected && candidate.score >= minimumScore);
  if (!selected) throw new Error("Nenhum candidato de croqui atingiu a nota mínima sem falha eliminatória.");
  return selected;
}
