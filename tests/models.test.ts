/**
 * whizzy models rendering.
 */

import { formatCatalogPrice, formatModelCatalog } from '../src/commands/models';
import type { ModelCatalog } from '../src/core/types';

const catalog: ModelCatalog = {
  version: '2026-11-25.1',
  operations: [
    {
      operation: 'image_edit',
      default: 'gpt-image-2',
      models: [
        {
          id: 'gpt-image-2',
          label: 'GPT Image 2',
          provider: 'openai',
          lifecycle: 'validated',
          reach: 'automatic',
          quality: 'standard',
          price: { unit: 'image', usd: 0.04, pricedAt: '2026-11-25', source: 'https://example.com/openai' },
        },
        {
          id: 'nano-banana-pro',
          label: 'Nano Banana Pro',
          provider: 'kieai',
          lifecycle: 'candidate',
          reach: 'explicit',
          quality: 'premium',
          price: { unit: 'image', usd: 0.09, pricedAt: '2026-11-25', source: 'https://kie.ai/pricing' },
          limits: { maxReferenceImages: 7 },
        },
      ],
    },
  ],
};

describe('formatModelCatalog', () => {
  it('marks the default and shows each model with provider, lifecycle, quality and dated price', () => {
    const out = formatModelCatalog(catalog);
    expect(out).toContain('Model catalogue 2026-11-25.1');
    expect(out).toContain('image_edit (default: gpt-image-2)');
    expect(out).toMatch(/\* gpt-image-2\s+GPT Image 2\s+openai\s+validated\s+standard\s+\$0\.04\/image \(2026-11-25\)/);
    expect(out).toMatch(/ {3}nano-banana-pro\s+Nano Banana Pro\s+kieai\s+candidate\s+premium\s+\$0\.09\/image/);
  });
});

describe('formatCatalogPrice', () => {
  it('names local compute and per-token prices', () => {
    expect(formatCatalogPrice({ unit: 'none', usd: 0, pricedAt: '2026-11-25', source: 'x' })).toBe('local (2026-11-25)');
    expect(formatCatalogPrice({ unit: 'mtok_in', usd: 1.25, pricedAt: '2026-11-25', source: 'x' })).toBe(
      '$1.25/Mtok in (2026-11-25)',
    );
  });
});
