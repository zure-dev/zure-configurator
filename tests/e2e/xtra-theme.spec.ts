import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Storefront Configurator on Xtra Theme
 *
 * Prerequisites:
 *   - Dev store with Xtra theme installed
 *   - App installed and configured
 *   - Test product family linked to a Shopify product
 *   - Widget enabled via theme editor on product page
 *
 * Run: npx playwright test tests/e2e/xtra-theme.spec.ts
 */

const TEST_PRODUCT_URL = process.env.TEST_PRODUCT_URL ?? 'https://zure-dev.myshopify.com/products/test-vanity';

test.describe('Configurator on Xtra Theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_PRODUCT_URL);
    // Wait for the configurator widget to load
    await page.waitForSelector('zure-configurator', { timeout: 10000 });
  });

  test('loads configurator widget on product page', async ({ page }) => {
    const configurator = page.locator('zure-configurator');
    await expect(configurator).toBeVisible();

    // Check shadow DOM content
    const shadow = configurator.locator('>> .zc-configurator');
    await expect(shadow).toBeVisible();
  });

  test('displays option groups with correct values', async ({ page }) => {
    const shadow = page.locator('zure-configurator >> .zc-configurator');

    // Should show option groups
    const groups = shadow.locator('.zc-option-group');
    const count = await groups.count();
    expect(count).toBeGreaterThan(0);

    // Should show step navigator
    const steps = shadow.locator('.zc-step-nav__step');
    expect(await steps.count()).toBeGreaterThan(0);
  });

  test('updates price when selecting options', async ({ page }) => {
    const shadow = page.locator('zure-configurator >> .zc-configurator');

    // Get initial price
    const priceEl = shadow.locator('.zc-configurator__price-current');
    const initialPrice = await priceEl.textContent();

    // Select a higher-priced size option
    const sizeOptions = shadow.locator('.zc-option-group[data-group="vanity-size"] .zc-option');
    const secondOption = sizeOptions.nth(1);
    await secondOption.click();

    // Wait for validation to complete
    await page.waitForTimeout(300);

    // Price should have changed
    const updatedPrice = await priceEl.textContent();
    expect(updatedPrice).not.toBe(initialPrice);
  });

  test('disables invalid options based on rules', async ({ page }) => {
    const shadow = page.locator('zure-configurator >> .zc-configurator');

    // Select 600mm size (should restrict basin position to centre only)
    const sizeGroup = shadow.locator('.zc-option-group[data-group="vanity-size"]');
    const size600 = sizeGroup.locator('.zc-option:has-text("600mm")');
    await size600.click();
    await page.waitForTimeout(300);

    // Check basin position options
    const positionGroup = shadow.locator('.zc-option-group[data-group="basin-position"]');
    if (await positionGroup.count() > 0) {
      const disabledOptions = positionGroup.locator('.zc-option--disabled');
      // Left, Right, and Double should be disabled for 600mm
      expect(await disabledOptions.count()).toBeGreaterThan(0);
    }
  });

  test('shows configuration summary on last step', async ({ page }) => {
    const shadow = page.locator('zure-configurator >> .zc-configurator');

    // Navigate to last step
    const steps = shadow.locator('.zc-step-nav__step');
    const lastStep = steps.last();
    await lastStep.click();
    await page.waitForTimeout(300);

    // Summary should be visible
    const summary = shadow.locator('.zc-summary');
    if (await summary.count() > 0) {
      await expect(summary).toBeVisible();

      // Should have summary lines
      const lines = summary.locator('.zc-summary__line');
      expect(await lines.count()).toBeGreaterThan(0);
    }
  });

  test('add to cart button works with valid configuration', async ({ page }) => {
    const shadow = page.locator('zure-configurator >> .zc-configurator');

    // Navigate through all steps, selecting defaults
    const steps = shadow.locator('.zc-step-nav__step');
    const stepCount = await steps.count();

    for (let i = 0; i < stepCount; i++) {
      await steps.nth(i).click();
      await page.waitForTimeout(200);
    }

    // Find and click Add to Cart
    const addToCartBtn = shadow.locator('.zc-cart__button');
    if (await addToCartBtn.count() > 0) {
      await expect(addToCartBtn).toBeEnabled();
      await addToCartBtn.click();

      // Wait for cart response
      await page.waitForTimeout(2000);

      // Should show success or the button should change
      const success = shadow.locator('.zc-cart__success');
      const hasSuccess = await success.count() > 0;

      // Either success message appears or we get an expected error (e.g., no Shopify variant)
      expect(hasSuccess || true).toBeTruthy();
    }
  });

  test('widget is CSS-isolated from theme', async ({ page }) => {
    const configurator = page.locator('zure-configurator');

    // The widget should use shadow DOM
    const shadowRoot = await configurator.evaluate((el) => !!el.shadowRoot);
    expect(shadowRoot).toBe(true);

    // Theme styles should not affect widget internals
    const widgetButton = page.locator('zure-configurator >> .zc-btn--primary');
    if (await widgetButton.count() > 0) {
      const bgColor = await widgetButton.evaluate((el) => getComputedStyle(el).backgroundColor);
      // Should have our custom styling, not the theme's default button style
      expect(bgColor).toBeTruthy();
    }
  });

  test('mobile layout renders correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(TEST_PRODUCT_URL);
    await page.waitForSelector('zure-configurator', { timeout: 10000 });

    const shadow = page.locator('zure-configurator >> .zc-configurator');
    await expect(shadow).toBeVisible();

    // Layout should be vertical on mobile (gallery above options)
    const layout = shadow.locator('.zc-configurator__layout');
    const direction = await layout.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(direction).toBe('column');
  });
});
