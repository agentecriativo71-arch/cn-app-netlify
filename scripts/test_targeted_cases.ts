import * as fal from '@fal-ai/serverless-client';
import * as fs from 'fs';
import * as path from 'path';
import elementosRaw from '../src/lib/elementos_vestuario.json';
import { getBackgroundInstruction, getMannequinUrl, buildSleevelessInstruction, buildMannequinSurfaceInstruction } from '../src/lib/noivaUtils';

fal.config({
  credentials: process.env.FAL_KEY,
});

type Elemento = {
  nome: string;
  categoria: string;
  prompt_fragment: string;
};

const ELEMENTOS_MAP: Map<string, Elemento> = new Map(
  (elementosRaw as Elemento[]).map(e => [e.nome, e])
);

function buildElementPromptFragment(params: {
  decote?: string | null;
  manga?: string | null;
  saia?: string | null;
  renda?: string | null;
  peca?: string | null;
}): string {
  const { decote, manga, saia, renda, peca } = params;
  const fragments: string[] = [];

  if (decote) {
    const el = ELEMENTOS_MAP.get(decote);
    if (el?.prompt_fragment) fragments.push(el.prompt_fragment);
  }
  if (manga) {
    const el = ELEMENTOS_MAP.get(manga);
    if (el?.prompt_fragment) fragments.push(el.prompt_fragment);
  }
  if (saia && peca !== 'Blusa' && peca !== 'Top') {
    const el = ELEMENTOS_MAP.get(saia);
    if (el?.prompt_fragment) fragments.push(el.prompt_fragment);
  }
  if (renda) {
    const el = ELEMENTOS_MAP.get(renda);
    if (el?.prompt_fragment) fragments.push(el.prompt_fragment);
  }

  if (fragments.length === 0) return '';
  return ' Incorporate the following design elements precisely:\n- ' + fragments.join('\n- ') + '\n';
}

const PECA_EN: Record<string, string> = {
  "Vestido": "dress",
  "Saia": "skirt",
  "Blusa": "blouse",
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
  "Azul Marinho": "navy blue",
  "Vermelho Rubi": "ruby red",
  "Branco": "white",
};

const testCases = [
  // 3. Festa Triângulo
  {
    id: 3,
    name: "Caso 3 (Re-teste): Festa - Vestido Midi Saia Godê (Triângulo)",
    biotipo: "Triângulo",
    ocasiao: "Festa",
    peca: "Vestido",
    comprimento: "Midi",
    decote: "Canoa",
    manga: "Manga Curta",
    saia: "Godê",
    cor: "Azul Marinho",
    croquiUrl: "https://v3b.fal.media/files/b/0aa635a1/mi1mBxVXwJwXVL4vjuDQ1_778f13c64fed44238379e673fdb8a6ec.jpg"
  },
  // 4. Festa Triângulo Invertido
  {
    id: 4,
    name: "Caso 4 (Re-teste): Coquetel - Vestido Curto Decote V (Triângulo Invertido)",
    biotipo: "Triângulo Invertido",
    ocasiao: "Festa",
    peca: "Vestido",
    comprimento: "Curto",
    decote: "Decote V",
    manga: "Sem Manga",
    saia: "Evasê",
    cor: "Vermelho Rubi",
    croquiUrl: "https://v3b.fal.media/files/b/0aa635b9/r7zaSUvejsNnTOPwbGHxz_69c4f59adc344d5da3b891a00b481371.jpg"
  },
  // 9. Noiva Tomara que Caia Triângulo Invertido
  {
    id: 9,
    name: "Caso 9 (Re-teste): Noiva - Vestido Longo Tomara que Caia (Triângulo Invertido)",
    biotipo: "Triângulo Invertido",
    ocasiao: "Noiva",
    peca: "Vestido",
    comprimento: "Longo",
    decote: "Tomara que Caia",
    saia: "Evasê",
    renda: "Barrados",
    rendaDecisao: true,
    tipoCerimonia: "Cerimônia Aberta",
    cor: "Branco",
    croquiUrl: "https://v3b.fal.media/files/b/0aa635d0/hOH-AJHkMaHxo9NCETZVZ_221c66a6d0e54239aba61c4a017c3e37.jpg"
  }
];

async function generateRealista(data: any) {
  const { peca, cor, croquiUrl, biotipo, comprimento, decote, manga, saia, renda, comentario, ocasiao } = data;

  const pecaEn = PECA_EN[peca] || peca || 'garment';
  const corEn = CORES_EN[cor] || cor;

  const mannequinUrl = getMannequinUrl(biotipo);
  const comprimentoEn = comprimento ? (COMPRIMENTO_EN[comprimento] || comprimento) : '';
  const elementFragment = buildElementPromptFragment({ decote, manga, saia, renda, peca });
  const hemInstruction = comprimento ? (COMPRIMENTO_HEM[comprimento] || '') : '';
  const sleevelessInstruction = buildSleevelessInstruction(decote, manga);
  const garmentTypeInstruction = `Present the garment from the front, fully visible from neckline/collar to hem, showing the complete silhouette clearly: neckline, sleeves, body fit, waistline, and hem.\n${hemInstruction}`;

  const lengthPrefix = comprimentoEn ? `${comprimentoEn} ` : '';
  const imageUrls: string[] = [];
  if (mannequinUrl) imageUrls.push(mannequinUrl);
  imageUrls.push(croquiUrl);

  const mannequinRef = `IMAGE 1 is a photorealistic dressmaking mannequin — it defines the exact body shape, silhouette and proportions to preserve.\nIMAGE 2 is a hand-drawn fashion croqui sketch of a ${lengthPrefix}${pecaEn}.`;
  const fabricInstruction = `\nDress the garment in ${corEn} color.`;
  const bgInstruction = getBackgroundInstruction(ocasiao);
  const mannequinSurfaceInstruction = mannequinUrl ? buildMannequinSurfaceInstruction() : '';

  const prompt = `CRITICAL: ${String(imageUrls.length)} reference images are provided.
${mannequinRef}
TASK: Dress the mannequin from IMAGE 1 with the exact garment shown in IMAGE 2.${fabricInstruction}
${sleevelessInstruction}${garmentTypeInstruction}
${elementFragment}
${mannequinSurfaceInstruction}
Maintain absolute fidelity to the mannequin body shape and proportions from IMAGE 1.
Maintain high fidelity to the cut, shape, style and construction of the garment from IMAGE 2.
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

async function run() {
  const outDir = '/Users/vitormarques/.gemini/antigravity-ide/brain/7347483f-40d7-4675-b80f-38a7797e1044/batch_test';
  for (const tc of testCases) {
    console.log(`Re-testando ${tc.name}...`);
    const url = await generateRealista(tc);
    console.log(`Gerado: ${url}`);
    const dest = path.join(outDir, `reteste_caso_${tc.id}_realista.jpg`);
    await downloadImage(url, dest);
    console.log(`Salvo em ${dest}`);
  }
}

run();
