import { describe, expect, it } from 'vitest';
import { assertReferenceGenerationTextOnly, buildReferenceSeedreamInput } from '../server/referenceGeneration';

describe('reference generation contract', () => {
  it('builds a text-only Seedream input', () => {
    const input = buildReferenceSeedreamInput('technical croqui prompt');

    expect(input).toEqual({
      prompt: 'technical croqui prompt',
      image_size: 'portrait_4_3',
      num_images: 1,
      enable_safety_checker: false,
    });
    expect(Object.keys(input)).not.toContain('image_urls');
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
