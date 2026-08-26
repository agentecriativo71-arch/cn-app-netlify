import * as fal from '@fal-ai/serverless-client';
import * as fs from 'fs';
import * as path from 'path';
import { getBackgroundInstruction, getMannequinUrl } from '../src/lib/noivaUtils';
import { buildCatalogElementPromptFragment } from '../src/lib/garmentPrompt';
import { buildCroquiReferenceImageUrls, buildCroquiReferenceRoleInstruction, FEMALE_CROQUI_INVARIANT, MANNEQUIN_TEMPLATE_INSTRUCTION, occasionInstruction } from '../src/lib/croquiGeneration';

fal.config({
  credentials: process.env.FAL_KEY,
});

function buildElementPromptFragment(params: {
  decote?: string | null;
  manga?: string | null;
  saia?: string | null;
  renda?: string | null;
  peca?: string | null;
  possuiManga?: boolean | null;
}): string {
  return buildCatalogElementPromptFragment(params);
}

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
  "Off-White": "off-white",
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

const _BOTTOM_KEYWORDS = ["skirt", "saia", "pants", "calça", "shorts", "bermuda"];
function isBottomGarment(pecaEn: string, pecaPt: string): boolean {
  const combined = `${pecaEn} ${pecaPt}`.toLowerCase();
  return _BOTTOM_KEYWORDS.some(kw => combined.includes(kw));
}

const _TOP_KEYWORDS = ["blouse", "blusa", "shirt", "top", "crop", "blazer"];
function isTopGarment(pecaEn: string, pecaPt: string): boolean {
  const combined = `${pecaEn} ${pecaPt}`.toLowerCase();
  return _TOP_KEYWORDS.some(kw => combined.includes(kw));
}

const SLEEVELESS_DECOTES = ["Frente Única", "Coração (Sweetheart)", "Tomara que Caia"];
function buildSleevelessInstruction(decote: string | null | undefined, manga: string | null | undefined): string {
  if (manga) return '';
  if (!decote || !SLEEVELESS_DECOTES.includes(decote)) return '';
  return `CRITICAL — SLEEVELESS GARMENT: This design is completely and absolutely sleeveless. Do NOT draw, render, or imply any sleeves, shoulder straps, arm coverage, or any fabric on the arms or shoulders (other than the neckline itself). The arms and shoulders must be completely bare. Adding sleeves would be a critical error that ruins the design.\n`;
}

function hexToColorDescription(hex: string): string {
  return hex;
}

// 10 Casos de teste diversificados
const testCases = [
  // 1. Aleatório direto da página /croqui (default null)
  {
    id: 1,
    name: "Caso 1: Croqui aleatório inicial da rota /croqui",
    biotipo: null,
    ocasiao: null,
    peca: null,
    comprimento: null,
    cor: "Verde C&N",
  },
  // 2. Noiva Ampulheta
  {
    id: 2,
    name: "Caso 2: Noiva - Vestido Longo Decote V, Manga Longa (Ampulheta)",
    biotipo: "Ampulheta",
    ocasiao: "Noiva",
    peca: "Vestido",
    comprimento: "Longo",
    decote: "V (V-Neck)",
    manga: "Longa (Long Sleeve)",
    possuiManga: true,
    saia: "Evasê",
    renda: "Inteira",
    rendaDecisao: true,
    tipoCerimonia: "Igreja",
    cor: "Branco",
    comentario: "Detalhes de bordado floral delicado",
  },
  // 3. Festa Triângulo
  {
    id: 3,
    name: "Caso 3: Festa - Vestido Midi Saia Godê (Triângulo)",
    biotipo: "Triângulo",
    ocasiao: "Festa",
    peca: "Vestido",
    comprimento: "Midi",
    decote: "Canoa",
    manga: "Curta (Short Sleeve)",
    possuiManga: true,
    saia: "Godê Simples",
    cor: "Azul Marinho",
    comentario: "Cinto fino marcando a cintura",
  },
  // 4. Festa Triângulo Invertido
  {
    id: 4,
    name: "Caso 4: Coquetel - Vestido Curto Decote V (Triângulo Invertido)",
    biotipo: "Triângulo Invertido",
    ocasiao: "Festa",
    peca: "Vestido",
    comprimento: "Curto",
    decote: "V (V-Neck)",
    manga: null,
    possuiManga: false,
    saia: "Evasê",
    cor: "Vermelho Rubi",
  },
  // 5. Festa Retângulo
  {
    id: 5,
    name: "Caso 5: Festa - Vestido Longo Reto Gola Alta (Retângulo)",
    biotipo: "Retângulo",
    ocasiao: "Festa",
    peca: "Vestido",
    comprimento: "Longo",
    decote: "Gola Alta",
    manga: "3/4 (Three-Quarter)",
    possuiManga: true,
    saia: "Reta (Straight)",
    cor: "Preto",
    comentario: "Linhas limpas e fenda lateral sutil",
  },
  // 6. Noiva Civil Triângulo Off-White
  {
    id: 6,
    name: "Caso 6: Noiva Civil - Vestido Midi Off-White (Triângulo)",
    biotipo: "Triângulo",
    ocasiao: "Noiva",
    peca: "Vestido",
    comprimento: "Midi",
    decote: "Quadrado (Square)",
    manga: "Bufante / Puff",
    possuiManga: true,
    saia: "Plissada",
    rendaDecisao: false,
    tipoCerimonia: "Civil",
    cor: "Off-White",
    comentario: "Estilo minimalista e elegante",
  },
  // 7. Macacão Ampulheta
  {
    id: 7,
    name: "Caso 7: Festa - Macacão Longo Frente Única (Ampulheta)",
    biotipo: "Ampulheta",
    ocasiao: "Festa",
    peca: "Macacão",
    comprimento: "Longo",
    decote: "Frente Única",
    possuiManga: false,
    cor: "Terracota",
  },
  // 8. Saia Midi Retângulo
  {
    id: 8,
    name: "Caso 8: Casual Chic - Saia Midi Lápis (Retângulo)",
    biotipo: "Retângulo",
    ocasiao: "Casual",
    peca: "Saia",
    comprimento: "Midi",
    saia: "Lápis (Pencil)",
    cor: "Amarelo Mostarda",
  },
  // 9. Noiva Tomara que Caia Triângulo Invertido
  {
    id: 9,
    name: "Caso 9: Noiva - Vestido Longo Tomara que Caia (Triângulo Invertido)",
    biotipo: "Triângulo Invertido",
    ocasiao: "Noiva",
    peca: "Vestido",
    comprimento: "Longo",
    decote: "Tomara que Caia",
    possuiManga: false,
    saia: "Evasê",
    renda: "Barrados",
    rendaDecisao: true,
    tipoCerimonia: "Cerimônia Aberta",
    cor: "Branco",
  },
  // 10. Festa Ombro a Ombro Ampulheta
  {
    id: 10,
    name: "Caso 10: Festa - Vestido Longo Ombro a Ombro Godê (Ampulheta)",
    biotipo: "Ampulheta",
    ocasiao: "Festa",
    peca: "Vestido",
    comprimento: "Longo",
    decote: "Ombro a Ombro",
    manga: "Flutuante (Flutter)",
    possuiManga: true,
    saia: "Godê Simples",
    cor: "Roxo Imperial",
  }
];

async function generateCroqui(data: any) {
  const { peca, biotipo, comprimento, decote, manga, possuiManga, saia, renda, comentario, tipoCerimonia, rendaDecisao, ocasiao } = data;

  const bodyContext = biotipo ? ` CRITICAL — IMAGE 1 is the sole authority for the selected female biotype ${biotipo}. Preserve its proportions exactly; do not infer or redraw this body from a textual description.` : "";

  const pecaEn = PECA_EN[peca] || peca || 'garment';
  const comprimentoEn = comprimento ? (COMPRIMENTO_EN[comprimento] || comprimento) : '';
  const elementFragment = buildElementPromptFragment({ decote, manga, possuiManga, saia, renda, peca });
  const isBottom = isBottomGarment(pecaEn, peca || '');
  const isTop = isTopGarment(pecaEn, peca || '');
  const hemInstruction = comprimento ? (COMPRIMENTO_HEM[comprimento] || '') : '';
  const sleevelessInstruction = buildSleevelessInstruction(decote, possuiManga === false ? "Sem Manga" : manga);

  let leadingInstructions = '';
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

  const isSleevelessDesign = SLEEVELESS_DECOTES.includes(decote || '');
  const sleevelessBackRule = isSleevelessDesign
    ? ` CRITICAL BACK VIEW RULE: The front of this garment is strapless/sleeveless (${decote}). The back MUST also be strapless — do NOT add any straps, racerback, halter neck, shoulder coverage, tank-top back, or any fabric covering the shoulders or upper back that does not exist on the front. The back neckline must match the same strapless construction as the front. The upper back and shoulders must be completely bare, matching the front.`
    : '';

  const backViewInstruction = isBottom
    ? 'The back view must show closure details and seam lines ONLY on the garment itself (below the waistband). The mannequin torso above the waistband must remain completely bare — no zippers, seams, or lines on the upper back.'
    : isTop
      ? `The back view must show closure details and seam lines ONLY on the garment itself (above the waist/hips). The mannequin lower body below the hem of the ${pecaEn} must remain completely bare.`
      : `CRITICAL FRONT/BACK CONSISTENCY: The back view must be structurally consistent with the front view — same neckline type, same sleeve type (or lack thereof), same overall silhouette and construction. Do NOT add structural elements to the back (straps, sleeves, coverage) that do not exist on the front. The back view should show: the reverse of the same garment construction, any back closure details (invisible zipper, buttons), back seam lines, and darts — but the overall structure must match the front exactly.${sleevelessBackRule}`;

  const prompt = `${FEMALE_CROQUI_INVARIANT}
${MANNEQUIN_TEMPLATE_INSTRUCTION}
${buildCroquiReferenceRoleInstruction(data)}
${occasionInstruction(ocasiao)}
${sleevelessInstruction}${leadingInstructions}
Professional fashion design croqui of a ${comprimentoEn} ${pecaEn}.${elementFragment}${bodyContext}
${isOnePiece ? `REMINDER: This is ONE single piece of clothing — bodice and skirt/lower portion are NOT separate items. Draw it as one unified garment with continuous fabric flow from top to bottom.\n` : ''}${comentario ? `Extra design instructions: ${comentario}\n` : ''}
CRITICAL: Show BOTH front view AND back view of the garment side by side in a single composition — front view on the left, back view on the right, as in professional fashion croquis.
The figure is a faceless fashion mannequin form — no facial features, no face detail, just a smooth featureless head or implied head shape. The focus is entirely on the garment.
Style: hand-drawn black pencil on white paper. Use hatching and cross-hatching for volume and shadow, directional strokes following the fabric grain to convey drape and texture, fine contour lines for garment structure, and stippling for any textured surfaces.
Clearly render garment construction details: seam lines, darts, stitch lines, closures, hemlines, and any decorative elements.
CAIMENTO AND MOVEMENT: show directional fabric grain, gravity-aware folds, realistic volume and hem movement.
${backViewInstruction}
No color, no photographs, no realistic rendering, no 3D, no shading gradients, no painted or digital look.
No text, no labels, no annotations, no watermarks, no faces, no facial features.`;

  const result: any = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
    input: {
      prompt,
      image_urls: buildCroquiReferenceImageUrls({ biotipo, decote, manga, saia, renda }),
      image_size: "portrait_4_3",
      num_images: 1,
      enable_safety_checker: false,
    }
  });

  return result.images?.[0]?.url;
}

async function generateRealista(data: any) {
  const { peca, cor, croquiUrl, biotipo, comprimento, decote, manga, saia, renda, comentario, ocasiao } = data;

  const pecaEn = PECA_EN[peca] || peca || 'garment';
  const corEn = cor ? (cor.startsWith('#') ? `${hexToColorDescription(cor)} color (hex: ${cor})` : (CORES_EN[cor] || cor)) : 'a beautiful';

  const mannequinUrl = getMannequinUrl(biotipo);
  const comprimentoEn = comprimento ? (COMPRIMENTO_EN[comprimento] || comprimento) : '';
  const elementFragment = buildElementPromptFragment({ decote, manga, saia, renda, peca });
  const isBottom = isBottomGarment(pecaEn, peca || '');
  const isTop = isTopGarment(pecaEn, peca || '');
  const hemInstruction = comprimento ? (COMPRIMENTO_HEM[comprimento] || '') : '';
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
  const imageUrls: string[] = [];
  if (mannequinUrl) imageUrls.push(mannequinUrl);
  imageUrls.push(croquiUrl);

  let fabricInstruction = "";
  let mannequinRef = "";
  const croquiRef = "";

  if (mannequinUrl) {
    mannequinRef = `IMAGE 1 is a photorealistic dressmaking mannequin — it defines the exact body shape, silhouette and proportions to preserve.\nIMAGE 2 is a hand-drawn fashion croqui sketch of a ${lengthPrefix}${pecaEn}.`;
    fabricInstruction = `\nDress the garment in ${corEn} color.`;
  } else {
    mannequinRef = `IMAGE 1 is a hand-drawn fashion croqui sketch of a ${lengthPrefix}${pecaEn}.`;
    fabricInstruction = `\nConvert this flat sketch into a photorealistic, ready-to-wear finished garment in ${corEn} color, worn on a headless featureless dress mannequin.`;
  }

  const bgInstruction = getBackgroundInstruction(ocasiao);

  const prompt = mannequinUrl
    ? `CRITICAL: ${String(imageUrls.length)} reference images are provided.
${mannequinRef}${croquiRef ? '\n' + croquiRef : ''}
TASK: Dress the mannequin from IMAGE 1 with the exact garment shown in IMAGE 2.${fabricInstruction}
${sleevelessInstruction}${garmentTypeInstruction}
${elementFragment}
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

  const result: any = await fal.subscribe("fal-ai/bytedance/seedream/v4/edit", {
    input: {
      prompt,
      image_urls: imageUrls,
      image_size: "square_hd",
      num_images: 1,
      enable_safety_checker: false,
    }
  });

  return result.images?.[0]?.url;
}

async function downloadImage(url: string, destPath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

async function main() {
  const outDir = '/Users/vitormarques/.gemini/antigravity-ide/brain/7347483f-40d7-4675-b80f-38a7797e1044/batch_test';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`=======================================================`);
  console.log(`Iniciando lote de 10 gerações realistas...`);
  console.log(`Pasta de saída: ${outDir}`);
  console.log(`=======================================================\n`);

  const results: any[] = [];

  for (const tc of testCases) {
    console.log(`>>> [Caso ${tc.id}/10]: ${tc.name}`);
    const t0 = Date.now();
    try {
      console.log(`    [1/2] Gerando Croqui...`);
      const croquiUrl = await generateCroqui(tc);
      console.log(`    ✓ Croqui gerado: ${croquiUrl}`);
      const croquiLocal = path.join(outDir, `caso_${tc.id}_croqui.jpg`);
      await downloadImage(croquiUrl, croquiLocal);

      console.log(`    [2/2] Gerando Foto Realista (Manequim biotipo: ${tc.biotipo || 'padrão'})...`);
      const realistaUrl = await generateRealista({
        ...tc,
        croquiUrl,
      });
      console.log(`    ✓ Realista gerada: ${realistaUrl}`);
      const realistaLocal = path.join(outDir, `caso_${tc.id}_realista.jpg`);
      await downloadImage(realistaUrl, realistaLocal);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`    ==> Caso ${tc.id} concluído em ${elapsed}s\n`);

      results.push({
        id: tc.id,
        name: tc.name,
        biotipo: tc.biotipo,
        ocasiao: tc.ocasiao,
        peca: tc.peca,
        cor: tc.cor,
        croquiUrl,
        croquiLocal,
        realistaUrl,
        realistaLocal,
        elapsedSeconds: elapsed,
        status: "SUCCESS"
      });
    } catch (err: any) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.error(`    ❌ ERRO no Caso ${tc.id} (${elapsed}s):`, err?.message || err, '\n');
      results.push({
        id: tc.id,
        name: tc.name,
        biotipo: tc.biotipo,
        ocasiao: tc.ocasiao,
        peca: tc.peca,
        cor: tc.cor,
        status: "FAILED",
        error: err?.message || String(err),
        elapsedSeconds: elapsed,
      });
    }
  }

  const jsonSummaryPath = path.join(outDir, 'results.json');
  fs.writeFileSync(jsonSummaryPath, JSON.stringify(results, null, 2));
  console.log(`\n=======================================================`);
  console.log(`Lote finalizado! Relatório JSON salvo em: ${jsonSummaryPath}`);
  console.log(`=======================================================`);
}

main();
