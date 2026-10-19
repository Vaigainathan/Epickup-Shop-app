import { describe, expect, it } from '@jest/globals';

import {
  applyOptionNameToVariants,
  dominantAttributeLabel,
  hasMixedAttributeLabels,
} from '@/lib/variant-option-name';

describe('dominantAttributeLabel', () => {
  it('returns the most common label', () => {
    const variants = [
      { attributeLabel: 'Size' },
      { attributeLabel: 'Size' },
      { attributeLabel: 'Color' },
    ];
    expect(dominantAttributeLabel(variants)).toBe('Size');
  });

  it('detects mixed labels', () => {
    expect(hasMixedAttributeLabels([{ attributeLabel: 'A' }, { attributeLabel: 'B' }])).toBe(true);
    expect(hasMixedAttributeLabels([{ attributeLabel: 'A' }, { attributeLabel: 'A' }])).toBe(false);
  });
});

describe('applyOptionNameToVariants', () => {
  it('sets attributeLabel on every variant', () => {
    const variants = [
      { attributeLabel: 'Old', value: 'S' },
      { attributeLabel: 'Other', value: 'M' },
    ];
    expect(applyOptionNameToVariants(variants, 'Size')).toEqual([
      { attributeLabel: 'Size', value: 'S' },
      { attributeLabel: 'Size', value: 'M' },
    ]);
  });
});
