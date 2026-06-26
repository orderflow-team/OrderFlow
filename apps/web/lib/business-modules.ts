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
  pharmacy: ['inventory'],
  wholesale: ['inventory', 'salesman'],
  salesman: ['salesman'],
  restaurant: ['restaurant'],
};

const ALL_OPTIONAL_MODULES: OptionalModule[] = ['inventory', 'restaurant', 'salesman'];

/** Unknown/missing category (e.g. "others") falls back to showing everything. */
export function getOptionalModulesForCategory(category: string | null | undefined): OptionalModule[] {
  if (!category) return ALL_OPTIONAL_MODULES;
  return CATEGORY_MODULES[category] ?? ALL_OPTIONAL_MODULES;
}
