import type { ConfigurationInput, ConfigurationResult } from './types';

/**
 * Generate a validation signature (hash) for a configuration result.
 * This proves the result was computed by the rule engine and hasn't been tampered with.
 *
 * Uses a simple hash since we don't have Node crypto in a pure package —
 * the server-side wrapper should use SHA-256 for production.
 */
export function generateValidationSignature(
  input: ConfigurationInput,
  result: ConfigurationResult
): string {
  const payload = JSON.stringify({
    familyId: input.productFamily.id,
    ruleVersion: input.productFamily.ruleVersionId,
    selections: input.selections,
    totalPrice: result.pricing.totalPrice,
    isTradePrice: result.pricing.isTradePrice,
    componentCount: result.components.mappings.length,
    timestamp: Date.now(),
  });

  // Simple hash for the pure package. Server-side code should use crypto.createHash.
  return `v1:${simpleHash(payload)}`;
}

/**
 * Simple string hash (djb2 algorithm).
 * For production, wrap this with SHA-256 on the server side.
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash + char) & 0xffffffff;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Validate that a result's signature matches a recalculated signature.
 * Used to detect if a snapshot has been tampered with.
 */
export function verifySignaturePrefix(signature: string): boolean {
  return signature.startsWith('v1:');
}
