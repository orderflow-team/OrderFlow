/**
 * Category Based Dynamic Modules (per PRD section 5): a grocery store
 * doesn't need the Restaurant tab, a restaurant doesn't need Salesman/visit
 * tracking, etc. Core modules (orders/customers/products/billing/reports)
 * are useful to every business type and always shown.
 */
export type OptionalModule = 'inventory' | 'restaurant' | 'salesman' | 'expenses' | 'staff' | 'loyalty' | 'attendance' | 'commissions';

export interface CustomBusinessSettings {
  branding?: {
    themeColor?: 'emerald' | 'sky' | 'violet' | 'amber' | 'rose' | 'slate';
    tagline?: string;
    logoUrl?: string;
    bannerUrl?: string;
    websiteUrl?: string;
    registrationNumber?: string;
    stateCountry?: string;
    zipCode?: string;
    email?: string;
  };
  modules?: {
    products?: boolean;
    orders?: boolean;
    inventory?: boolean;
    billing?: boolean;
    customers?: boolean;
    reports?: boolean;
    restaurant?: boolean;
    salesman?: boolean;
    ai_assistant?: boolean;
    expenses?: boolean;
    staff?: boolean;
    loyalty?: boolean;
    attendance?: boolean;
    commissions?: boolean;
  };
  moduleConfig?: {
    inventorySettings?: {
      lowStockAlertThreshold?: number;
      enableBatchExpiry?: boolean;
      enablePurchaseOrders?: boolean;
    };
    restaurantSettings?: {
      diningMode?: 'dine_in' | 'takeaway' | 'delivery' | 'all';
      enableKDS?: boolean;
      serviceChargePercent?: number;
      enableTableReservation?: boolean;
    };
    crmSettings?: {
      enableCreditLimit?: boolean;
      defaultCreditLimit?: number;
      enablePaymentReminders?: boolean;
      customerTiers?: boolean;
    };
    salesmanSettings?: {
      enableGpsTracking?: boolean;
      commissionRatePercent?: number;
    };
  };
  features?: {
    autoPdfInvoice?: boolean;
    splitPayment?: boolean;
    lowStockAlerts?: boolean;
    customerCreditLimit?: boolean;
    itemDiscounts?: boolean;
    orderDiscounts?: boolean;
    cashierPriceOverride?: boolean;
    loyaltyProgram?: boolean;
    whatsappSharing?: boolean;
  };
  permissions?: {
    cashierCanDiscount?: boolean;
    cashierCanDeleteOrder?: boolean;
    cashierCanOverridePrice?: boolean;
    cashierCanRefund?: boolean;
    staffViewCostPrice?: boolean;
    staffViewProfitMargins?: boolean;
    staffEditStock?: boolean;
    staffExportReports?: boolean;
    staffManageCreditLimit?: boolean;
    waiterCanDiscountTable?: boolean;
    managerClearData?: boolean;
    requireAdminApprovalHighValue?: boolean;
  };
  localization?: {
    dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    numberFormat?: 'lakhs' | 'international';
  };
  automation?: {
    autoSendWhatsappOnDelivery?: boolean;
    autoDraftPOOnLowStock?: boolean;
  };
  payments?: {
    methods?: string[];
  };
  notifications?: {
    sendCustomerSms?: boolean;
    sendCustomerWhatsapp?: boolean;
    lowStockEmail?: boolean;
  };
  aiConfig?: {
    personality?: 'concise' | 'consultative' | 'friendly';
    language?: 'en' | 'hi' | 'hinglish' | 'es' | 'ar';
  };
  receipt?: {
    template?: 'standard' | 'minimal' | 'formal';
    paperSize?: '2inch' | '3inch' | 'a4';
    footerMessage?: string;
    invoicePrefix?: string;
    showLogoOnReceipt?: boolean;
    showUpiQrCode?: boolean;
    showTermsAndConditions?: boolean;
    termsAndConditions?: string;
    receiptCopyCount?: number;
    autoCutPaper?: boolean;
    autoKickCashDrawer?: boolean;
  };
  taxes?: {
    taxEnabled?: boolean;
    taxName?: string;
    defaultTaxRate?: number;
    pricesIncludeTax?: boolean;
  };
  formatting?: {
    currencySymbolPosition?: 'prefix' | 'suffix';
    decimalPrecision?: number;
  };
  terminology?: {
    preset?: string;
    productsLabel?: string;
    skuLabel?: string;
    priceLabel?: string;
    ordersLabel?: string;
    customersLabel?: string;
    staffLabel?: string;
  };
  workflow?: {
    posMode?: 'counter' | 'detailed' | 'table' | 'field';
    landingPage?: string;
    enableBarcode?: boolean;
    enableBatchExpiry?: boolean;
    enableThermalPrint?: boolean;
    enableKhataCredit?: boolean;
    operatingHours?: string;
  };
  customFields?: { name: string; type: 'text' | 'number' | 'date' | 'boolean' | 'options' | 'file'; options?: string[] }[];
  productCustomFields?: { name: string; type: 'text' | 'number' | 'date' | 'boolean' | 'options' | 'file'; options?: string[] }[];
  customerCustomFields?: { name: string; type: 'text' | 'number' | 'date' | 'boolean' | 'options' | 'file'; options?: string[] }[];
  categories?: string[];
}

const CATEGORY_MODULES: Record<string, OptionalModule[]> = {
  grocery: ['inventory'],
  retail: ['inventory'],
  pharmacy: ['inventory', 'salesman'],
  wholesale: ['inventory', 'salesman'],
  salesman: ['salesman'],
  restaurant: ['restaurant'],
  others: ['inventory'],
};

const DEFAULT_OTHERS_MODULES: OptionalModule[] = ['inventory'];

/**
 * Resolves active optional modules for a business.
 * Supports category defaults, inventoryEnabled flag, and deep custom_settings overrides.
 */
export function getOptionalModulesForCategory(
  category: string | null | undefined,
  inventoryEnabled?: boolean,
  customSettings?: CustomBusinessSettings | null,
): OptionalModule[] {
  if (customSettings?.modules) {
    const active: OptionalModule[] = [];
    if (customSettings.modules.inventory !== false) active.push('inventory');
    if (customSettings.modules.restaurant === true) active.push('restaurant');
    if (customSettings.modules.salesman === true) active.push('salesman');
    if (customSettings.modules.expenses === true) active.push('expenses');
    if (customSettings.modules.staff === true) active.push('staff');
    if (customSettings.modules.loyalty === true) active.push('loyalty');
    return active;
  }

  const modules = !category ? DEFAULT_OTHERS_MODULES : (CATEGORY_MODULES[category] ?? DEFAULT_OTHERS_MODULES);
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
  return (CATEGORY_MODULES[category] ?? DEFAULT_OTHERS_MODULES).includes('inventory');
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

/** Resolves default or user-customized item categories. */
export function getDefaultItemCategories(
  category: string | null | undefined,
  customSettings?: CustomBusinessSettings | null,
): string[] {
  if (customSettings?.categories && customSettings.categories.length > 0) {
    return customSettings.categories;
  }
  if (!category) return [];
  return DEFAULT_ITEM_CATEGORIES[category] ?? [];
}

export interface PoFieldConfig {
  batchExpiry: boolean;
  schemeQuantity: boolean;
}

/**
 * Which extra Purchase Order line-item fields to show, per business. Reads
 * the business's own enableBatchExpiry toggle (set at onboarding) when
 * present, falling back to "pharmacy only" — the same category check the PO
 * form used to hardcode inline. Scheme quantity rides along with batch/expiry
 * since both are the same "perishable/dated stock" concern. tax_percentage is
 * intentionally NOT gated here — GST applies to every category.
 */
export function getPoFieldConfig(
  category: string | null | undefined,
  customSettings?: CustomBusinessSettings | null,
): PoFieldConfig {
  const explicit = customSettings?.moduleConfig?.inventorySettings?.enableBatchExpiry;
  const batchExpiry = explicit !== undefined ? explicit : category === 'pharmacy';
  return { batchExpiry, schemeQuantity: batchExpiry };
}

/** Dynamic terminology helper for UI custom labels. */
export function getBusinessTerminology(customSettings?: CustomBusinessSettings | null) {
  return {
    productsLabel: customSettings?.terminology?.productsLabel?.trim() || 'Products',
    skuLabel: customSettings?.terminology?.skuLabel?.trim() || 'SKU / Code',
    priceLabel: customSettings?.terminology?.priceLabel?.trim() || 'Price',
    ordersLabel: customSettings?.terminology?.ordersLabel?.trim() || 'Orders',
    customersLabel: customSettings?.terminology?.customersLabel?.trim() || 'Customers',
    staffLabel: customSettings?.terminology?.staffLabel?.trim() || 'Staff',
  };
}
