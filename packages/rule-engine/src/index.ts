// @zure/rule-engine — Pure TypeScript configuration engine
// Zero framework dependencies. Deterministic. Versioned.

export {
  evaluateConfiguration,
  validateConfigurationOnly,
  signConfiguration,
  computeDefaultSelections,
} from './evaluator';

export { generateLineItemProperties } from './summary';

export type {
  // Input types
  ProductFamilyDefinition,
  OptionGroupDefinition,
  OptionValueDefinition,
  DependencyRuleDefinition,
  ExclusionRuleDefinition,
  PriceRuleDefinition,
  TradePriceRuleDefinition,
  MediaRuleDefinition,
  SummaryRuleDefinition,
  ComponentMapDefinition,
  ConfigurationInput,
  CustomerContext,
  RuleCondition,
  TradeCondition,
  PriceModifierType,
  MediaItem,

  // Output types
  ConfigurationResult,
  ValidationError,
  AvailableOption,
  PricingResult,
  PriceModifierResult,
  MediaResult,
  SummaryResult,
  SummaryLine,
  ComponentResult,
  ComponentMapping,
} from './types';
