export type VariantLabelSource = {
  attributeLabel: string;
};

export function dominantAttributeLabel(variants: VariantLabelSource[]): string {
  const labels = variants
    .map((variant) => variant.attributeLabel.trim())
    .filter((label) => label.length > 0);
  if (labels.length === 0) return '';

  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  let best = labels[0];
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = label;
    }
  }
  return best;
}

export function hasMixedAttributeLabels(variants: VariantLabelSource[]): boolean {
  const unique = new Set(
    variants.map((variant) => variant.attributeLabel.trim()).filter((label) => label.length > 0),
  );
  return unique.size > 1;
}

export function applyOptionNameToVariants<T extends VariantLabelSource>(
  variants: T[],
  optionName: string,
): T[] {
  const label = optionName.trim();
  return variants.map((variant) => ({ ...variant, attributeLabel: label }));
}
