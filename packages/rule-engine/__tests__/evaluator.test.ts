import { describe, it, expect } from 'vitest';
import {
  evaluateConfiguration,
  validateConfigurationOnly,
  computeDefaultSelections,
  signConfiguration,
} from '../src/evaluator';
import type { ProductFamilyDefinition, ConfigurationInput } from '../src/types';

// ──────────────────────────────────────────────
// TEST FIXTURES — Zure Vanity Product Family
// ──────────────────────────────────────────────

const ZURE_VANITY: ProductFamilyDefinition = {
  id: 'pf_zure_vanity',
  name: 'Zure Vanity',
  slug: 'zure-vanity',
  basePrice: 1299,
  defaultMediaSet: [
    { url: 'https://cdn.example.com/vanity-default-hero.jpg', alt: 'Zure Vanity', sortOrder: 0, type: 'hero' },
    { url: 'https://cdn.example.com/vanity-default-1.jpg', alt: 'Zure Vanity angle', sortOrder: 1, type: 'gallery' },
  ],
  ruleVersionId: 'rv_001',

  optionGroups: [
    {
      slug: 'vanity-size',
      name: 'Vanity Size',
      displayType: 'TILE',
      sortOrder: 1,
      isRequired: true,
      stepNumber: 1,
      values: [
        { slug: '600mm', name: '600mm', sortOrder: 0, isDefault: true },
        { slug: '750mm', name: '750mm', sortOrder: 1, isDefault: false },
        { slug: '900mm', name: '900mm', sortOrder: 2, isDefault: false },
        { slug: '1200mm', name: '1200mm', sortOrder: 3, isDefault: false },
        { slug: '1500mm', name: '1500mm', sortOrder: 4, isDefault: false },
      ],
    },
    {
      slug: 'cabinet-finish',
      name: 'Cabinet Finish',
      displayType: 'SWATCH',
      sortOrder: 2,
      isRequired: true,
      stepNumber: 1,
      values: [
        { slug: 'matte-white', name: 'Matte White', sortOrder: 0, isDefault: true, swatchColor: '#FFFFFF' },
        { slug: 'matte-black', name: 'Matte Black', sortOrder: 1, isDefault: false, swatchColor: '#1A1A1A' },
        { slug: 'woodland-oak', name: 'Woodland Oak', sortOrder: 2, isDefault: false, swatchColor: '#8B6914' },
        { slug: 'dark-timber', name: 'Dark Timber', sortOrder: 3, isDefault: false, swatchColor: '#3E2723' },
      ],
    },
    {
      slug: 'stone-top',
      name: 'Stone Top',
      displayType: 'TILE',
      sortOrder: 3,
      isRequired: true,
      stepNumber: 2,
      values: [
        { slug: 'no-top', name: 'No Top (Cabinet Only)', sortOrder: 0, isDefault: false },
        { slug: 'stone-white', name: 'Stone White', sortOrder: 1, isDefault: true },
        { slug: 'calacatta-quartz', name: 'Calacatta Quartz', sortOrder: 2, isDefault: false },
        { slug: 'engineered-stone', name: 'Engineered Stone', sortOrder: 3, isDefault: false },
      ],
    },
    {
      slug: 'basin-type',
      name: 'Basin Type',
      displayType: 'THUMBNAIL',
      sortOrder: 4,
      isRequired: false,
      stepNumber: 3,
      values: [
        { slug: 'no-basin', name: 'No Basin', sortOrder: 0, isDefault: false },
        { slug: 'undermount', name: 'Undermount', sortOrder: 1, isDefault: true },
        { slug: 'above-counter-oval', name: 'Above Counter Oval', sortOrder: 2, isDefault: false },
        { slug: 'above-counter-rect', name: 'Above Counter Rectangle', sortOrder: 3, isDefault: false },
      ],
    },
    {
      slug: 'basin-position',
      name: 'Basin Position',
      displayType: 'TILE',
      sortOrder: 5,
      isRequired: false,
      stepNumber: 4,
      values: [
        { slug: 'centre', name: 'Centre', sortOrder: 0, isDefault: true },
        { slug: 'left', name: 'Left', sortOrder: 1, isDefault: false },
        { slug: 'right', name: 'Right', sortOrder: 2, isDefault: false },
        { slug: 'double', name: 'Double', sortOrder: 3, isDefault: false },
      ],
    },
    {
      slug: 'tap-holes',
      name: 'Tap Holes',
      displayType: 'RADIO',
      sortOrder: 6,
      isRequired: true,
      stepNumber: 4,
      values: [
        { slug: 'no-hole', name: 'No Tap Hole', sortOrder: 0, isDefault: false },
        { slug: '1-hole', name: '1 Tap Hole', sortOrder: 1, isDefault: true },
        { slug: '3-holes', name: '3 Tap Holes', sortOrder: 2, isDefault: false },
      ],
    },
    {
      slug: 'handle-colour',
      name: 'Handle Colour',
      displayType: 'SWATCH',
      sortOrder: 7,
      isRequired: true,
      stepNumber: 5,
      values: [
        { slug: 'chrome', name: 'Chrome', sortOrder: 0, isDefault: true, swatchColor: '#C0C0C0' },
        { slug: 'matte-black', name: 'Matte Black', sortOrder: 1, isDefault: false, swatchColor: '#1A1A1A' },
        { slug: 'brushed-nickel', name: 'Brushed Nickel', sortOrder: 2, isDefault: false, swatchColor: '#B0A898' },
        { slug: 'brushed-gold', name: 'Brushed Gold', sortOrder: 3, isDefault: false, swatchColor: '#CFB53B' },
      ],
    },
    {
      slug: 'plug-waste',
      name: 'Plug & Waste',
      displayType: 'DROPDOWN',
      sortOrder: 8,
      isRequired: false,
      stepNumber: 6,
      values: [
        { slug: 'none', name: 'None', sortOrder: 0, isDefault: true },
        { slug: 'chrome-popup', name: 'Chrome Pop-Up', sortOrder: 1, isDefault: false },
        { slug: 'matte-black-popup', name: 'Matte Black Pop-Up', sortOrder: 2, isDefault: false },
        { slug: 'brushed-nickel-popup', name: 'Brushed Nickel Pop-Up', sortOrder: 3, isDefault: false },
      ],
    },
  ],

  // ──── DEPENDENCY RULES ────
  dependencyRules: [
    {
      id: 'dep_001',
      name: '600mm can only have centre basin',
      whenOptionGroupSlug: 'vanity-size',
      whenOptionValueSlug: '600mm',
      thenOptionGroupSlug: 'basin-position',
      thenOptionValueSlugs: ['centre'],
    },
    {
      id: 'dep_002',
      name: 'Double basin only on 1200mm+',
      whenOptionGroupSlug: 'vanity-size',
      whenOptionValueSlug: '1200mm',
      thenOptionGroupSlug: 'basin-position',
      thenOptionValueSlugs: ['centre', 'left', 'right', 'double'],
    },
    {
      id: 'dep_003',
      name: 'Double basin only on 1500mm',
      whenOptionGroupSlug: 'vanity-size',
      whenOptionValueSlug: '1500mm',
      thenOptionGroupSlug: 'basin-position',
      thenOptionValueSlugs: ['centre', 'left', 'right', 'double'],
    },
    {
      id: 'dep_004',
      name: 'No top means no basin',
      whenOptionGroupSlug: 'stone-top',
      whenOptionValueSlug: 'no-top',
      thenOptionGroupSlug: 'basin-type',
      thenOptionValueSlugs: ['no-basin'],
    },
    {
      id: 'dep_005',
      name: 'No top means no tap holes',
      whenOptionGroupSlug: 'stone-top',
      whenOptionValueSlug: 'no-top',
      thenOptionGroupSlug: 'tap-holes',
      thenOptionValueSlugs: ['no-hole'],
    },
  ],

  // ──── EXCLUSION RULES ────
  exclusionRules: [
    {
      id: 'exc_001',
      name: 'Above counter basin excludes 3 tap holes',
      whenOptionGroupSlug: 'basin-type',
      whenOptionValueSlug: 'above-counter-oval',
      excludeOptionGroupSlug: 'tap-holes',
      excludeOptionValueSlugs: ['3-holes'],
    },
    {
      id: 'exc_002',
      name: 'Above counter rect also excludes 3 tap holes',
      whenOptionGroupSlug: 'basin-type',
      whenOptionValueSlug: 'above-counter-rect',
      excludeOptionGroupSlug: 'tap-holes',
      excludeOptionValueSlugs: ['3-holes'],
    },
  ],

  // ──── PRICE RULES (retail) ────
  priceRules: [
    { id: 'pr_001', optionGroupSlug: 'vanity-size', optionValueSlug: '750mm', priceModifier: 200, modifierType: 'ADDITIVE' },
    { id: 'pr_002', optionGroupSlug: 'vanity-size', optionValueSlug: '900mm', priceModifier: 400, modifierType: 'ADDITIVE' },
    { id: 'pr_003', optionGroupSlug: 'vanity-size', optionValueSlug: '1200mm', priceModifier: 700, modifierType: 'ADDITIVE' },
    { id: 'pr_004', optionGroupSlug: 'vanity-size', optionValueSlug: '1500mm', priceModifier: 1000, modifierType: 'ADDITIVE' },
    { id: 'pr_005', optionGroupSlug: 'stone-top', optionValueSlug: 'calacatta-quartz', priceModifier: 269, modifierType: 'ADDITIVE' },
    { id: 'pr_006', optionGroupSlug: 'stone-top', optionValueSlug: 'engineered-stone', priceModifier: 349, modifierType: 'ADDITIVE' },
    { id: 'pr_007', optionGroupSlug: 'stone-top', optionValueSlug: 'no-top', priceModifier: -200, modifierType: 'ADDITIVE' },
    { id: 'pr_008', optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-oval', priceModifier: 199, modifierType: 'ADDITIVE' },
    { id: 'pr_009', optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-rect', priceModifier: 229, modifierType: 'ADDITIVE' },
    { id: 'pr_010', optionGroupSlug: 'handle-colour', optionValueSlug: 'brushed-gold', priceModifier: 49, modifierType: 'ADDITIVE' },
    { id: 'pr_011', optionGroupSlug: 'plug-waste', optionValueSlug: 'chrome-popup', priceModifier: 59, modifierType: 'ADDITIVE' },
    { id: 'pr_012', optionGroupSlug: 'plug-waste', optionValueSlug: 'matte-black-popup', priceModifier: 89, modifierType: 'ADDITIVE' },
    { id: 'pr_013', optionGroupSlug: 'plug-waste', optionValueSlug: 'brushed-nickel-popup', priceModifier: 79, modifierType: 'ADDITIVE' },
  ],

  // ──── TRADE PRICE RULES ────
  tradePriceRules: [
    { id: 'tpr_001', optionGroupSlug: 'vanity-size', optionValueSlug: '750mm', priceModifier: 150, modifierType: 'ADDITIVE', tradeCondition: { type: 'customer_tag', value: 'trade' } },
    { id: 'tpr_002', optionGroupSlug: 'vanity-size', optionValueSlug: '900mm', priceModifier: 300, modifierType: 'ADDITIVE', tradeCondition: { type: 'customer_tag', value: 'trade' } },
    { id: 'tpr_003', optionGroupSlug: 'vanity-size', optionValueSlug: '1200mm', priceModifier: 525, modifierType: 'ADDITIVE', tradeCondition: { type: 'customer_tag', value: 'trade' } },
    { id: 'tpr_004', optionGroupSlug: 'vanity-size', optionValueSlug: '1500mm', priceModifier: 750, modifierType: 'ADDITIVE', tradeCondition: { type: 'customer_tag', value: 'trade' } },
    { id: 'tpr_005', optionGroupSlug: 'stone-top', optionValueSlug: 'calacatta-quartz', priceModifier: 200, modifierType: 'ADDITIVE', tradeCondition: { type: 'customer_tag', value: 'trade' } },
    { id: 'tpr_006', optionGroupSlug: 'stone-top', optionValueSlug: 'engineered-stone', priceModifier: 260, modifierType: 'ADDITIVE', tradeCondition: { type: 'customer_tag', value: 'trade' } },
    { id: 'tpr_007', optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-oval', priceModifier: 149, modifierType: 'ADDITIVE', tradeCondition: { type: 'customer_tag', value: 'trade' } },
  ],

  // ──── MEDIA RULES ────
  mediaRules: [
    {
      id: 'mr_finish_woodland',
      name: 'Woodland Oak finish media',
      priority: 10,
      conditions: [{ optionGroupSlug: 'cabinet-finish', optionValueSlug: 'woodland-oak' }],
      mediaSet: [
        { url: 'https://cdn.example.com/woodland-oak-hero.jpg', alt: 'Woodland Oak Vanity', sortOrder: 0, type: 'hero' },
        { url: 'https://cdn.example.com/woodland-oak-1.jpg', alt: 'Woodland Oak detail', sortOrder: 1, type: 'gallery' },
      ],
    },
    {
      id: 'mr_finish_black',
      name: 'Matte Black finish media',
      priority: 10,
      conditions: [{ optionGroupSlug: 'cabinet-finish', optionValueSlug: 'matte-black' }],
      mediaSet: [
        { url: 'https://cdn.example.com/matte-black-hero.jpg', alt: 'Matte Black Vanity', sortOrder: 0, type: 'hero' },
        { url: 'https://cdn.example.com/matte-black-1.jpg', alt: 'Matte Black detail', sortOrder: 1, type: 'gallery' },
      ],
    },
    {
      id: 'mr_basin_above_counter',
      name: 'Above counter basin media',
      priority: 20,
      conditions: [{ optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-oval' }],
      mediaSet: [
        { url: 'https://cdn.example.com/above-counter-hero.jpg', alt: 'Above Counter Basin', sortOrder: 0, type: 'hero' },
        { url: 'https://cdn.example.com/above-counter-1.jpg', alt: 'Above Counter detail', sortOrder: 1, type: 'gallery' },
      ],
    },
    {
      id: 'mr_exact_woodland_calacatta',
      name: 'Exact: Woodland Oak + Calacatta',
      priority: 30,
      conditions: [
        { optionGroupSlug: 'cabinet-finish', optionValueSlug: 'woodland-oak' },
        { optionGroupSlug: 'stone-top', optionValueSlug: 'calacatta-quartz' },
      ],
      mediaSet: [
        { url: 'https://cdn.example.com/woodland-calacatta-hero.jpg', alt: 'Woodland Oak with Calacatta', sortOrder: 0, type: 'hero' },
        { url: 'https://cdn.example.com/woodland-calacatta-1.jpg', alt: 'Detail view', sortOrder: 1, type: 'gallery' },
      ],
    },
  ],

  // ──── SUMMARY RULES ────
  summaryRules: [
    { optionGroupSlug: 'vanity-size', template: 'Size: {{value}}', sortOrder: 1, includeInLineItem: true },
    { optionGroupSlug: 'cabinet-finish', template: 'Finish: {{value}}', sortOrder: 2, includeInLineItem: true },
    { optionGroupSlug: 'stone-top', template: 'Top: {{value}}', sortOrder: 3, includeInLineItem: true },
    { optionGroupSlug: 'basin-type', template: 'Basin: {{value}}', sortOrder: 4, includeInLineItem: true },
    { optionGroupSlug: 'basin-position', template: 'Position: {{value}}', sortOrder: 5, includeInLineItem: true },
    { optionGroupSlug: 'tap-holes', template: 'Tap Holes: {{value}}', sortOrder: 6, includeInLineItem: true },
    { optionGroupSlug: 'handle-colour', template: 'Handle: {{value}}', sortOrder: 7, includeInLineItem: true },
    { optionGroupSlug: 'plug-waste', template: 'Plug & Waste: {{value}}', sortOrder: 8, includeInLineItem: true },
  ],

  // ──── COMPONENT MAPS ────
  componentMaps: [
    {
      id: 'cm_001',
      conditions: [{ optionGroupSlug: 'vanity-size', optionValueSlug: '900mm' }, { optionGroupSlug: 'cabinet-finish', optionValueSlug: 'woodland-oak' }],
      componentId: 'comp_001', componentSku: 'ZV-CAB-WO-900', componentName: 'Woodland Oak Cabinet 900mm', componentType: 'CABINET', quantity: 1,
    },
    {
      id: 'cm_002',
      conditions: [{ optionGroupSlug: 'stone-top', optionValueSlug: 'calacatta-quartz' }, { optionGroupSlug: 'vanity-size', optionValueSlug: '900mm' }],
      componentId: 'comp_014', componentSku: 'ZV-TOP-CAL-900', componentName: 'Calacatta Quartz Top 900mm', componentType: 'STONE_TOP', quantity: 1,
    },
    {
      id: 'cm_003',
      conditions: [{ optionGroupSlug: 'basin-type', optionValueSlug: 'above-counter-oval' }],
      componentId: 'comp_028', componentSku: 'ZV-BAS-ACO', componentName: 'Above Counter Oval Basin', componentType: 'BASIN', quantity: 1,
    },
    {
      id: 'cm_004',
      conditions: [{ optionGroupSlug: 'handle-colour', optionValueSlug: 'matte-black' }],
      componentId: 'comp_041', componentSku: 'ZV-HDL-MB', componentName: 'Matte Black Handle', componentType: 'HANDLE', quantity: 2,
    },
    {
      id: 'cm_005',
      conditions: [{ optionGroupSlug: 'plug-waste', optionValueSlug: 'matte-black-popup' }],
      componentId: 'comp_055', componentSku: 'ZV-PW-MB-POP', componentName: 'Matte Black Pop-Up Waste', componentType: 'PLUG_WASTE', quantity: 1,
    },
  ],
};

// Helper to build input
function makeInput(
  selections: Record<string, string>,
  isTradeCustomer = false,
  tags: string[] = []
): ConfigurationInput {
  return {
    productFamily: ZURE_VANITY,
    selections,
    customerContext: { isTradeCustomer, tags },
  };
}

// ──────────────────────────────────────────────
// TESTS
// ──────────────────────────────────────────────

describe('Rule Engine — Evaluator', () => {
  describe('Default selections', () => {
    it('computes correct defaults', () => {
      const defaults = computeDefaultSelections({ productFamily: ZURE_VANITY });
      expect(defaults['vanity-size']).toBe('600mm');
      expect(defaults['cabinet-finish']).toBe('matte-white');
      expect(defaults['stone-top']).toBe('stone-white');
      expect(defaults['basin-type']).toBe('undermount');
      expect(defaults['handle-colour']).toBe('chrome');
    });
  });

  describe('Validation', () => {
    it('passes with all required fields', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'woodland-oak',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when required field missing', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'woodland-oak',
        // stone-top missing (required)
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_REQUIRED' && e.optionGroupSlug === 'stone-top')).toBe(true);
    });

    it('fails with invalid value', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '999mm', // doesn't exist
        'cabinet-finish': 'woodland-oak',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'INVALID_VALUE')).toBe(true);
    });
  });

  describe('Exclusion rules', () => {
    it('disables 3 tap holes when above counter basin selected', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'basin-type': 'above-counter-oval',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));

      const tapHoleOptions = result.availableOptions['tap-holes'];
      expect(tapHoleOptions).toBeDefined();
      const threeHoles = tapHoleOptions!.find(o => o.slug === '3-holes');
      expect(threeHoles?.isAvailable).toBe(false);
    });

    it('flags error when excluded value is selected', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'basin-type': 'above-counter-oval',
        'tap-holes': '3-holes', // excluded!
        'handle-colour': 'chrome',
      }));

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'EXCLUDED_VALUE' && e.optionGroupSlug === 'tap-holes')).toBe(true);
    });
  });

  describe('Dependency rules', () => {
    it('restricts 600mm to centre basin position only', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '600mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'basin-type': 'undermount',
        'basin-position': 'centre',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));

      const positionOptions = result.availableOptions['basin-position'];
      expect(positionOptions).toBeDefined();

      const centre = positionOptions!.find(o => o.slug === 'centre');
      const left = positionOptions!.find(o => o.slug === 'left');
      const double = positionOptions!.find(o => o.slug === 'double');

      expect(centre?.isAvailable).toBe(true);
      expect(left?.isAvailable).toBe(false);
      expect(double?.isAvailable).toBe(false);
    });

    it('allows double basin on 1500mm', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '1500mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'basin-type': 'undermount',
        'basin-position': 'double',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));

      const positionOptions = result.availableOptions['basin-position'];
      const double = positionOptions!.find(o => o.slug === 'double');
      expect(double?.isAvailable).toBe(true);
    });

    it('no-top forces no-basin and no-tap-holes', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'no-top',
        'basin-type': 'no-basin',
        'tap-holes': 'no-hole',
        'handle-colour': 'chrome',
      }));

      expect(result.isValid).toBe(true);

      const basinOptions = result.availableOptions['basin-type'];
      const undermount = basinOptions!.find(o => o.slug === 'undermount');
      expect(undermount?.isAvailable).toBe(false);

      const tapOptions = result.availableOptions['tap-holes'];
      const oneHole = tapOptions!.find(o => o.slug === '1-hole');
      expect(oneHole?.isAvailable).toBe(false);
    });
  });

  describe('Pricing — Retail', () => {
    it('calculates base price for default selections', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '600mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.pricing.totalPrice).toBe(1299);
      expect(result.pricing.modifiers).toHaveLength(0);
      expect(result.pricing.isTradePrice).toBe(false);
    });

    it('adds size upgrade price', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.pricing.totalPrice).toBe(1699); // 1299 + 400
    });

    it('accumulates multiple modifiers', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',          // +400
        'cabinet-finish': 'woodland-oak',
        'stone-top': 'calacatta-quartz', // +269
        'basin-type': 'above-counter-oval', // +199
        'tap-holes': '1-hole',
        'handle-colour': 'brushed-gold', // +49
        'plug-waste': 'matte-black-popup', // +89
      }));
      expect(result.pricing.totalPrice).toBe(1299 + 400 + 269 + 199 + 49 + 89);
      expect(result.pricing.totalPrice).toBe(2305);
    });

    it('subtracts for no-top', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '600mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'no-top',          // -200
        'basin-type': 'no-basin',
        'tap-holes': 'no-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.pricing.totalPrice).toBe(1099); // 1299 - 200
    });
  });

  describe('Pricing — Trade', () => {
    it('applies trade pricing for tagged customer', () => {
      const result = evaluateConfiguration(makeInput(
        {
          'vanity-size': '900mm',
          'cabinet-finish': 'matte-white',
          'stone-top': 'calacatta-quartz',
          'tap-holes': '1-hole',
          'handle-colour': 'chrome',
        },
        true,
        ['trade']
      ));

      expect(result.pricing.isTradePrice).toBe(true);
      // Trade: 1299 + 300 (900mm trade) + 200 (calacatta trade) = 1799
      expect(result.pricing.totalPrice).toBe(1799);
    });

    it('shows compare-at price for trade customers', () => {
      const result = evaluateConfiguration(makeInput(
        {
          'vanity-size': '900mm',
          'cabinet-finish': 'matte-white',
          'stone-top': 'calacatta-quartz',
          'tap-holes': '1-hole',
          'handle-colour': 'chrome',
        },
        true,
        ['trade']
      ));

      // Retail would be 1299 + 400 + 269 = 1968
      expect(result.pricing.compareAtPrice).toBe(1968);
      expect(result.pricing.totalPrice).toBeLessThan(result.pricing.compareAtPrice!);
    });
  });

  describe('Media resolution', () => {
    it('uses family default when no rules match', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '600mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.media.heroImage?.url).toBe('https://cdn.example.com/vanity-default-hero.jpg');
      expect(result.media.appliedRules).toHaveLength(0);
    });

    it('applies finish override (priority 10)', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'woodland-oak',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.media.heroImage?.url).toBe('https://cdn.example.com/woodland-oak-hero.jpg');
      expect(result.media.appliedRules).toContain('mr_finish_woodland');
    });

    it('basin override (priority 20) beats finish override (priority 10)', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'woodland-oak',
        'stone-top': 'stone-white',
        'basin-type': 'above-counter-oval',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.media.heroImage?.url).toBe('https://cdn.example.com/above-counter-hero.jpg');
    });

    it('exact match (priority 30) beats everything', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'woodland-oak',
        'stone-top': 'calacatta-quartz',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(result.media.heroImage?.url).toBe('https://cdn.example.com/woodland-calacatta-hero.jpg');
      expect(result.media.appliedRules).toContain('mr_exact_woodland_calacatta');
    });
  });

  describe('Summary generation', () => {
    it('generates human-readable summary', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'woodland-oak',
        'stone-top': 'calacatta-quartz',
        'basin-type': 'above-counter-oval',
        'tap-holes': '1-hole',
        'handle-colour': 'matte-black',
        'plug-waste': 'matte-black-popup',
      }));

      expect(result.summary.humanReadable).toContain('900mm');
      expect(result.summary.humanReadable).toContain('Woodland Oak');
      expect(result.summary.humanReadable).toContain('Calacatta Quartz');
      expect(result.summary.humanReadable).toContain('+$269.00');
    });

    it('generates structured summary lines', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));

      expect(result.summary.structured.length).toBeGreaterThan(0);
      const sizeLine = result.summary.structured.find(l => l.label === 'Vanity Size');
      expect(sizeLine?.value).toBe('900mm');
      expect(sizeLine?.priceDelta).toBe('+$400.00');
    });
  });

  describe('Component mapping', () => {
    it('maps configuration to correct components', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'woodland-oak',
        'stone-top': 'calacatta-quartz',
        'basin-type': 'above-counter-oval',
        'tap-holes': '1-hole',
        'handle-colour': 'matte-black',
        'plug-waste': 'matte-black-popup',
      }));

      expect(result.components.mappings.length).toBeGreaterThan(0);

      const cabinet = result.components.mappings.find(m => m.sku === 'ZV-CAB-WO-900');
      expect(cabinet).toBeDefined();
      expect(cabinet?.type).toBe('CABINET');

      const top = result.components.mappings.find(m => m.sku === 'ZV-TOP-CAL-900');
      expect(top).toBeDefined();

      const basin = result.components.mappings.find(m => m.sku === 'ZV-BAS-ACO');
      expect(basin).toBeDefined();

      const handle = result.components.mappings.find(m => m.sku === 'ZV-HDL-MB');
      expect(handle).toBeDefined();
      expect(handle?.quantity).toBe(2);

      const waste = result.components.mappings.find(m => m.sku === 'ZV-PW-MB-POP');
      expect(waste).toBeDefined();
    });

    it('returns no components when conditions dont match', () => {
      const result = evaluateConfiguration(makeInput({
        'vanity-size': '600mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      // The test fixture only has component maps for specific combos
      // 600mm matte-white won't match the 900mm woodland-oak cabinet map
      const cabinet = result.components.mappings.find(m => m.type === 'CABINET');
      expect(cabinet).toBeUndefined();
    });
  });

  describe('Validation signature', () => {
    it('generates a signature', () => {
      const input = makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'woodland-oak',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      });
      const result = evaluateConfiguration(input);
      const signature = signConfiguration(input, result);

      expect(signature).toBeDefined();
      expect(signature.startsWith('v1:')).toBe(true);
    });
  });

  describe('Quick validation', () => {
    it('works for valid config', () => {
      const { isValid, errors } = validateConfigurationOnly(makeInput({
        'vanity-size': '900mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'stone-white',
        'tap-holes': '1-hole',
        'handle-colour': 'chrome',
      }));
      expect(isValid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('catches invalid config quickly', () => {
      const { isValid, errors } = validateConfigurationOnly(makeInput({
        'vanity-size': '600mm',
        'cabinet-finish': 'matte-white',
        'stone-top': 'no-top',
        'basin-type': 'undermount', // not allowed with no-top
        'tap-holes': '1-hole', // not allowed with no-top
        'handle-colour': 'chrome',
      }));
      expect(isValid).toBe(false);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
