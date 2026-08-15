export interface CroquiGenerationSpecs {
  peca: string;
  comprimento?: string;
  decote?: string;
  manga?: string;
  saia?: string;
  renda?: string | null;
  rendaDecisao?: boolean;
  biotipo?: string;
  ocasiao?: string;
  comentario?: string;
}

export function buildVisionPromptForSingleReference(ocasiao?: string): string {
  const occasionCtx = ocasiao ? ` The intended occasion is "${ocasiao}".` : '';
  return `You are an expert haute couture fashion designer and master patternmaker.
Analyze the provided SINGLE REFERENCE IMAGE of a garment/model.${occasionCtx}
The photo may be a mirror selfie, runway shot, catalog photo, or casual outfit picture.
TASK: Ignore phone, mirrors, background clutter, or user poses. Focus strictly on extracting the fashion design and garment architecture.
Extract the technical specifications into the following exact JSON format (and nothing else):

\`\`\`json
{
  "peca": "Vestido" | "Macacão" | "Saia" | "Blusa",
  "comprimento": "Curto" | "Médio" | "Midi" | "Longo",
  "decote": "Decote V" | "Tomara que Caia" | "Coração (Sweetheart)" | "Frente Única" | "Canoa" | "Quadrado" | "Redondo" | "Ombro a Ombro" | "Assimétrico",
  "manga": "Sem Manga" | "Manga Curta" | "Manga 3/4" | "Manga Longa" | "Manga Bufante" | "Alça Fina" | "Alça Larga",
  "saia": "Evasê" | "Godê" | "Sereia" | "Reta" | "Plissada" | "Com Fenda" | "Lápis",
  "renda": "Barrados" | "Floral" | "Geométrica" | "Bordada" | null,
  "rendaDecisao": true | false,
  "detalhes_extras": "Detailed technical English/Portuguese description of back cut (e.g. low back, illusion back, zipper/buttons), seams, darts, drape, belt, overlays, and hem finish."
}
\`\`\``;
}

export function buildVisionPromptForCompositeReference(ocasiao?: string): string {
  const occasionCtx = ocasiao ? ` The intended occasion is "${ocasiao}".` : '';
  return `You are an expert haute couture fashion designer and master patternmaker.
Analyze the provided TWO REFERENCE IMAGES (COMPOSITE FASHION DESIGN).${occasionCtx}

- IMAGE 1: TOP / BODICE — Extract the upper garment details: neckline, collar, straps, sleeves, bust structure, and waistline.
- IMAGE 2: BOTTOM / SKIRT / PANTS — Extract the lower garment details: silhouette (A-line, mermaid, flared, straight), skirt volume, slit, pleating, and hemline/train.

TASK: Unify them into one seamless continuous garment (or coordinated set) as if designed together in an atelier.
Ignore any human faces, phones, mirrors, or backgrounds.

Return the unified technical specification in the following exact JSON format:

\`\`\`json
{
  "peca": "Vestido" | "Macacão" | "Saia" | "Blusa",
  "comprimento": "Curto" | "Médio" | "Midi" | "Longo",
  "decote": "Decote V" | "Tomara que Caia" | "Coração (Sweetheart)" | "Frente Única" | "Canoa" | "Quadrado" | "Redondo" | "Ombro a Ombro" | "Assimétrico",
  "manga": "Sem Manga" | "Manga Curta" | "Manga 3/4" | "Manga Longa" | "Manga Bufante" | "Alça Fina" | "Alça Larga",
  "saia": "Evasê" | "Godê" | "Sereia" | "Reta" | "Plissada" | "Com Fenda" | "Lápis",
  "renda": "Barrados" | "Floral" | "Geométrica" | "Bordada" | null,
  "rendaDecisao": true | false,
  "detalhes_extras": "Detailed synthesis explaining how the bodice from Image 1 seamlessly connects with the skirt/pants from Image 2, including waist seam, back view, and fabric flow."
}
\`\`\``;
}

export function parseVisionAnalysisToCroquiSpecs(rawResponse: string, defaultOcasiao?: string): CroquiGenerationSpecs {
  let parsed: any = {};
  try {
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawResponse.trim()];
    const cleanStr = jsonMatch[1] || rawResponse.trim();
    parsed = JSON.parse(cleanStr);
  } catch (err) {
    console.warn('[VISION PARSER] Failed to parse raw JSON, using fallback:', err);
    parsed = { detalhes_extras: rawResponse.slice(0, 300) };
  }

  return synthesizeTechnicalSpecs(parsed, defaultOcasiao);
}

export function synthesizeTechnicalSpecs(data: any, defaultOcasiao?: string): CroquiGenerationSpecs {
  const peca = data.peca || 'Vestido';
  const comprimento = data.comprimento || (defaultOcasiao === 'Noiva' ? 'Longo' : 'Longo');
  const decote = data.decote || (data.top?.decote || 'Decote V');
  const manga = data.manga || (data.top?.manga || 'Sem Manga');
  const saia = data.saia || (data.bottom?.saia || 'Evasê');
  const renda = data.renda || null;
  const rendaDecisao = data.rendaDecisao !== undefined ? data.rendaDecisao : (!!renda);
  const biotipo = data.biotipo || 'Ampulheta';
  const ocasiao = defaultOcasiao || data.ocasiao || 'Festa';

  const comentario = data.detalhes_extras || data.comentario || (
    data.top?.detalhes || data.bottom?.detalhes
      ? `Upper bodice: ${data.top?.detalhes || ''}. Lower skirt: ${data.bottom?.detalhes || ''}.`
      : 'Harmonious custom atelier design synthesized from client reference images.'
  );

  return {
    peca,
    comprimento,
    decote,
    manga,
    saia,
    renda,
    rendaDecisao,
    biotipo,
    ocasiao,
    comentario,
  };
}
