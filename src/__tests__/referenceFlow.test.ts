import { describe, it, expect } from 'vitest';
import {
  buildVisionPromptForSingleReference,
  buildVisionPromptForCompositeReference,
  parseVisionAnalysisToCroquiSpecs,
  synthesizeTechnicalSpecs,
} from '../lib/referenceUtils';

describe('Fluxo de Modelo de Referência - Vision LLM e Síntese de Croqui', () => {
  it('deve montar prompt de visão correto para 1 foto de referência única', () => {
    const prompt = buildVisionPromptForSingleReference('Noiva');
    expect(prompt).toContain('SINGLE REFERENCE IMAGE');
    expect(prompt).toContain('Noiva');
    expect(prompt).toContain('Ignore phone, mirrors, background clutter, or user poses');
    expect(prompt).toContain('JSON format');
  });

  it('deve montar prompt de visão correto para 2 fotos de referência (composição superior + inferior)', () => {
    const prompt = buildVisionPromptForCompositeReference('Festa');
    expect(prompt).toContain('TWO REFERENCE IMAGES (COMPOSITE FASHION DESIGN)');
    expect(prompt).toContain('IMAGE 1: TOP / BODICE');
    expect(prompt).toContain('IMAGE 2: BOTTOM / SKIRT / PANTS');
    expect(prompt).toContain('Festa');
    expect(prompt).toContain('Unify them into one seamless continuous garment');
  });

  it('deve converter a resposta JSON da visão em parâmetros padronizados de croqui', () => {
    const mockVisionJson = {
      peca: 'Vestido',
      comprimento: 'Longo',
      decote: 'Tomara que Caia',
      manga: 'Sem Manga',
      saia: 'Sereia',
      renda: 'Floral',
      rendaDecisao: true,
      detalhes_extras: 'Corpo estruturado em corset com fenda lateral sutil e cauda média',
    };

    const specs = parseVisionAnalysisToCroquiSpecs(JSON.stringify(mockVisionJson), 'Noiva');

    expect(specs.peca).toBe('Vestido');
    expect(specs.comprimento).toBe('Longo');
    expect(specs.decote).toBe('Tomara que Caia');
    expect(specs.manga).toBe('Sem Manga');
    expect(specs.saia).toBe('Sereia');
    expect(specs.renda).toBe('Floral');
    expect(specs.rendaDecisao).toBe(true);
    expect(specs.ocasiao).toBe('Noiva');
    expect(specs.comentario).toContain('Corpo estruturado');
  });

  it('deve sintetizar e sanitizar campos ausentes com fallbacks seguros', () => {
    const rawIncomplete = {
      peca: 'Vestido',
      detalhes_extras: 'Vestido minimalista liso',
    };

    const specs = synthesizeTechnicalSpecs(rawIncomplete, 'Festa');

    expect(specs.peca).toBe('Vestido');
    expect(specs.comprimento).toBe('Longo');
    expect(specs.ocasiao).toBe('Festa');
    expect(specs.comentario).toContain('Vestido minimalista liso');
  });

  it('deve unificar 2 fotos de vestidos diferentes em um único vestido coeso', () => {
    const compositeData = {
      top: {
        decote: 'Coração (Sweetheart)',
        manga: 'Sem Manga',
        detalhes: 'Corpete em renda francesa com barbatanas aparentes',
      },
      bottom: {
        saia: 'Godê',
        comprimento: 'Midi',
        detalhes: 'Saia fluida plissada com caimento leve',
      },
    };

    const specs = synthesizeTechnicalSpecs({
      peca: 'Vestido',
      decote: compositeData.top.decote,
      manga: compositeData.top.manga,
      saia: compositeData.bottom.saia,
      comprimento: compositeData.bottom.comprimento,
      detalhes_extras: `Upper bodice: ${compositeData.top.detalhes}. Lower skirt: ${compositeData.bottom.detalhes}. Unified as a single dress.`,
    }, 'Noiva');

    expect(specs.decote).toBe('Coração (Sweetheart)');
    expect(specs.saia).toBe('Godê');
    expect(specs.comprimento).toBe('Midi');
    expect(specs.comentario).toContain('Upper bodice: Corpete em renda francesa');
    expect(specs.comentario).toContain('Lower skirt: Saia fluida plissada');
  });
});
