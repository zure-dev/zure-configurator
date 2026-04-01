/**
 * API client for the Zure Configurator widget.
 * All storefront requests go through our backend, not directly to Shopify.
 */

interface ApiClientConfig {
  appUrl: string;
  shopDomain: string;
}

let config: ApiClientConfig = {
  appUrl: '',
  shopDomain: '',
};

export function initApiClient(cfg: ApiClientConfig) {
  config = cfg;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${config.appUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shop-Domain': config.shopDomain,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error ?? `HTTP ${response.status}`);
  }

  return response.json();
}

// ──── Session ────

export interface StartSessionResponse {
  sessionId: string;
  productFamily: {
    id: string;
    name: string;
    basePrice: number;
    optionGroups: OptionGroupData[];
  };
  defaults: Record<string, string>;
  initialEvaluation: EvaluationResult;
}

export interface OptionGroupData {
  slug: string;
  name: string;
  displayType: string;
  sortOrder: number;
  isRequired: boolean;
  helperText?: string;
  stepNumber?: number;
  values: OptionValueData[];
}

export interface OptionValueData {
  slug: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  swatchColor?: string;
  swatchImage?: string;
  thumbnailUrl?: string;
  description?: string;
}

export interface EvaluationResult {
  isValid: boolean;
  errors: Array<{ type: string; optionGroupSlug: string; message: string }>;
  availableOptions: Record<string, AvailableOptionData[]>;
  pricing: PricingData;
  media: MediaData;
  summary: SummaryData;
  components: { mappings: Array<{ sku: string; name: string; quantity: number }> };
}

export interface AvailableOptionData {
  slug: string;
  name: string;
  isAvailable: boolean;
  isDisabledReason?: string;
  priceDelta?: number;
  swatchColor?: string;
  swatchImage?: string;
  thumbnailUrl?: string;
}

export interface PricingData {
  basePrice: number;
  modifiers: Array<{
    optionGroupSlug: string;
    optionValueSlug: string;
    optionGroupName: string;
    optionValueName: string;
    delta: number;
  }>;
  totalPrice: number;
  compareAtPrice?: number;
  isTradePrice: boolean;
}

export interface MediaData {
  heroImage: { url: string; alt: string } | null;
  gallery: Array<{ url: string; alt: string; sortOrder: number }>;
  appliedRules: string[];
}

export interface SummaryData {
  humanReadable: string;
  structured: Array<{ label: string; value: string; priceDelta: string | null }>;
}

export async function startSession(
  shopifyProductId: string,
  customerIdent?: string,
  isTradeCustomer?: boolean
): Promise<StartSessionResponse> {
  return request('/api/configure/session/start', {
    method: 'POST',
    body: JSON.stringify({ shopifyProductId, customerIdent, isTradeCustomer }),
  });
}

// ──── Validate ────

export async function validateConfiguration(
  sessionId: string,
  selections: Record<string, string>,
  customerContext?: { isTradeCustomer: boolean; tags?: string[] }
): Promise<EvaluationResult> {
  return request('/api/configure/validate', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      selections,
      customerContext: customerContext ?? { isTradeCustomer: false },
    }),
  });
}

// ──── Cart ────

export interface CartPrepareResponse {
  success: boolean;
  errors?: Array<{ type: string; message: string }>;
  snapshotId?: string;
  cartPayload?: {
    variantId: string;
    quantity: number;
    properties: Record<string, string>;
  };
  resolvedPrice?: number;
  summary?: string;
}

export async function prepareCart(
  sessionId: string,
  selections: Record<string, string>,
  customerContext?: { isTradeCustomer: boolean }
): Promise<CartPrepareResponse> {
  return request('/api/cart/prepare', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      selections,
      customerContext: customerContext ?? { isTradeCustomer: false },
    }),
  });
}

// ──── Shopify Cart API (client-side) ────

export async function addToShopifyCart(payload: {
  variantId: string;
  quantity: number;
  properties: Record<string, string>;
}): Promise<void> {
  const id = payload.variantId.replace(/\D/g, ''); // extract numeric ID

  const response = await fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: Number(id),
      quantity: payload.quantity,
      properties: payload.properties,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ description: 'Failed to add to cart' }));
    throw new Error(error.description ?? 'Failed to add to cart');
  }
}
