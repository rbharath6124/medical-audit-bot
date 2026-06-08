interface PriceTier {
  input: number;
  output: number;
  cachedInput?: number;
}

interface TieredPrice {
  threshold?: number;
  belowOrEqual: PriceTier;
  above?: PriceTier;
}

/**
 * Gemini Developer API Standard paid-tier pricing per 1M tokens in USD.
 * Output pricing includes thinking tokens.
 * Source checked: https://ai.google.dev/gemini-api/docs/pricing
 */
export const PRICES: Record<string, TieredPrice> = {
  "gemini-2.5-pro": {
    threshold: 200_000,
    belowOrEqual: { input: 1.25, output: 10.00, cachedInput: 0.125 },
    above: { input: 2.50, output: 15.00, cachedInput: 0.25 },
  },
  "gemini-2.5-flash": {
    belowOrEqual: { input: 0.30, output: 2.50, cachedInput: 0.03 },
  },
  "gemini-2.5-flash-lite": {
    belowOrEqual: { input: 0.10, output: 0.40, cachedInput: 0.01 },
  },
  "gemini-2.0-flash": {
    belowOrEqual: { input: 0.10, output: 0.40 },
  },
  "gemini-2.0-flash-lite": {
    belowOrEqual: { input: 0.075, output: 0.30 },
  },
};

export function getCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  thinkingTokens: number,
  cachedInputTokens = 0,
): number {
  const tier = getPriceTier(model, inputTokens);
  const billableCachedInputTokens = Math.min(inputTokens, Math.max(0, cachedInputTokens));
  const billableInputTokens = Math.max(0, inputTokens - billableCachedInputTokens);
  const billableOutputTokens = outputTokens + thinkingTokens;
  return (billableInputTokens / 1_000_000) * tier.input
    + (billableCachedInputTokens / 1_000_000) * (tier.cachedInput ?? tier.input)
    + (billableOutputTokens / 1_000_000) * tier.output;
}

export function getCostInRupees(
  model: string,
  inputTokens: number,
  outputTokens: number,
  thinkingTokens: number,
  usdToInr = 84,
  cachedInputTokens = 0,
): number {
  return getCost(model, inputTokens, outputTokens, thinkingTokens, cachedInputTokens) * usdToInr;
}

export function describePrice(model: string): string {
  const price = PRICES[model] || PRICES["gemini-2.5-flash"];
  if (price.threshold && price.above) {
    return `$${price.belowOrEqual.input}/M input and $${price.belowOrEqual.output}/M output <=${price.threshold.toLocaleString()} input tokens; $${price.above.input}/M input and $${price.above.output}/M output above that. Output includes thinking tokens.`;
  }
  return `$${price.belowOrEqual.input}/M input and $${price.belowOrEqual.output}/M output. Output includes thinking tokens.`;
}

function getPriceTier(model: string, inputTokens: number): PriceTier {
  const price = PRICES[model] || PRICES["gemini-2.5-flash"];
  if (price.threshold && price.above && inputTokens > price.threshold) {
    return price.above;
  }
  return price.belowOrEqual;
}

export function formatCostUsd(amount: number): string {
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
}

export function formatCostInr(amount: number): string {
  if (amount < 1) return `₹${amount.toFixed(2)}`;
  return `₹${amount.toFixed(2)}`;
}
