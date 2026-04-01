// ──────────────────────────────────────────────
// RULE ENGINE TYPES
// Pure types, no runtime dependencies
// ──────────────────────────────────────────────

// ──── INPUT TYPES ────

/**
 * Full product family definition loaded from DB.
 * This is the "rule set" the engine evaluates against.
 */
export interface ProductFamilyDefinition {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  defaultMediaSet: MediaItem[];
  optionGroups: OptionGroupDefinition[];
  dependencyRules: DependencyRuleDefinition[];
  exclusionRules: ExclusionRuleDefinition[];
  priceRules: PriceRuleDefinition[];
  tradePriceRules: TradePriceRuleDefinition[];
  mediaRules: MediaRuleDefinition[];
  summaryRules: SummaryRuleDefinition[];
  componentMaps: ComponentMapDefinition[];
  ruleVersionId: string;
}

export interface OptionGroupDefinition {
  slug: string;
  name: string;
  displayType: string;
  sortOrder: number;
  isRequired: boolean;
  helperText?: string;
  stepNumber?: number;
  values: OptionValueDefinition[];
}

export interface OptionValueDefinition {
  slug: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  swatchColor?: string;
  swatchImage?: string;
  thumbnailUrl?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface DependencyRuleDefinition {
  id: string;
  name?: string;
  whenOptionGroupSlug: string;
  whenOptionValueSlug: string;
  thenOptionGroupSlug: string;
  thenOptionValueSlugs: string[];
}

export interface ExclusionRuleDefinition {
  id: string;
  name?: string;
  whenOptionGroupSlug: string;
  whenOptionValueSlug: string;
  excludeOptionGroupSlug: string;
  excludeOptionValueSlugs: string[];
}

export interface PriceRuleDefinition {
  id: string;
  optionGroupSlug: string;
  optionValueSlug: string;
  priceModifier: number;
  modifierType: PriceModifierType;
  conditions?: RuleCondition[];
}

export interface TradePriceRuleDefinition extends PriceRuleDefinition {
  tradeCondition: TradeCondition;
}

export interface MediaRuleDefinition {
  id: string;
  name?: string;
  priority: number;
  conditions: RuleCondition[];
  mediaSet: MediaItem[];
}

export interface SummaryRuleDefinition {
  optionGroupSlug: string;
  template: string;
  sortOrder: number;
  includeInLineItem: boolean;
}

export interface ComponentMapDefinition {
  id: string;
  conditions: RuleCondition[];
  componentId: string;
  componentSku: string;
  componentName: string;
  componentType: string;
  quantity: number;
}

// ──── SHARED TYPES ────

export interface RuleCondition {
  optionGroupSlug: string;
  optionValueSlug: string;
}

export interface TradeCondition {
  type: 'customer_tag' | 'company_location' | 'price_list';
  value: string;
}

export type PriceModifierType = 'ADDITIVE' | 'PERCENTAGE' | 'ABSOLUTE' | 'OVERRIDE';

export interface MediaItem {
  url: string;
  alt: string;
  sortOrder: number;
  type: 'hero' | 'gallery' | 'thumbnail';
}

// ──── EVALUATION INPUT ────

export interface ConfigurationInput {
  productFamily: ProductFamilyDefinition;
  selections: Record<string, string>; // { optionGroupSlug: optionValueSlug }
  customerContext: CustomerContext;
}

export interface CustomerContext {
  isTradeCustomer: boolean;
  tags?: string[];
  customerId?: string;
  companyId?: string;
}

// ──── EVALUATION OUTPUT ────

export interface ConfigurationResult {
  isValid: boolean;
  errors: ValidationError[];
  availableOptions: Record<string, AvailableOption[]>;
  pricing: PricingResult;
  media: MediaResult;
  summary: SummaryResult;
  components: ComponentResult;
}

export interface ValidationError {
  type: 'MISSING_REQUIRED' | 'INVALID_VALUE' | 'EXCLUDED_VALUE' | 'DEPENDENCY_UNMET';
  optionGroupSlug: string;
  optionValueSlug?: string;
  message: string;
}

export interface AvailableOption {
  slug: string;
  name: string;
  isAvailable: boolean;
  isDisabledReason?: string;
  swatchColor?: string;
  swatchImage?: string;
  thumbnailUrl?: string;
  description?: string;
  priceDelta?: number; // preview of price impact
}

export interface PricingResult {
  basePrice: number;
  modifiers: PriceModifierResult[];
  totalPrice: number;
  compareAtPrice?: number;
  isTradePrice: boolean;
}

export interface PriceModifierResult {
  optionGroupSlug: string;
  optionValueSlug: string;
  optionGroupName: string;
  optionValueName: string;
  delta: number;
  type: PriceModifierType;
}

export interface MediaResult {
  heroImage: MediaItem | null;
  gallery: MediaItem[];
  appliedRules: string[];
}

export interface SummaryResult {
  humanReadable: string;
  structured: SummaryLine[];
}

export interface SummaryLine {
  label: string;
  value: string;
  priceDelta: string | null; // e.g. "+$269.00" or null
}

export interface ComponentResult {
  mappings: ComponentMapping[];
}

export interface ComponentMapping {
  componentId: string;
  sku: string;
  name: string;
  type: string;
  quantity: number;
}
