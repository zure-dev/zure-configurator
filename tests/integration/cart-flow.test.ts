import { describe, it, expect, beforeAll } from 'vitest';
import {
  evaluateConfiguration,
  signConfiguration,
  computeDefaultSelections,
  generateLineItemProperties,
} from '@zure/rule-engine';
import type { ProductFamilyDefinition, ConfigurationInput } from '@zure/rule-engine';

/**
 * Integration tests for the full configuration → cart → order flow.
 * These tests simulate the complete user journey without a database.
 */

// Use the same fixture as the rule engine tests (representative Zure vanity)
const ZURE_VANITY: ProductFamilyDefinition = {
  id: 'pf_zure_vanity',
  name: 'Zure Vanity',
  slug: 'zure-vanity',
  basePrice: 1299,
  defaultMediaSet: [
    { url: '/images/default-hero.jpg', alt: 'Default', sortOrder: 0, type: 'hero' },
  ],
  ruleVersionId: 'rv_001',
  optionGroups: [
    {
      slug: 'vanity-size', name: 'Vanity Size', displayType: 'TILE', sortOrder: 1, isRequired: true, stepNumber: 1,
      values: [
        { slug: '600mm', name: '600mm', sortOrder: 0, isDefault: true },
        { slug: '900mm', name: '900mm', sortOrder: 1, isDefault: false },
        { slug: '1500mm', name: '1500mm', sortOrder: 2, isDefault: false },
      ],
    },
    {
      slug: 'cabinet-finish', name: 'Cabinet Finish', displayType: 'SWATCH', sortOrder: 2, isRequired: true, stepNumber: 1,
      values: [
        { slug: 'matte-white', name: 'Matte White', sortOrder: 0, isDefault: true, swatchColor: '#fff' },
        { slug: 'woodland-oak', name: 'Woodland Oak', sortOrder: 1, isDefault: false, swatchColor: '#8B6914' },
      ],
    },
    {
      slug: 'stone-top', name: 'Stone Top', displayType: 'TILE', sortOrder: 3, isRequired: true, stepNumber: 2,
      values: [
        { slug: 'stone-white', name: 'Stone White', sortOrder: 0, isDefault: true },
        { slug: 'calacatta-quartz', name: 'Calacatta Quartz', sortOrder: 1, isDefault: false },
      ],
    },
    {
      slug: 'handle-colour', name: 'Handle Colour', displayType: 'SWATCH', sortOrder: 4, isRequired: true, stepNumber: 3,
      values: [
        { slug: 'chrome', name: 'Chrome', sortOrder: 0, isDefault: true },
        { slug: 'matte-black', name: 'Matte Black', sortOrder: 1, isDefault: false },
      ],
    },
  ],
  dependencyRules: [],
  exclusionRules: [],
  priceRules: [
    { id: 'pr1', optionGroupSlug: 'vanity-size', optionValueSlug: '900mm', priceModifier: 400, modifierType: 'ADDITIVE' },
    { id: 'pr2', optionGroupSlug: 'vanity-size', optionValueSlug: '1500mm', priceModifier: 1000, modifierType: 'ADDITIVE' },
    { id: 'pr3', optionGroupSlug: 'stone-top', optionValueSlug: 'calacatta-quartz', priceModifier: 269, modifierType: 'ADDITIVE' },
  ],
  tradePriceRules: [],
  mediaRules: [],
  summaryRules: [
    { optionGroupSlug: 'vanity-size', template: 'Size: {{value}}', sortOrder: 1, includeInLineItem: true },
    { optionGroupSlug: 'cabinet-finish', template: 'Finish: {{value}}', sortOrder: 2, includeInLineItem: true },
    { optionGroupSlug: 'stone-top', template: 'Top: {{value}}', sortOrder: 3, includeInLineItem: true },
    { optionGroupSlug: 'handle-colour', template: 'Handle: {{value}}', sortOrder: 4, includeInLineItem: true },
  ],
  componentMaps: [
    { id: 'cm1', conditions: [{ optionGroupSlug: 'vanity-size', optionValueSlug: '900mm' }, { optionGroupSlug: 'cabinet-finish', optionValueSlug: 'woodland-oak' }], componentId: 'c1', componentSku: 'ZV-CAB-WO-900', componentName: 'Woodland Oak Cabinet 900mm', componentType: 'CABINET', quantity: 1 },
    { id: 'cm2', conditions: [{ optionGroupSlug: 'handle-colour', optionValueSlug: 'matte-black' }], componentId: 'c2', componentSku: 'ZV-HDL-MB', componentName: 'Matte Black Handle', componentType: 'HANDLE', quantity: 2 },
  ],
};

function makeInput(selections: Record<string, string>, isTrade = false): ConfigurationInput {
  return { productFamily: ZURE_VANITY, selections, customerContext: { isTradeCustomer: isTrade } };
}

describe('Integration: Configuration → Cart Flow', () => {
  it('completes a full configuration cycle', () => {
    // 1. Customer lands on page → compute defaults
    const defaults = computeDefaultSelections({ productFamily: ZURE_VANITY });
    expect(defaults['vanity-size']).toBe('600mm');

    // 2. Customer changes selections
    const selections = {
      ...defaults,
      'vanity-size': '900mm',
      'cabinet-finish': 'woodland-oak',
      'stone-top': 'calacatta-quartz',
      'handle-colour': 'matte-black',
    };

    // 3. Validate the configuration
    const result = evaluateConfiguration(makeInput(selections));
    expect(result.isValid).toBe(true);

    // 4. Verify pricing
    expect(result.pricing.basePrice).toBe(1299);
    expect(result.pricing.totalPrice).toBe(1299 + 400 + 269); // 1968

    // 5. Verify summary
    expect(result.summary.humanReadable).toContain('900mm');
    expect(result.summary.humanReadable).toContain('Woodland Oak');
    expect(result.summary.humanReadable).toContain('Calacatta Quartz');
    expect(result.summary.humanReadable).toContain('+$269.00');
    expect(result.summary.structured.length).toBe(4);

    // 6. Verify component mapping
    expect(result.components.mappings.length).toBe(2);
    const cabinet = result.components.mappings.find((m) => m.sku === 'ZV-CAB-WO-900');
    expect(cabinet).toBeDefined();
    expect(cabinet?.quantity).toBe(1);
    const handle = result.components.mappings.find((m) => m.sku === 'ZV-HDL-MB');
    expect(handle).toBeDefined();
    expect(handle?.quantity).toBe(2);

    // 7. Generate signature
    const signature = signConfiguration(makeInput(selections), result);
    expect(signature).toBeTruthy();
    expect(signature.startsWith('v1:')).toBe(true);

    // 8. Generate line item properties for Shopify cart
    const properties = generateLineItemProperties(result.summary, 'snap_test_123');
    expect(properties['_configuration_id']).toBe('snap_test_123');
    expect(properties['Vanity Size']).toContain('900mm');
    expect(properties['Cabinet Finish']).toBe('Woodland Oak');
    expect(properties['Stone Top']).toContain('Calacatta Quartz');
    expect(properties['Handle Colour']).toBe('Matte Black');
  });

  it('rejects invalid configurations server-side', () => {
    const result = evaluateConfiguration(makeInput({
      'vanity-size': '900mm',
      // missing required: cabinet-finish, stone-top, handle-colour
    }));

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.type === 'MISSING_REQUIRED')).toBe(true);
  });

  it('produces deterministic results (same input → same output)', () => {
    const selections = {
      'vanity-size': '900mm',
      'cabinet-finish': 'woodland-oak',
      'stone-top': 'calacatta-quartz',
      'handle-colour': 'chrome',
    };

    const result1 = evaluateConfiguration(makeInput(selections));
    const result2 = evaluateConfiguration(makeInput(selections));

    expect(result1.pricing.totalPrice).toBe(result2.pricing.totalPrice);
    expect(result1.summary.humanReadable).toBe(result2.summary.humanReadable);
    expect(result1.components.mappings.length).toBe(result2.components.mappings.length);
    expect(result1.isValid).toBe(result2.isValid);
  });

  it('preserves order summary parity with expected VO format', () => {
    const result = evaluateConfiguration(makeInput({
      'vanity-size': '900mm',
      'cabinet-finish': 'woodland-oak',
      'stone-top': 'calacatta-quartz',
      'handle-colour': 'matte-black',
    }));

    // The summary should contain all key information a staff member needs
    const summary = result.summary.humanReadable;
    expect(summary).toContain('Size');
    expect(summary).toContain('900mm');
    expect(summary).toContain('Finish');
    expect(summary).toContain('Woodland Oak');
    expect(summary).toContain('Top');
    expect(summary).toContain('Calacatta Quartz');
    expect(summary).toContain('Handle');
    expect(summary).toContain('Matte Black');

    // Price deltas should be visible
    expect(summary).toContain('+$');

    // Structured summary should have clean label/value pairs
    for (const line of result.summary.structured) {
      expect(line.label).toBeTruthy();
      expect(line.value).toBeTruthy();
    }
  });

  it('generates complete configuration snapshot data', () => {
    const input = makeInput({
      'vanity-size': '900mm',
      'cabinet-finish': 'woodland-oak',
      'stone-top': 'calacatta-quartz',
      'handle-colour': 'matte-black',
    });

    const result = evaluateConfiguration(input);

    // All snapshot fields should be populated
    expect(result.isValid).toBe(true);
    expect(result.pricing.basePrice).toBeGreaterThan(0);
    expect(result.pricing.totalPrice).toBeGreaterThan(0);
    expect(result.pricing.modifiers.length).toBeGreaterThan(0);
    expect(result.summary.humanReadable.length).toBeGreaterThan(0);
    expect(result.summary.structured.length).toBeGreaterThan(0);
    expect(result.components.mappings.length).toBeGreaterThan(0);
    expect(result.media.heroImage).toBeDefined();
    expect(result.availableOptions).toBeDefined();
    expect(Object.keys(result.availableOptions).length).toBeGreaterThan(0);

    // Every component mapping should have required fields
    for (const comp of result.components.mappings) {
      expect(comp.componentId).toBeTruthy();
      expect(comp.sku).toBeTruthy();
      expect(comp.name).toBeTruthy();
      expect(comp.type).toBeTruthy();
      expect(comp.quantity).toBeGreaterThan(0);
    }
  });
});
