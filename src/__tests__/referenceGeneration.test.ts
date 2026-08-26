import { describe, expect, it } from 'vitest';
import { assertReferenceGenerationTextOnly, buildReferenceSeedreamInput } from '../server/referenceGeneration';

describe('reference generation contract', () => {
  it('builds a Seedream input without client references by default', () => {
    const input = buildReferenceSeedreamInput('technical croqui prompt');

    expect(input).toEqual({
      prompt: 'technical croqui prompt',
      image_size: 'portrait_4_3',
      num_images: 1,
      enable_safety_checker: false,
    });
    expect(Object.keys(input)).not.toContain('image_urls');
  });

  it('inclui somente recortes anonimizados explicitamente fornecidos', () => {
    const input = buildReferenceSeedreamInput('technical croqui prompt', ['data:image/jpeg;base64,anon'], 123);
    expect(input.image_urls).toEqual(['data:image/jpeg;base64,anon']);
    expect(input.seed).toBe(123);
  });

  it('rejects reference image fields when the reference flow is generating', () => {
    expect(() => assertReferenceGenerationTextOnly({
      referenceAnalysis: { schemaVersion: 'reference-analysis-v1' },
      image_urls: ['https://example.test/reference.jpg'],
    })).toThrow('somente especificações textuais');
  });

  it('does not restrict the manual generation flow', () => {
    expect(() => assertReferenceGenerationTextOnly({ image_urls: ['previous-croqui'] })).not.toThrow();
  });
});
