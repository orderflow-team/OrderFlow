import type { CustomBusinessSettings } from './business-modules';

/**
 * Ready-made setups for the "Others" business category. Picking one fills in
 * everything the app actually uses for a custom business — what things are
 * called, which tabs are on, starter item categories and suggested extra
 * fields — so most owners can finish setup in a couple of taps.
 */

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'options' | 'file';
export type CustomField = { name: string; type: FieldType; options?: string[] };

export type ModuleKey = 'inventory' | 'staff' | 'expenses' | 'restaurant' | 'salesman' | 'ai_assistant';

export type BusinessPreset = {
  id: string;
  label: string;
  emoji: string;
  terminology: Required<Omit<NonNullable<CustomBusinessSettings['terminology']>, 'preset'>>;
  modules: Record<ModuleKey, boolean>;
  batchExpiry?: boolean;
  categories: string[];
  productFields: CustomField[];
  customerFields: CustomField[];
};

const M = (on: ModuleKey[]): Record<ModuleKey, boolean> => ({
  inventory: on.includes('inventory'),
  staff: on.includes('staff'),
  expenses: on.includes('expenses'),
  restaurant: on.includes('restaurant'),
  salesman: on.includes('salesman'),
  ai_assistant: true,
});

export const BUSINESS_PRESETS: BusinessPreset[] = [
  {
    id: 'retail', label: 'Shop / Store', emoji: '🛍️',
    terminology: { productsLabel: 'Products', skuLabel: 'SKU / Barcode', priceLabel: 'Price', ordersLabel: 'Orders', customersLabel: 'Customers', staffLabel: 'Staff' },
    modules: M(['inventory', 'expenses']),
    categories: ['General', 'Popular Items', 'New Arrivals'],
    productFields: [{ name: 'Brand', type: 'text' }],
    customerFields: [{ name: 'Birthday', type: 'date' }],
  },
  {
    id: 'salon', label: 'Salon & Spa', emoji: '✂️',
    terminology: { productsLabel: 'Services', skuLabel: 'Service Code', priceLabel: 'Charge', ordersLabel: 'Bookings', customersLabel: 'Clients', staffLabel: 'Stylists' },
    modules: M(['staff']),
    categories: ['Hair', 'Skin', 'Nails', 'Spa & Massage', 'Packages'],
    productFields: [{ name: 'Duration (mins)', type: 'number' }],
    customerFields: [{ name: 'Birthday', type: 'date' }, { name: 'Preferences', type: 'text' }],
  },
  {
    id: 'clinic', label: 'Clinic', emoji: '🏥',
    terminology: { productsLabel: 'Services', skuLabel: 'Code', priceLabel: 'Fee', ordersLabel: 'Appointments', customersLabel: 'Patients', staffLabel: 'Doctors' },
    modules: M(['staff', 'inventory']), batchExpiry: true,
    categories: ['Consultation', 'Tests', 'Procedures', 'Medicines'],
    productFields: [],
    customerFields: [{ name: 'Age', type: 'number' }, { name: 'Blood Group', type: 'options', options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] }],
  },
  {
    id: 'fitness', label: 'Gym & Fitness', emoji: '🏋️',
    terminology: { productsLabel: 'Plans', skuLabel: 'Plan Code', priceLabel: 'Fee', ordersLabel: 'Memberships', customersLabel: 'Members', staffLabel: 'Trainers' },
    modules: M(['staff']),
    categories: ['Monthly', 'Quarterly', 'Yearly', 'Personal Training'],
    productFields: [{ name: 'Duration (days)', type: 'number' }],
    customerFields: [{ name: 'Membership Expiry', type: 'date' }],
  },
  {
    id: 'education', label: 'Coaching / School', emoji: '🏫',
    terminology: { productsLabel: 'Courses', skuLabel: 'Course Code', priceLabel: 'Fee', ordersLabel: 'Admissions', customersLabel: 'Students', staffLabel: 'Teachers' },
    modules: M(['staff']),
    categories: ['Classes', 'Batches', 'Books & Material'],
    productFields: [{ name: 'Batch Timing', type: 'text' }],
    customerFields: [{ name: 'Parent Phone', type: 'text' }, { name: 'Class', type: 'text' }],
  },
  {
    id: 'services', label: 'Services / Agency', emoji: '💼',
    terminology: { productsLabel: 'Services', skuLabel: 'Code', priceLabel: 'Rate', ordersLabel: 'Jobs', customersLabel: 'Clients', staffLabel: 'Team' },
    modules: M(['staff', 'expenses']),
    categories: ['Consulting', 'Projects', 'Retainers'],
    productFields: [],
    customerFields: [{ name: 'Company', type: 'text' }],
  },
  {
    id: 'auto', label: 'Garage / Auto', emoji: '🚗',
    terminology: { productsLabel: 'Parts & Services', skuLabel: 'Part #', priceLabel: 'Price', ordersLabel: 'Job Cards', customersLabel: 'Customers', staffLabel: 'Mechanics' },
    modules: M(['inventory', 'staff']),
    categories: ['Spare Parts', 'Servicing', 'Repairs', 'Accessories'],
    productFields: [{ name: 'Vehicle Model', type: 'text' }],
    customerFields: [{ name: 'Vehicle Number', type: 'text' }],
  },
  {
    id: 'bakery', label: 'Bakery & Sweets', emoji: '🍰',
    terminology: { productsLabel: 'Items', skuLabel: 'Item Code', priceLabel: 'Price', ordersLabel: 'Orders', customersLabel: 'Customers', staffLabel: 'Staff' },
    modules: M(['inventory']), batchExpiry: true,
    categories: ['Cakes', 'Pastries', 'Breads', 'Sweets', 'Snacks'],
    productFields: [{ name: 'Weight', type: 'text' }],
    customerFields: [],
  },
  {
    id: 'jewelry', label: 'Jewellery', emoji: '💎',
    terminology: { productsLabel: 'Ornaments', skuLabel: 'Hallmark / Tag', priceLabel: 'Price', ordersLabel: 'Sales', customersLabel: 'Customers', staffLabel: 'Staff' },
    modules: M(['inventory']),
    categories: ['Gold', 'Silver', 'Diamond', 'Gemstones'],
    productFields: [{ name: 'Weight (g)', type: 'number' }, { name: 'Purity', type: 'options', options: ['24K', '22K', '18K', '14K', '925 Silver'] }],
    customerFields: [],
  },
  {
    id: 'laundry', label: 'Laundry', emoji: '🧺',
    terminology: { productsLabel: 'Services', skuLabel: 'Tag #', priceLabel: 'Charge', ordersLabel: 'Pickups', customersLabel: 'Customers', staffLabel: 'Staff' },
    modules: M(['staff']),
    categories: ['Wash & Fold', 'Dry Clean', 'Ironing', 'Shoes'],
    productFields: [],
    customerFields: [{ name: 'Pickup Address', type: 'text' }],
  },
  {
    id: 'hotel', label: 'Hotel / Stay', emoji: '🏨',
    terminology: { productsLabel: 'Rooms', skuLabel: 'Room #', priceLabel: 'Tariff', ordersLabel: 'Bookings', customersLabel: 'Guests', staffLabel: 'Staff' },
    modules: M(['staff', 'expenses']),
    categories: ['Standard', 'Deluxe', 'Suite', 'Add-ons'],
    productFields: [],
    customerFields: [{ name: 'ID Proof', type: 'text' }],
  },
  {
    id: 'catering', label: 'Events & Catering', emoji: '🎉',
    terminology: { productsLabel: 'Packages', skuLabel: 'Code', priceLabel: 'Rate', ordersLabel: 'Events', customersLabel: 'Clients', staffLabel: 'Team' },
    modules: M(['staff', 'expenses']),
    categories: ['Catering', 'Decoration', 'Venue', 'Add-ons'],
    productFields: [],
    customerFields: [{ name: 'Event Date', type: 'date' }],
  },
  {
    id: 'hardware', label: 'Hardware & Building', emoji: '🏗️',
    terminology: { productsLabel: 'Materials', skuLabel: 'Item Code', priceLabel: 'Rate', ordersLabel: 'Orders', customersLabel: 'Customers', staffLabel: 'Staff' },
    modules: M(['inventory', 'expenses']),
    categories: ['Cement', 'Steel', 'Paint', 'Plumbing', 'Electrical'],
    productFields: [{ name: 'Unit Size', type: 'text' }],
    customerFields: [],
  },
  {
    id: 'electronics', label: 'Mobile & Electronics', emoji: '📱',
    terminology: { productsLabel: 'Products', skuLabel: 'IMEI / Serial', priceLabel: 'Price', ordersLabel: 'Orders', customersLabel: 'Customers', staffLabel: 'Staff' },
    modules: M(['inventory']),
    categories: ['Phones', 'Accessories', 'Repairs', 'Recharge'],
    productFields: [{ name: 'Warranty (months)', type: 'number' }],
    customerFields: [],
  },
  {
    id: 'rental', label: 'Rentals', emoji: '🔑',
    terminology: { productsLabel: 'Rental Items', skuLabel: 'Serial #', priceLabel: 'Rent', ordersLabel: 'Rentals', customersLabel: 'Customers', staffLabel: 'Staff' },
    modules: M(['inventory']),
    categories: ['Daily', 'Weekly', 'Monthly'],
    productFields: [{ name: 'Deposit', type: 'number' }],
    customerFields: [{ name: 'ID Proof', type: 'text' }],
  },
  {
    id: 'vet', label: 'Pet Care', emoji: '🐾',
    terminology: { productsLabel: 'Services & Products', skuLabel: 'Code', priceLabel: 'Price', ordersLabel: 'Visits', customersLabel: 'Pet Parents', staffLabel: 'Staff' },
    modules: M(['inventory', 'staff']), batchExpiry: true,
    categories: ['Consultation', 'Grooming', 'Food', 'Medicines'],
    productFields: [],
    customerFields: [{ name: 'Pet Name', type: 'text' }],
  },
  {
    id: 'travel', label: 'Travel Agency', emoji: '✈️',
    terminology: { productsLabel: 'Packages', skuLabel: 'Code', priceLabel: 'Price', ordersLabel: 'Bookings', customersLabel: 'Travellers', staffLabel: 'Agents' },
    modules: M(['staff', 'expenses']),
    categories: ['Tours', 'Flights', 'Hotels', 'Visa'],
    productFields: [],
    customerFields: [{ name: 'Passport No.', type: 'text' }],
  },
  {
    id: 'photography', label: 'Photo Studio', emoji: '📸',
    terminology: { productsLabel: 'Packages', skuLabel: 'Code', priceLabel: 'Price', ordersLabel: 'Shoots', customersLabel: 'Clients', staffLabel: 'Team' },
    modules: M(['staff']),
    categories: ['Wedding', 'Portraits', 'Events', 'Prints'],
    productFields: [],
    customerFields: [{ name: 'Event Date', type: 'date' }],
  },
  {
    id: 'logistics', label: 'Courier & Transport', emoji: '🚚',
    terminology: { productsLabel: 'Services', skuLabel: 'Tracking #', priceLabel: 'Charge', ordersLabel: 'Shipments', customersLabel: 'Customers', staffLabel: 'Drivers' },
    modules: M(['staff', 'expenses', 'salesman']),
    categories: ['Local', 'Outstation', 'Express'],
    productFields: [],
    customerFields: [],
  },
  {
    id: 'general', label: 'Something else', emoji: '✨',
    terminology: { productsLabel: 'Products', skuLabel: 'SKU / Code', priceLabel: 'Price', ordersLabel: 'Orders', customersLabel: 'Customers', staffLabel: 'Staff' },
    modules: M(['inventory']),
    categories: ['General'],
    productFields: [],
    customerFields: [],
  },
];

/** Preset ids used by the previous 6-step wizard that were renamed. */
const LEGACY_PRESET_IDS: Record<string, string> = { construction: 'hardware', hardware_rental: 'rental' };

export const presetById = (id?: string | null) => {
  const key = id ? LEGACY_PRESET_IDS[id] ?? id : id;
  return BUSINESS_PRESETS.find((p) => p.id === key);
};

/** Plain-language descriptions of the optional features shown in the wizard. */
export const MODULE_INFO: Record<ModuleKey, { title: string; desc: string }> = {
  inventory: { title: 'Inventory', desc: 'Track quantities, low-inventory alerts and purchase orders' },
  staff: { title: 'Staff', desc: 'Team logins, attendance and commissions' },
  expenses: { title: 'Purchases & expenses', desc: 'Record what you buy and spend' },
  restaurant: { title: 'Tables & kitchen', desc: 'Dine-in tables and kitchen tickets' },
  salesman: { title: 'Field sales', desc: 'Salesmen taking orders on the go' },
  ai_assistant: { title: 'AI assistant', desc: 'Ask for reports or create orders by chat' },
};
