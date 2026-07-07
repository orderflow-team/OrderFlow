/**
 * Category Based Dynamic Modules (per PRD section 5): a grocery store
 * doesn't need the Restaurant tab, a restaurant doesn't need Salesman/visit
 * tracking, etc. Core modules (orders/customers/products/billing/reports)
 * are useful to every business type and always shown.
 */
export type OptionalModule = 'inventory' | 'restaurant' | 'salesman';

const CATEGORY_MODULES: Record<string, OptionalModule[]> = {
  grocery: ['inventory'],
  retail: ['inventory'],
  pharmacy: ['inventory', 'salesman'],
  wholesale: ['inventory', 'salesman'],
  salesman: ['salesman'],
  restaurant: ['restaurant'],
};

const ALL_OPTIONAL_MODULES: OptionalModule[] = ['inventory', 'restaurant', 'salesman'];

/**
 * Unknown/missing category (e.g. "others") falls back to showing everything.
 * `inventoryEnabled` is a separate, explicit owner choice made at
 * signup/onboarding that overrides the category default for that one module —
 * `undefined` means "not known yet" and defers to the category default;
 * `false` always hides it regardless of category.
 */
export function getOptionalModulesForCategory(
  category: string | null | undefined,
  inventoryEnabled?: boolean,
): OptionalModule[] {
  const modules = !category ? ALL_OPTIONAL_MODULES : (CATEGORY_MODULES[category] ?? ALL_OPTIONAL_MODULES);
  if (inventoryEnabled === false) {
    return modules.filter((m) => m !== 'inventory');
  }
  if (inventoryEnabled === true && !modules.includes('inventory')) {
    return [...modules, 'inventory'];
  }
  return modules;
}

/** Smart default for the onboarding checkbox: pre-checked only for categories that normally ship with inventory. */
export function categoryDefaultsToInventory(category: string): boolean {
  return (CATEGORY_MODULES[category] ?? ALL_OPTIONAL_MODULES).includes('inventory');
}

/** Default item categories seeded the first time a business opens Products, per business type. */
const DEFAULT_ITEM_CATEGORIES: Record<string, string[]> = {
  grocery: ['Fruits & Vegetables', 'Dairy & Bakery', 'Snacks & Beverages', 'Personal Care', 'Household'],
  retail: ['Clothing', 'Footwear', 'Accessories', 'Electronics', 'Home & Living'],
  pharmacy: [
    'Prescription Medicines',
    'OTC Medicines',
    'Ayurvedic & Herbal',
    'Vitamins & Supplements',
    'Diabetic Care',
    'Baby & Mother Care',
    'Skin & Personal Care',
    'Surgical & First Aid',
    'Health Devices & Equipment',
    'Elderly & Senior Care',
  ],
  wholesale: ['Bulk Grains', 'Packaged Goods', 'Beverages', 'Household Supplies'],
  restaurant: ['Starters', 'Main Course', 'Breads & Rice', 'Tandoori Specials', 'Desserts', 'Beverages'],
};

/** Unknown/missing category (e.g. "others", "salesman") gets no default categories — user adds their own. */
export function getDefaultItemCategories(category: string | null | undefined): string[] {
  if (!category) return [];
  return DEFAULT_ITEM_CATEGORIES[category] ?? [];
}
