import { describe, it, expect } from 'vitest';
import {
  getOptionalModulesForCategory,
  categoryDefaultsToInventory,
  getDefaultItemCategories,
  getPoFieldConfig,
  getBusinessTerminology,
} from './business-modules';

describe('getOptionalModulesForCategory', () => {
  it('returns the category defaults when nothing overrides them', () => {
    expect(getOptionalModulesForCategory('pharmacy')).toEqual(['inventory', 'salesman']);
    expect(getOptionalModulesForCategory('restaurant')).toEqual(['restaurant']);
  });

  it('falls back to the default "others" set for an unknown/null category', () => {
    expect(getOptionalModulesForCategory(null)).toEqual(['inventory']);
    expect(getOptionalModulesForCategory('made-up-category')).toEqual(['inventory']);
  });

  it('strips inventory when the business has explicitly disabled it', () => {
    expect(getOptionalModulesForCategory('pharmacy', false)).toEqual(['salesman']);
  });

  it('adds inventory when explicitly enabled for a category that would not normally include it', () => {
    expect(getOptionalModulesForCategory('restaurant', true)).toEqual(['restaurant', 'inventory']);
  });

  it('does not duplicate inventory when already present and explicitly enabled', () => {
    expect(getOptionalModulesForCategory('pharmacy', true)).toEqual(['inventory', 'salesman']);
  });

  it('prefers custom_settings.modules over category defaults entirely', () => {
    const result = getOptionalModulesForCategory('grocery', true, {
      modules: { inventory: false, restaurant: true, salesman: true, expenses: true, staff: true, loyalty: true },
    });

    expect(result).toEqual(['restaurant', 'salesman', 'expenses', 'staff', 'loyalty']);
  });

  it('keeps inventory active in custom_settings unless explicitly set to false', () => {
    const result = getOptionalModulesForCategory('grocery', false, { modules: {} });

    expect(result).toContain('inventory');
  });
});

describe('categoryDefaultsToInventory', () => {
  it('is true for categories that ship with inventory by default', () => {
    expect(categoryDefaultsToInventory('grocery')).toBe(true);
    expect(categoryDefaultsToInventory('wholesale')).toBe(true);
  });

  it('is false for a category with no inventory by default', () => {
    expect(categoryDefaultsToInventory('restaurant')).toBe(false);
    expect(categoryDefaultsToInventory('salesman')).toBe(false);
  });

  it('falls back to the "others" default for an unrecognized category', () => {
    expect(categoryDefaultsToInventory('made-up')).toBe(true);
  });
});

describe('getDefaultItemCategories', () => {
  it('returns the seeded categories for a known business category', () => {
    expect(getDefaultItemCategories('grocery')).toEqual(
      expect.arrayContaining(['Fruits & Vegetables', 'Dairy & Bakery']),
    );
  });

  it('returns an empty array for a null category', () => {
    expect(getDefaultItemCategories(null)).toEqual([]);
  });

  it('returns an empty array for a category with no preset list', () => {
    expect(getDefaultItemCategories('salesman')).toEqual([]);
  });

  it('prefers a non-empty custom_settings.categories override', () => {
    const result = getDefaultItemCategories('grocery', { categories: ['Custom A', 'Custom B'] });

    expect(result).toEqual(['Custom A', 'Custom B']);
  });

  it('falls back to the category preset when custom_settings.categories is empty', () => {
    const result = getDefaultItemCategories('grocery', { categories: [] });

    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getPoFieldConfig', () => {
  it('enables batch/expiry and scheme quantity by default for pharmacy', () => {
    expect(getPoFieldConfig('pharmacy')).toEqual({ batchExpiry: true, schemeQuantity: true });
  });

  it('disables batch/expiry by default for a non-pharmacy category', () => {
    expect(getPoFieldConfig('grocery')).toEqual({ batchExpiry: false, schemeQuantity: false });
  });

  it('respects an explicit custom_settings override for a non-pharmacy business', () => {
    const result = getPoFieldConfig('grocery', { moduleConfig: { inventorySettings: { enableBatchExpiry: true } } });

    expect(result).toEqual({ batchExpiry: true, schemeQuantity: true });
  });

  it('respects an explicit false override even for pharmacy', () => {
    const result = getPoFieldConfig('pharmacy', { moduleConfig: { inventorySettings: { enableBatchExpiry: false } } });

    expect(result).toEqual({ batchExpiry: false, schemeQuantity: false });
  });
});

describe('getBusinessTerminology', () => {
  it('returns sensible defaults when no custom terminology is set', () => {
    expect(getBusinessTerminology()).toEqual({
      productsLabel: 'Products',
      skuLabel: 'SKU / Code',
      priceLabel: 'Price',
      ordersLabel: 'Orders',
      customersLabel: 'Customers',
      staffLabel: 'Staff',
    });
  });

  it('uses a custom label when set and non-blank', () => {
    const result = getBusinessTerminology({ terminology: { productsLabel: 'Medicines' } });

    expect(result.productsLabel).toBe('Medicines');
    expect(result.ordersLabel).toBe('Orders');
  });

  it('falls back to the default when a custom label is blank/whitespace', () => {
    const result = getBusinessTerminology({ terminology: { productsLabel: '   ' } });

    expect(result.productsLabel).toBe('Products');
  });
});
