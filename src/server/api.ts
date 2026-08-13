import { createServerFn } from '@tanstack/react-start';
import * as fal from '@fal-ai/serverless-client';
import { createClient } from '@supabase/supabase-js';
import elementosRaw from '../lib/elementos_vestuario.json';
import { saveLook, updateLook, searchProducts, createUploadSession, getUploadSession, confirmUploadSession } from './db';
import { getBackgroundInstruction, getMannequinUrl, buildSleevelessInstruction, buildMannequinSurfaceInstruction, SLEEVELESS_DECOTES } from '../lib/noivaUtils';

// Map nome -> element for fast O(1) lookup
type Elemento = {
  id: number;
  nome: string;
  nome_en: string;
  categoria: string;
  diretrizes: string;
  description_en: string;
  image_url: string | null;
};
const ELEMENT_MAP = new Map<string, Elemento>(
  (elementosRaw as Elemento[]).map(e => [e.nome, e])
);

function getElementSpecs(nome: string | null | undefined): { nameEn: string; descEn: string } | null {
  if (!nome) return null;
  const el = ELEMENT_MAP.get(nome);
  if (!el) return { nameEn: nome, descEn: '' };
  return {
    nameEn: el.nome_en || el.nome,
    descEn: el.description_en || ''
  };
}

function buildElementPromptFragment(specs: {
  decote?: string | null;
  manga?: string | null;
  saia?: string | null;
  renda?: string | null;
  peca?: string | null;
}): string {
  const parts: string[] = [];

  const dSpec = getElementSpecs(specs.decote);
  if (dSpec) parts.push(`NECKLINE STYLE — ${dSpec.nameEn}: ${dSpec.descEn}`);

  const mSpec = getElementSpecs(specs.manga);
  if (mSpec) {
    parts.push(`SLEEVE STYLE — ${mSpec.nameEn}: ${mSpec.descEn}`);
  } else if (specs.peca === "Vestido" || specs.peca === "Blusa" || specs.peca === "Macacão") {
    parts.push(`SLEEVE STYLE — Sleeveless: The garment is completely sleeveless with no sleeves, leaving the arms fully bare`);
  }

  const sSpec = getElementSpecs(specs.saia);
  if (sSpec) parts.push(`SKIRT/BOTTOM STYLE — ${sSpec.nameEn}: ${sSpec.descEn}`);

  const rSpec = getElementSpecs(specs.renda);
  if (rSpec) parts.push(`LACE DETAIL — ${rSpec.nameEn}: ${rSpec.descEn}`);

  if (parts.length === 0) return "";
  return ` GARMENT ELEMENT SPECIFICATIONS (follow these descriptions precisely): ${parts.join(". ")}.`;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || import.meta.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const _BODY_CHARS = {
  "Ampulheta": "shoulders and hips equally wide, waist dramatically narrower — clear X-shaped silhouette with balanced curves",
  "Triângulo": "hips visibly wider than shoulders, narrower upper body — triangular silhouette wider at the hips",
  "Triângulo Invertido": "shoulders broader than hips, V-shaped athletic upper body, narrower lower body",
  "Retângulo": "shoulders, waist and hips all nearly equal width with minimal waist curve — straight athletic silhouette",
};

const PECA_EN: Record<string, string> = {
  "Vestido": "dress",
  "Saia": "skirt",
  "Blusa": "blouse",
  "Calça": "pants",
  "Macacão": "jumpsuit",
  "Top": "crop top",
  "Short/Bermuda": "shorts",
  "Blazer": "blazer"
};

const COMPRIMENTO_EN: Record<string, string> = {
  "Curto": "mini",
  "Médio": "knee-length",
  "Midi": "midi",
  "Longo": "floor-length"
};

// Precise anatomical hem placement for the AI
const COMPRIMENTO_HEM: Record<string, string> = {
  "Curto": "CRITICAL LENGTH: This is a MINI / SHORT garment (~35-45cm from waist). The hem MUST end at MID-THIGH, well ABOVE the knee — showing most of the thigh. Do NOT make it knee-length or longer. Think mini-skirt.",
  "Médio": "CRITICAL LENGTH: The hem MUST end exactly AT the kneecap (~55-60cm from waist). Not above the knee, not below — right at knee level.",
  "Midi": "CRITICAL LENGTH: The hem MUST end at MID-CALF (~70-80cm from waist), halfway between the knee and the ankle. Not at the knee, not at the ankle.",
  "Longo": "CRITICAL LENGTH: The hem MUST reach the ANKLE or the floor (~95-110cm from waist). This is a full-length maxi garment."
};

const CORES_EN: Record<string, string> = {
  "Verde C&N": "emerald green",
  "Preto": "black",
  "Branco": "white",
  "Azul Marinho": "navy blue",
  "Vermelho Rubi": "ruby red",
  "Rosa Pastel": "pastel pink",
  "Roxo Imperial": "imperial purple",
  "Terracota": "terracotta",
  "Amarelo Mostarda": "mustard yellow",
  "Nude/Bege": "nude beige",
  "Lilás": "lilac",
  "Verde Menta": "mint green"
};

// Bottom-only garment keywords (skirt, pants, shorts, bermuda)
const _BOTTOM_KEYWORDS = ["skirt", "saia", "pants", "calça", "shorts", "bermuda"];
function isBottomGarment(pecaEn: string, pecaPt: string): boolean {
  const combined = `${pecaEn} ${pecaPt}`.toLowerCase();
  return _BOTTOM_KEYWORDS.some(kw => combined.includes(kw));
}

// Top-only garment keywords (blouse, shirt, top)
const _TOP_KEYWORDS = ["blouse", "blusa", "shirt", "top", "crop", "blazer"];
function isTopGarment(pecaEn: string, pecaPt: string): boolean {
  const combined = `${pecaEn} ${pecaPt}`.toLowerCase();
  return _TOP_KEYWORDS.some(kw => combined.includes(kw));
}

export const generateCroquiFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    const { peca, biotipo, comprimento, decote, manga, saia, renda, comentario, tipoCerimonia, rendaDecisao, ocasiao, previousCroquiUrl } = data;

    // Se houver um croqui anterior (ajuste/edição), usamos o endpoint de EDIT do Seedream para alterar a imagem existente
    if (previousCroquiUrl) {
      const editPrompt = `CRITICAL INSTRUCTION FOR CROQUI EDIT: The reference image is an existing hand-drawn fashion croqui sketch.
Modify this exact croqui drawing by applying ONLY the following requested design adjustment: "${comentario || 'update details'}".
Preserve the exact composition, mannequin body shape, hand-drawn black pencil line-art sketch style, fabric drape, and side-by-side front/back layout from the reference image.
Do NOT redraw a completely different dress or alter unrelated parts of the garment. Only alter the specified elements (such as adding long sleeves, changing neckline, or adding details) while maintaining maximum fidelity to the original reference croqui image.
Style: hand-drawn black pencil on white paper. No color, no photo, no background, no text, no facial features.`;

      try {
        const result: any = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
          input: {
            prompt: editPrompt,
            image_urls: [previousCroquiUrl],
            image_size: "portrait_4_3",
            num_images: 1,
            enable_safety_checker: false,
          }
        });

        const imageUrl = result.images?.[0]?.url;
        if (!imageUrl) throw new Error("No image returned from Fal.ai");
        return { url: imageUrl };
      } catch (error) {
        console.error("[CROQUI EDIT] Error editing croqui:", error);
        throw error;
      }
    }

    let bodyContext = "";
    if (biotipo && _BODY_CHARS[biotipo as keyof typeof _BODY_CHARS]) {
      bodyContext = ` CRITICAL — the figure MUST have body type: ${_BODY_CHARS[biotipo as keyof typeof _BODY_CHARS]}. This is NOT a standard thin fashion illustration — the body shape described must be clearly visible with realistic proportions. Do NOT draw a slender model.`;
    }

    const pecaEn = PECA_EN[peca as keyof typeof PECA_EN] || peca || 'garment';
    const comprimentoEn = comprimento ? (COMPRIMENTO_EN[comprimento as keyof typeof COMPRIMENTO_EN] || comprimento) : '';

    const elementFragment = buildElementPromptFragment({ decote, manga, saia, renda, peca });
    const isBottom = isBottomGarment(pecaEn, peca || '');
    const isTop = isTopGarment(pecaEn, peca || '');
    const hemInstruction = comprimento ? (COMPRIMENTO_HEM[comprimento as keyof typeof COMPRIMENTO_HEM] || '') : '';
    const sleevelessInstruction = buildSleevelessInstruction(decote, manga);

    // Build the leading instruction block — garment type + length come FIRST
    let leadingInstructions = '';
    // Determina se a peça é de uma única peça (vestido, macacão)
    const isOnePiece = pecaEn === 'dress' || pecaEn === 'jumpsuit' || ocasiao === 'Noiva';

    if (ocasiao === "Noiva") {
      let cerimonyCtx = "";
      if (tipoCerimonia === "Civil") cerimonyCtx = " for a civil ceremony";
      else if (tipoCerimonia === "Igreja") cerimonyCtx = " for a traditional church wedding";
      else if (tipoCerimonia === "Cerimônia Aberta") cerimonyCtx = " for an outdoor open wedding ceremony";
      
      let laceCtx = "";
      if (rendaDecisao === true) {
        laceCtx = renda ? ` It features ${renda} lace details and applications.` : " It features lace details and applications.";
      } else if (rendaDecisao === false) {
        laceCtx = " It is absolutely plain with NO lace anywhere.";
      }
      
      leadingInstructions = `CRITICAL — ONE-PIECE GARMENT: This is a SINGLE bridal wedding dress${cerimonyCtx} — NOT a two-piece outfit. The dress is ONE continuous garment from neckline to hem with NO visible separation between bodice and skirt. Do NOT draw a top and separate skirt. The bodice and skirt are structurally integrated as one unified dress.${laceCtx}\nPresent the dress fully visible from neckline to hem.\n${hemInstruction}`;
    } else if (isBottom) {
      leadingInstructions = `IMPORTANT: This is a BOTTOM garment ONLY — a ${pecaEn}. Do NOT draw any top, blouse, shirt, or upper body clothing. Show ONLY the ${pecaEn} from waistband to hem. The mannequin torso above the waistband MUST be completely bare and clean — no seam lines, no zippers, no closure lines, no stitching, no fabric details above the waist. The upper body is just an empty mannequin form.\n${hemInstruction}`;
    } else if (isTop) {
      leadingInstructions = `IMPORTANT: This is a TOP garment ONLY — a ${pecaEn}. Do NOT draw any skirt, pants, dress, or lower body clothing. Show ONLY the ${pecaEn} from neckline to the natural hem at the waist/hips. The mannequin legs and lower body below the hem of the ${pecaEn} MUST be completely bare and clean — no fabric details, no skirt, no pants. The lower body is just an empty mannequin form.`;
    } else {
      const lengthPrefix = comprimentoEn ? `${comprimentoEn} ` : '';
      const onePieceNote = isOnePiece
        ? ` CRITICAL — ONE-PIECE GARMENT: This is a SINGLE unified ${pecaEn} — NOT a two-piece outfit. The bodice and lower portion are ONE continuous integrated garment. Do NOT draw a separate top and separate bottom. The waistline is a seam detail WITHIN the garment, not a separation point between two pieces.`
        : '';
      leadingInstructions = `This is a ${lengthPrefix}${pecaEn}.${onePieceNote} Present the garment fully visible from neckline/collar to hem, showing the complete silhouette: neckline, sleeves, body fit, waistline, and hem.\n${hemInstruction}`;
    }

    // Build strong front/back consistency instruction
    const isSleevelessDesign = SLEEVELESS_DECOTES.includes(decote || '');
    const sleevelessBackRule = isSleevelessDesign
      ? ` CRITICAL BACK VIEW RULE: The front of this garment is strapless/sleeveless (${decote}). The back MUST also be strapless — do NOT add any straps, racerback, halter neck, shoulder coverage, tank-top back, or any fabric covering the shoulders or upper back that does not exist on the front. The back neckline must match the same strapless construction as the front. The upper back and shoulders must be completely bare, matching the front.`
      : '';

    const backViewInstruction = isBottom
      ? 'The back view must show closure details and seam lines ONLY on the garment itself (below the waistband). The mannequin torso above the waistband must remain completely bare — no zippers, seams, or lines on the upper back.'
      : isTop
        ? `The back view must show closure details and seam lines ONLY on the garment itself (above the waist/hips). The mannequin lower body below the hem of the ${pecaEn} must remain completely bare.`
        : `CRITICAL FRONT/BACK CONSISTENCY: The back view must be structurally consistent with the front view — same neckline type, same sleeve type (or lack thereof), same overall silhouette and construction. Do NOT add structural elements to the back (straps, sleeves, coverage) that do not exist on the front. The back view should show: the reverse of the same garment construction, any back closure details (invisible zipper, buttons), back seam lines, and darts — but the overall structure must match the front exactly.${sleevelessBackRule}`;

    const prompt = `${sleevelessInstruction}${leadingInstructions}
Professional fashion design croqui of a ${comprimentoEn} ${pecaEn}.${elementFragment}${bodyContext}
${isOnePiece ? `REMINDER: This is ONE single piece of clothing — bodice and skirt/lower portion are NOT separate items. Draw it as one unified garment with continuous fabric flow from top to bottom.\n` : ''}${comentario ? `Extra design instructions: ${comentario}\n` : ''}
CRITICAL: Show BOTH front view AND back view of the garment side by side in a single composition — front view on the left, back view on the right, as in professional fashion croquis.
The figure is a faceless fashion mannequin form — no facial features, no face detail, just a smooth featureless head or implied head shape. The focus is entirely on the garment.
Style: hand-drawn black pencil on white paper. Use hatching and cross-hatching for volume and shadow, directional strokes following the fabric grain to convey drape and texture, fine contour lines for garment structure, and stippling for any textured surfaces.
Clearly render garment construction details: seam lines, darts, stitch lines, closures, hemlines, and any decorative elements.
${backViewInstruction}
No color, no photographs, no realistic rendering, no 3D, no shading gradients, no painted or digital look.
No text, no labels, no annotations, no watermarks, no faces, no facial features.`;

    try {
      const result: any = await fal.subscribe("fal-ai/bytedance/seedream/v4/text-to-image", {
        input: {
          prompt,
          image_size: "portrait_4_3",
          num_images: 1,
          enable_safety_checker: false,
        }
      });

      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) throw new Error("No image returned from Fal.ai");

      return { url: imageUrl };
    } catch (error) {
      console.error("[CROQUI] Error generating:", error);
      throw error;
    }
  });

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
    if (l < 0.15) { prefix = ""; colorName = "deep burgundy / wine-red"; }
    else if (l < 0.35) { prefix = ""; colorName = "rich maroon / bordeaux red"; }
    else if (s > 0.7) colorName = "crimson red";
    else colorName = "rose red";
  }
  else if (h >= 15 && h < 45) {
    if (l < 0.15) { prefix = ""; colorName = "deep espresso chocolate brown"; }
    else if (l < 0.35) { prefix = ""; colorName = "rich dark golden-brown (ochre / olive-gold)"; }
    else if (s > 0.7) colorName = "terracotta orange";
    else colorName = "warm beige / tan";
  }
  else if (h >= 45 && h < 70) {
    if (l < 0.15) { prefix = ""; colorName = "dark olive-bronze"; }
    else if (l < 0.35) { prefix = ""; colorName = "mustard gold / dark olive-gold"; }
    else if (s > 0.7) colorName = "warm yellow / mustard yellow";
    else colorName = "creamy sand beige";
  }
  else if (h >= 70 && h < 150) {
    if (l < 0.15) { prefix = ""; colorName = "deep forest green"; }
    else if (l < 0.35) { prefix = ""; colorName = "olive green"; }
    else if (s > 0.7) colorName = "emerald green";
    else colorName = "sage green / pastel mint green";
  }
  else if (h >= 150 && h < 200) {
    if (l < 0.15) { prefix = ""; colorName = "dark slate teal"; }
    else if (l < 0.35) { prefix = ""; colorName = "deep petrol teal"; }
    else if (s > 0.7) colorName = "cyan blue / turquoise";
    else colorName = "pale aqua teal";
  }
  else if (h >= 200 && h < 255) {
    if (l < 0.15) { prefix = ""; colorName = "deep midnight navy blue"; }
    else if (l < 0.35) { prefix = ""; colorName = "navy blue"; }
    else if (s > 0.7) colorName = "royal blue";
    else colorName = "soft pastel blue";
  }
  else if (h >= 255 && h < 290) {
    if (l < 0.15) { prefix = ""; colorName = "deep plum / eggplant purple"; }
    else if (l < 0.35) { prefix = ""; colorName = "grape purple / violet"; }
    else if (s > 0.7) colorName = "vivid purple";
    else colorName = "soft lavender lilac";
  }
  else if (h >= 290 && h < 330) {
    if (l < 0.15) { prefix = ""; colorName = "deep mulberry"; }
    else if (l < 0.35) { prefix = ""; colorName = "rich magenta"; }
    else if (s > 0.7) colorName = "hot pink / fuchsia";
    else colorName = "soft blush pink";
  }

  return `${prefix}${colorName}`;
}

export const searchProductsFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    const term = data?.term || '';
    const results = await searchProducts(term);
    return { results };
  });

export const generateRealistaFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    const { peca, cor, userImageUrl, croquiUrl, modo, biotipo, comprimento, decote, manga, saia, renda, comentario, tecidoImageUrl, tecidoPantone, tecidoSku, tecidoNome, ocasiao } = data;

    const pecaEn = PECA_EN[peca as keyof typeof PECA_EN] || peca || 'garment';
    const corEn = cor ? (cor.startsWith('#') ? `${hexToColorDescription(cor)} color (hex: ${cor})` : (CORES_EN[cor as keyof typeof CORES_EN] || cor)) : 'a beautiful';

    let result: any;

    if (modo === "foto") {
      if (!userImageUrl) {
        throw new Error("Foto do usuário é obrigatória para este passo.");
      }

      const imageUrls = [userImageUrl, croquiUrl];
      let fabricInstruction = "";

      if (tecidoImageUrl) {
        imageUrls.push(tecidoImageUrl);
        fabricInstruction = `\nCRITICAL FABRIC REFERENCE: The THIRD image provided is a real fabric swatch photo (${tecidoNome || tecidoSku || 'fabric'}). Dress the person in a ${pecaEn} made of THIS EXACT FABRIC. Transfer the fabric color, material texture, weave, pattern, and finish from the third image onto the garment.`;
      }

      const prompt = `CRITICAL: Reference images are provided.
The FIRST image shows a real person — preserve their exact face, identity, skin tone, hair, body shape, and natural pose with absolute fidelity. Do NOT alter their appearance.
The SECOND image shows a complete fashion croqui/sketch of the ${pecaEn}.${fabricInstruction}
Dress the person from the FIRST image in this exact ${pecaEn} design from the SECOND image${tecidoImageUrl ? ' using the fabric from the THIRD image' : ` in ${corEn} color`}.
Transfer the garment with precision: preserve its design, silhouette, cut, and every construction detail.
The garment must drape naturally over the person's body, fitting their actual posture and proportions.
Keep the original background, lighting, and environment from the person's photo unchanged.
Result must look like a real editorial fashion photograph — photorealistic, sharp focus, high resolution.
${comentario ? `Extra design details and styling adjustments: ${comentario}\n` : ''}
The garment sits naturally on the body with realistic draping and proportions.
Do not add other people, do not change the subject's face or body.
No illustrations, no sketches, no cartoons.`;

      try {
        result = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
          input: {
            prompt,
            image_urls: imageUrls,
            image_size: "square_hd",
            num_images: 1,
            enable_safety_checker: false,
          }
        });
      } catch (error) {
        console.error("[REALISTA FOTO] Error generating:", error);
        throw error;
      }
    } else {
      // Modo Manequim (gera a foto realista a partir do croqui de referência)
      const mannequinUrl = getMannequinUrl(biotipo);

      const comprimentoEn = comprimento ? (COMPRIMENTO_EN[comprimento as keyof typeof COMPRIMENTO_EN] || comprimento) : '';
      const elementFragment = buildElementPromptFragment({ decote, manga, saia, renda, peca });
      const isBottom = isBottomGarment(pecaEn, peca || '');
      const isTop = isTopGarment(pecaEn, peca || '');
      const hemInstruction = comprimento ? (COMPRIMENTO_HEM[comprimento as keyof typeof COMPRIMENTO_HEM] || '') : '';
      const sleevelessInstruction = buildSleevelessInstruction(decote, manga);

      let garmentTypeInstruction = '';
      if (isBottom) {
        garmentTypeInstruction = `IMPORTANT: This is a BOTTOM garment ONLY — a ${pecaEn}. Do NOT include any top, blouse, shirt, or upper body clothing. Show ONLY the ${pecaEn} from waistband to hem on the mannequin.\n${hemInstruction}`;
      } else if (isTop) {
        garmentTypeInstruction = `IMPORTANT: This is a TOP garment ONLY — a ${pecaEn}. Do NOT include any skirt, pants, dress, or lower body clothing. Show ONLY the ${pecaEn} from neckline to the hem at the waist/hips on the mannequin. The lower body of the mannequin must be completely bare.`;
      } else {
        garmentTypeInstruction = `Present the garment from the front, fully visible from neckline/collar to hem, showing the complete silhouette clearly: neckline, sleeves, body fit, waistline, and hem.\n${hemInstruction}`;
      }

      const lengthPrefix = comprimentoEn ? `${comprimentoEn} ` : '';

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
          croquiRef = `IMAGE 3 is a real fabric swatch (${tecidoNome || tecidoSku || 'fabric'}).`;
          fabricInstruction = `\nCRITICAL FABRIC: Use the EXACT color, texture, pattern and material finish from IMAGE 3 to dress the garment.`;
        } else {
          fabricInstruction = `\nDress the garment in ${corEn} color.`;
        }
      } else {
        // fallback sem manequim de referência
        mannequinRef = `IMAGE 1 is a hand-drawn fashion croqui sketch of a ${lengthPrefix}${pecaEn}.`;
        if (tecidoImageUrl) {
          imageUrls.push(tecidoImageUrl);
          croquiRef = `IMAGE 2 is a real fabric swatch (${tecidoNome || tecidoSku || 'fabric'}).`;
          fabricInstruction = `\nCRITICAL FABRIC: Use the EXACT color, texture, pattern and material finish from IMAGE 2.`;
        } else {
          fabricInstruction = `\nConvert this flat sketch into a photorealistic, ready-to-wear finished garment in ${corEn} color, worn on a headless featureless dress mannequin.`;
        }
      }

      const bgInstruction = getBackgroundInstruction(ocasiao);
      const mannequinSurfaceInstruction = mannequinUrl ? buildMannequinSurfaceInstruction() : '';

      const prompt = mannequinUrl
        ? `CRITICAL: ${mannequinUrl ? String(imageUrls.length) : '1'} reference images are provided.
${mannequinRef}${croquiRef ? '\n' + croquiRef : ''}
TASK: Dress the mannequin from IMAGE 1 with the exact garment shown in IMAGE 2.${fabricInstruction}
${sleevelessInstruction}${garmentTypeInstruction}
${elementFragment}
${mannequinSurfaceInstruction}
Maintain absolute fidelity to the mannequin body shape and proportions from IMAGE 1.
Maintain high fidelity to the cut, shape, style and construction of the garment from IMAGE 2.
The final result must look like a professional editorial fashion photograph with soft natural studio lighting and ${bgInstruction}, showing the real fabric texture.
${comentario ? `Extra design details: ${comentario}\n` : ''}
No face, no person, just the mannequin with the garment. No text, no watermark, no illustration, no sketch, no cartoon, no flat drawing.`
        : `${sleevelessInstruction}${garmentTypeInstruction}
CRITICAL: The first reference image is a hand-drawn fashion design croqui sketch of a ${lengthPrefix}${pecaEn}.${elementFragment}${fabricInstruction}
Maintain high fidelity to the cut, shape, style and construction shown in the reference sketch.
The final result must look like a professional editorial fashion photograph with soft natural studio lighting and ${bgInstruction}, showing the real fabric texture.
${comentario ? `Extra design details: ${comentario}\n` : ''}
No face, no person, just the mannequin with the garment. No text, no watermark, no illustration, no sketch, no cartoon, no flat drawing.`;

      try {
        result = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
          input: {
            prompt,
            image_urls: imageUrls,
            image_size: "square_hd",
            num_images: 1,
            enable_safety_checker: false,
          }
        });
      } catch (error) {
        console.error("[REALISTA MANEQUIM] Error generating:", error);
        throw error;
      }
    }

    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image returned from Fal.ai");

    return { url: imageUrl };
  });

export const saveLookDbFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    try {
      const id = await saveLook(data);
      return { id };
    } catch (error) {
      console.error("[DB] Error saving look:", error);
      throw error;
    }
  });

export const updateLookDbFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    try {
      await updateLook(data.id, data.update);
      return { success: true };
    } catch (error) {
      console.error("[DB] Error updating look:", error);
      throw error;
    }
  });

export const sendWhatsAppLookFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    const { nome, telefone, croquiUrl, realistaUrl, peca, ocasiao, tipoCerimonia, rendaDecisao, biotipo, comprimento, decote, manga, cor, comentario } = data;

    const evolutionUrl = process.env.EVOLUTION_API_URL || import.meta.env.EVOLUTION_API_URL || "";
    const evolutionInstance = process.env.EVOLUTION_INSTANCE || import.meta.env.EVOLUTION_INSTANCE || "";
    const evolutionKey = process.env.EVOLUTION_API_KEY || import.meta.env.EVOLUTION_API_KEY || "";

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
      "apikey": evolutionKey,
      "Content-Type": "application/json"
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
          delay: 1000
        })
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
          media: croquiUrl
        })
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
            media: realistaUrl
          })
        });
      }

      // Integração do CRM Supabase (Projeto zynk)
      try {
        const orgId = process.env.CN_ORGANIZATION_ID;
        if (!orgId) {
          throw new Error("CN_ORGANIZATION_ID não configurado no ambiente.");
        }
        const phone = targetNumber;

        // 1. Garantir contato na tabela crm_contacts
        let contactId: string | null = null;
        const resCont = await supabase
          .from("crm_contacts")
          .select("id, name")
          .eq("organization_id", orgId)
          .eq("phone", phone);

        if (resCont.error) {
          console.error("[CRM] Erro ao buscar contato:", resCont.error);
        }

        if (resCont.data && resCont.data.length > 0) {
          contactId = resCont.data[0].id;
          if (resCont.data[0].name.startsWith("Paciente") || !resCont.data[0].name) {
            const upRes = await supabase
              .from("crm_contacts")
              .update({ name: nome })
              .eq("id", contactId);
            if (upRes.error) {
              console.error("[CRM] Erro ao atualizar nome do contato:", upRes.error);
            }
          }
        } else {
          const insCont = await supabase
            .from("crm_contacts")
            .insert({
              organization_id: orgId,
              phone: phone,
              name: nome,
              status: "lead"
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
          
          const resStages = await supabase
            .from("crm_stages")
            .select("id, name, position")
            .eq("organization_id", orgId);
          
          if (resStages.error) {
            console.error("[CRM] Erro ao buscar estágios:", resStages.error);
          }

          const stages = resStages.data || [];
          const targetStage = stages.find(s => s.name.toLowerCase() === stageName.toLowerCase());

          if (targetStage) {
            stageId = targetStage.id;
          } else {
            const maxPos = Math.max(...stages.map(s => s.position || 0), 0);
            const insStage = await supabase
              .from("crm_stages")
              .insert({
                organization_id: orgId,
                name: stageName,
                color: "#10b981", // Verde esmeralda
                position: maxPos + 1,
                probability: 80
              })
              .select("id")
              .single();
            if (insStage.error) {
              console.error("[CRM] Erro ao criar estágio 'Criador de Looks':", insStage.error);
            }
            if (insStage.data) {
              stageId = insStage.data.id;
            }
          }

          if (stageId) {
            // 3. Verificar duplicidade de Deal no mesmo estágio
            const resDupDeals = await supabase
              .from("crm_deals")
              .select("id")
              .eq("contact_id", contactId)
              .eq("stage_id", stageId)
              .eq("status", "open");

            if (resDupDeals.error) {
              console.error("[CRM] Erro ao buscar duplicidade de deals:", resDupDeals.error);
            }

            const dealExists = resDupDeals.data && resDupDeals.data.length > 0;
            let dealId: string | null = null;

            if (!dealExists) {
              const dealTitle = `Look Criativo - ${peca || "Personalizado"}`;
              const insDeal = await supabase
                .from("crm_deals")
                .insert({
                  organization_id: orgId,
                  contact_id: contactId,
                  stage_id: stageId,
                  title: dealTitle,
                  value: 0.00,
                  status: "open",
                  position: 0,
                  score: 0
                })
                .select("id")
                .single();
              if (insDeal.error) {
                console.error("[CRM] Erro ao criar deal:", insDeal.error);
              }
              if (insDeal.data) {
                dealId = insDeal.data.id;
                
                const insAct = await supabase
                  .from("crm_activity")
                  .insert({
                    deal_id: dealId,
                    type: "deal_created",
                    payload: { title: dealTitle }
                  });
                if (insAct.error) {
                  console.error("[CRM] Erro ao registrar crm_activity:", insAct.error);
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
                rendaDecisao !== undefined && rendaDecisao !== null ? `Terá Renda: ${rendaDecisao ? "Sim" : "Não"}` : "",
                biotipo ? `Biotipo: ${biotipo}` : "",
                comprimento ? `Comprimento: ${comprimento}` : "",
                decote ? `Decote: ${decote}` : "",
                manga ? `Manga: ${manga}` : "",
                cor ? `Cor: ${cor}` : "",
                comentario ? `Comentários: ${comentario}` : ""
              ].filter(Boolean).join("\n");

              const noteContent = `Look gerado pela IA:\n${detailsList}\n\nCroqui: ${croquiUrl}${realistaUrl ? `\nFoto Realista: ${realistaUrl}` : ""}`;

              const insNote = await supabase
                .from("crm_notes")
                .insert({
                  organization_id: orgId,
                  deal_id: dealId,
                  contact_id: contactId,
                  content: noteContent,
                  author_type: "ai"
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
      console.error("[WPP] Error sending WhatsApp message via Evolution API:", error);
      throw error;
    }
  });

export const createUploadSessionFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    const session = await createUploadSession(data.nomeCliente);
    return { session };
  });

export const pollUploadSessionFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    const session = await getUploadSession(data.sessionId);
    return { session };
  });

export const confirmUploadFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    await confirmUploadSession(data.sessionId, data.croquiUrl);
    return { success: true };
  });

export const uploadCroquiFileFn: any = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: any }) => {
    const { sessionId, fileBase64, fileName } = data;
    try {
      const buffer = Buffer.from(fileBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const path = `croquis/${sessionId}_${Date.now()}_${fileName || 'croqui.jpg'}`;

      const { error } = await supabase.storage
        .from('croqui-uploads')
        .upload(path, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.warn('[STORAGE] Falling back to base64 data URL:', error.message);
        const fallbackUrl = fileBase64.startsWith('data:') ? fileBase64 : `data:image/jpeg;base64,${fileBase64}`;
        await confirmUploadSession(sessionId, fallbackUrl);
        return { url: fallbackUrl };
      }

      const { data: publicUrlData } = supabase.storage
        .from('croqui-uploads')
        .getPublicUrl(path);

      const croquiUrl = publicUrlData.publicUrl;
      await confirmUploadSession(sessionId, croquiUrl);
      return { url: croquiUrl };
    } catch (err) {
      console.warn('[STORAGE] Storage upload error, using base64 fallback:', err);
      const fallbackUrl = fileBase64.startsWith('data:') ? fileBase64 : `data:image/jpeg;base64,${fileBase64}`;
      await confirmUploadSession(sessionId, fallbackUrl);
      return { url: fallbackUrl };
    }
  });

