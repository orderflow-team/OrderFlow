'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Store,
  Package,
  Utensils,
  UserCheck,
  Receipt,
  Users,
  Bot,
  QrCode,
  Printer,
  Sliders,
  Sparkles,
  Layers,
  Palette,
  Plus,
  Trash2,
  Settings2,
  CheckCircle2,
  FileSpreadsheet,
  Percent,
  CreditCard,
  Globe,
  Clock,
  ShieldCheck,
  Zap,
  Image as ImageIcon,
  Upload,
  X,
  ShoppingCart,
  BarChart3,
  Boxes,
  Wallet,
  BadgePercent,
  UserPlus,
  SlidersHorizontal,
  Lock,
  Scissors,
  FileText,
  Bookmark,
} from 'lucide-react';
import { CustomBusinessSettings } from '@/lib/business-modules';

interface CustomBusinessWizardProps {
  initialName?: string;
  onComplete: (data: {
    name: string;
    category: string;
    inventoryEnabled: boolean;
    currency: string;
    timezone: string;
    address: string;
    phone: string;
    gstNumber: string;
    customSettings: CustomBusinessSettings;
  }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export function CustomBusinessWizard({
  initialName = '',
  onComplete,
  onCancel,
  loading,
}: CustomBusinessWizardProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Step 1: Identity & Branding (All Optional!)
  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [themeColor, setThemeColor] = useState<'emerald' | 'sky' | 'violet' | 'amber' | 'rose' | 'slate'>('emerald');

  // Step 2: Modules & Deep Module Sub-Rules
  const [modules, setModules] = useState({
    products: true,
    orders: true,
    inventory: true,
    billing: true,
    customers: true,
    reports: true,
    restaurant: false,
    salesman: false,
    ai_assistant: true,
    expenses: true,
    staff: false,
    loyalty: true,
  });

  const [lowStockAlertThreshold, setLowStockAlertThreshold] = useState('10');
  const [enableBatchExpiry, setEnableBatchExpiry] = useState(false);
  const [diningMode, setDiningMode] = useState<'dine_in' | 'takeaway' | 'delivery' | 'all'>('all');
  const [enableKDS, setEnableKDS] = useState(true);
  const [defaultCreditLimit, setDefaultCreditLimit] = useState('10000');
  const [enablePaymentReminders, setEnablePaymentReminders] = useState(true);

  // Step 3: Expanded Staff Role Permissions & Security Rules
  const [cashierCanDiscount, setCashierCanDiscount] = useState(true);
  const [cashierCanDeleteOrder, setCashierCanDeleteOrder] = useState(false);
  const [cashierCanOverridePrice, setCashierCanOverridePrice] = useState(false);
  const [cashierCanRefund, setCashierCanRefund] = useState(true);

  const [staffViewCostPrice, setStaffViewCostPrice] = useState(false);
  const [staffViewProfitMargins, setStaffViewProfitMargins] = useState(false);
  const [staffEditStock, setStaffEditStock] = useState(false);
  const [staffExportReports, setStaffExportReports] = useState(false);
  const [staffManageCreditLimit, setStaffManageCreditLimit] = useState(false);

  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'>('DD/MM/YYYY');
  const [numberFormat, setNumberFormat] = useState<'lakhs' | 'international'>('lakhs');
  const [autoSendWhatsappOnDelivery, setAutoSendWhatsappOnDelivery] = useState(true);
  const [autoDraftPOOnLowStock, setAutoDraftPOOnLowStock] = useState(true);

  // Step 4: Expanded Receipt, Tax, Payment Methods & Hardware
  const [receiptTemplate, setReceiptTemplate] = useState<'standard' | 'minimal' | 'formal'>('standard');
  const [paperSize, setPaperSize] = useState<'2inch' | '3inch' | 'a4'>('3inch');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [footerMessage, setFooterMessage] = useState('Thank you for your business! Please visit again.');

  const [showLogoOnReceipt, setShowLogoOnReceipt] = useState(true);
  const [showUpiQrCode, setShowUpiQrCode] = useState(true);
  const [showTermsAndConditions, setShowTermsAndConditions] = useState(true);
  const [receiptCopyCount, setReceiptCopyCount] = useState('1');
  const [autoCutPaper, setAutoCutPaper] = useState(true);

  const [taxName, setTaxName] = useState('GST');
  const [defaultTaxRate, setDefaultTaxRate] = useState('18');
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Cash', 'UPI / QR Code', 'Card', 'Credit / Khata']);

  // Step 5: 20 Industry Presets, Selection Dropdowns & Rich Custom Fields
  const [terminologyPreset, setTerminologyPreset] = useState('retail');
  const [productsLabel, setProductsLabel] = useState('Products');
  const [skuLabel, setSkuLabel] = useState('SKU / Code');
  const [priceLabel, setPriceLabel] = useState('Price');
  const [ordersLabel, setOrdersLabel] = useState('Orders');
  const [customersLabel, setCustomersLabel] = useState('Customers');
  const [staffLabel, setStaffLabel] = useState('Staff');
  const [categoriesText, setCategoriesText] = useState('General Services, Standard Items');

  const [customFields, setCustomFields] = useState<{ name: string; type: 'text' | 'number' | 'date' | 'boolean' | 'options' | 'file'; options?: string[] }[]>([
    { name: 'Warranty Period', type: 'text' },
    { name: 'Batch / Lot #', type: 'text' },
  ]);

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date' | 'boolean' | 'options' | 'file'>('text');

  const [error, setError] = useState('');

  const applyTerminologyPreset = (preset: string) => {
    setTerminologyPreset(preset);
    if (preset === 'retail') {
      setProductsLabel('Products');
      setSkuLabel('SKU / Barcode');
      setPriceLabel('Price');
      setOrdersLabel('Orders');
      setCustomersLabel('Customers');
      setStaffLabel('Staff');
    } else if (preset === 'restaurant') {
      setProductsLabel('Dishes / Menu');
      setSkuLabel('Item Code');
      setPriceLabel('Rate');
      setOrdersLabel('KOT / Orders');
      setCustomersLabel('Guests');
      setStaffLabel('Waiters / Chefs');
    } else if (preset === 'clinic') {
      setProductsLabel('Medicines & Services');
      setSkuLabel('Rx Code');
      setPriceLabel('Consultation Fee');
      setOrdersLabel('Appointments');
      setCustomersLabel('Patients');
      setStaffLabel('Doctors / Nurses');
    } else if (preset === 'salon') {
      setProductsLabel('Services & Packages');
      setSkuLabel('Service Code');
      setPriceLabel('Charge');
      setOrdersLabel('Bookings');
      setCustomersLabel('Clients');
      setStaffLabel('Stylists / Therapists');
    } else if (preset === 'wholesale') {
      setProductsLabel('Bulk Goods');
      setSkuLabel('Batch Code');
      setPriceLabel('Wholesale Rate');
      setOrdersLabel('Sales Orders');
      setCustomersLabel('Dealers / Buyers');
      setStaffLabel('Sales Reps');
    } else if (preset === 'auto') {
      setProductsLabel('Spare Parts & Repairs');
      setSkuLabel('Part #');
      setPriceLabel('Unit Cost');
      setOrdersLabel('Job Cards');
      setCustomersLabel('Vehicle Owners');
      setStaffLabel('Mechanics / Techs');
    } else if (preset === 'fitness') {
      setProductsLabel('Memberships & Classes');
      setSkuLabel('Plan Code');
      setPriceLabel('Membership Fee');
      setOrdersLabel('Enrollments');
      setCustomersLabel('Members');
      setStaffLabel('Personal Trainers');
    } else if (preset === 'hotel') {
      setProductsLabel('Rooms & Amenities');
      setSkuLabel('Room #');
      setPriceLabel('Nightly Tariff');
      setOrdersLabel('Reservations');
      setCustomersLabel('Guests');
      setStaffLabel('Front Desk Staff');
    } else if (preset === 'education') {
      setProductsLabel('Courses & Batches');
      setSkuLabel('Course Code');
      setPriceLabel('Tuition Fee');
      setOrdersLabel('Enrollments');
      setCustomersLabel('Students');
      setStaffLabel('Teachers / Tutors');
    } else if (preset === 'services') {
      setProductsLabel('Services & Projects');
      setSkuLabel('Project ID');
      setPriceLabel('Hourly Rate');
      setOrdersLabel('Contracts');
      setCustomersLabel('Clients');
      setStaffLabel('Consultants');
    } else if (preset === 'jewelry') {
      setProductsLabel('Ornaments & Gems');
      setSkuLabel('Hallmark Code');
      setPriceLabel('Rate / Gram');
      setOrdersLabel('Sales Slips');
      setCustomersLabel('Buyers');
      setStaffLabel('Artisans / Jewelers');
    } else if (preset === 'laundry') {
      setProductsLabel('Garments & Dry Clean');
      setSkuLabel('Tag Code');
      setPriceLabel('Washing Charge');
      setOrdersLabel('Pickup Orders');
      setCustomersLabel('Customers');
      setStaffLabel('Delivery Staff');
    } else if (preset === 'construction') {
      setProductsLabel('Materials & Supplies');
      setSkuLabel('Material ID');
      setPriceLabel('Unit Rate');
      setOrdersLabel('Purchase Slips');
      setCustomersLabel('Contractors');
      setStaffLabel('Site Supervisors');
    } else if (preset === 'hardware_rental') {
      setProductsLabel('Laptops & Gadgets');
      setSkuLabel('Serial #');
      setPriceLabel('Rental Rate');
      setOrdersLabel('Rental Agreements');
      setCustomersLabel('Enterprise Clients');
      setStaffLabel('Technicians');
    } else if (preset === 'vet') {
      setProductsLabel('Pet Care & Vaccines');
      setSkuLabel('Pet Code');
      setPriceLabel('Treatment Fee');
      setOrdersLabel('Consultations');
      setCustomersLabel('Pet Parents');
      setStaffLabel('Veterinarians');
    } else if (preset === 'catering') {
      setProductsLabel('Catering & Setup');
      setSkuLabel('Event ID');
      setPriceLabel('Package Rate');
      setOrdersLabel('Event Bookings');
      setCustomersLabel('Event Hosts');
      setStaffLabel('Coordinators');
    } else if (preset === 'travel') {
      setProductsLabel('Tour Packages');
      setSkuLabel('Tour Code');
      setPriceLabel('Package Price');
      setOrdersLabel('Itineraries');
      setCustomersLabel('Travelers');
      setStaffLabel('Travel Agents');
    } else if (preset === 'photography') {
      setProductsLabel('Photoshoots & Edit');
      setSkuLabel('Session ID');
      setPriceLabel('Session Fee');
      setOrdersLabel('Shoot Bookings');
      setCustomersLabel('Clients');
      setStaffLabel('Photographers');
    } else if (preset === 'logistics') {
      setProductsLabel('Shipments & Parcels');
      setSkuLabel('Tracking #');
      setPriceLabel('Freight Charge');
      setOrdersLabel('Waybills');
      setCustomersLabel('Consignees');
      setStaffLabel('Drivers');
    } else if (preset === 'bakery') {
      setProductsLabel('Cakes & Pastries');
      setSkuLabel('Batch #');
      setPriceLabel('Unit Price');
      setOrdersLabel('Pre-Orders');
      setCustomersLabel('Customers');
      setStaffLabel('Bakers');
    }
  };

  const addQuickField = (name: string, type: 'text' | 'number' | 'date' | 'boolean' | 'options' | 'file') => {
    if (customFields.some((f) => f.name.toLowerCase() === name.toLowerCase())) return;
    setCustomFields((prev) => [...prev, { name, type }]);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) setLogoUrl(evt.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) setBannerUrl(evt.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleModule = (key: keyof typeof modules) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePaymentMethod = (method: string) => {
    setPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    setCustomFields((prev) => [...prev, { name: newFieldName.trim(), type: newFieldType }]);
    setNewFieldName('');
  };

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    setError('');
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setError('');
    const finalBusinessName = name.trim() || 'My Business';
    const parsedCategories = categoriesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const customSettings: CustomBusinessSettings = {
      branding: {
        themeColor,
        tagline,
        logoUrl,
        bannerUrl,
        websiteUrl,
        registrationNumber,
        zipCode,
        email,
      },
      modules: {
        products: modules.products,
        orders: modules.orders,
        inventory: modules.inventory,
        billing: modules.billing,
        customers: modules.customers,
        reports: modules.reports,
        restaurant: modules.restaurant,
        salesman: modules.salesman,
        ai_assistant: modules.ai_assistant,
        expenses: modules.expenses,
        staff: modules.staff,
        loyalty: modules.loyalty,
      },
      moduleConfig: {
        inventorySettings: {
          lowStockAlertThreshold: Number(lowStockAlertThreshold) || 10,
          enableBatchExpiry,
          enablePurchaseOrders: true,
        },
        restaurantSettings: {
          diningMode,
          enableKDS,
        },
        crmSettings: {
          enableCreditLimit: true,
          defaultCreditLimit: Number(defaultCreditLimit) || 10000,
          enablePaymentReminders,
        },
      },
      permissions: {
        cashierCanDiscount,
        cashierCanDeleteOrder,
        cashierCanOverridePrice,
        cashierCanRefund,
        staffViewCostPrice,
        staffViewProfitMargins,
        staffEditStock,
        staffExportReports,
        staffManageCreditLimit,
      },
      localization: {
        dateFormat,
        numberFormat,
      },
      automation: {
        autoSendWhatsappOnDelivery,
        autoDraftPOOnLowStock,
      },
      payments: {
        methods: paymentMethods,
      },
      receipt: {
        template: receiptTemplate,
        paperSize,
        footerMessage,
        invoicePrefix,
        showLogoOnReceipt,
        showUpiQrCode,
        showTermsAndConditions,
        receiptCopyCount: Number(receiptCopyCount) || 1,
        autoCutPaper,
      },
      taxes: {
        taxEnabled: true,
        taxName,
        defaultTaxRate: Number(defaultTaxRate) || 0,
        pricesIncludeTax,
      },
      terminology: {
        preset: terminologyPreset,
        productsLabel,
        skuLabel,
        priceLabel,
        ordersLabel,
        customersLabel,
        staffLabel,
      },
      workflow: {
        posMode: 'counter',
        landingPage: '/dashboard',
        enableBarcode: true,
        enableBatchExpiry,
        enableThermalPrint: true,
        enableKhataCredit: true,
        operatingHours: '09:00 AM - 09:00 PM',
      },
      customFields,
      categories: parsedCategories,
    };

    try {
      await onComplete({
        name: finalBusinessName,
        category: 'others',
        inventoryEnabled: modules.inventory,
        currency,
        timezone,
        address,
        phone,
        gstNumber,
        customSettings,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create custom business');
    }
  };

  return (
    <Card className="ring-white/50 glass-sheen-sm border-0 shadow-2xl overflow-hidden max-w-2xl w-full mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-cyan-600/90 p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Zero-Code Custom Business Builder</h2>
              <p className="text-xs text-white/80">Step {step} of {totalSteps} — Pick from 20 Industry Terminology Presets or customize manually</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md">
            Others Category
          </span>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center gap-1.5 mt-4">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-white shadow-sm' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {error && (
          <div className="p-3 text-sm rounded-xl bg-rose-50 text-rose-600 border border-rose-200 animate-in fade-in">
            {error}
          </div>
        )}

        {/* STEP 1: IDENTITY & BRANDING */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-600" /> 1. Business Profile & Branding (All Optional)
              </h3>
              <p className="text-xs text-slate-500">Fill in any details you wish (name, logo, banner, GST, address). All fields are optional.</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Business Name (Optional)</label>
                  <Input
                    placeholder="e.g. Apex Tech, Royal Fitness (Defaults to 'My Business')"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Tagline / Slogan (Optional)</label>
                  <Input
                    placeholder="e.g. Premium Healthcare & Diagnostic Care"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                    <Upload className="w-3 h-3 text-emerald-600" /> Business Logo (Upload File)
                  </label>
                  <div className="flex items-center gap-2">
                    {logoUrl ? (
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-white shadow-sm">
                        <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full p-0.5"
                          title="Remove logo"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : null}
                    <label className="flex-1 flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border border-dashed border-slate-300 bg-white/50 text-slate-600 text-xs font-medium cursor-pointer hover:bg-white/80 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{logoUrl ? 'Change Logo' : 'Choose Logo Image'}</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                    <Upload className="w-3 h-3 text-emerald-600" /> Store Banner (Upload File)
                  </label>
                  <div className="flex items-center gap-2">
                    {bannerUrl ? (
                      <div className="relative w-14 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-white shadow-sm">
                        <img src={bannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setBannerUrl('')}
                          className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full p-0.5"
                          title="Remove banner"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : null}
                    <label className="flex-1 flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border border-dashed border-slate-300 bg-white/50 text-slate-600 text-xs font-medium cursor-pointer hover:bg-white/80 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{bannerUrl ? 'Change Banner' : 'Choose Banner Image'}</span>
                      <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">GSTIN / Tax ID (Optional)</label>
                  <Input
                    placeholder="22AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Trade License / Reg # (Optional)</label>
                  <Input
                    placeholder="REG-2026-98765"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Phone / WhatsApp</label>
                  <Input
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Business Email</label>
                  <Input
                    placeholder="contact@business.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Website URL</label>
                  <Input
                    placeholder="https://mybusiness.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Full Address (Optional)</label>
                  <Input
                    placeholder="Street, City, Landmark"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Zip / Pin Code</label>
                  <Input
                    placeholder="110001"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-emerald-600" /> Color Accent Theme
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
                    { id: 'sky', label: 'Sky Blue', bg: 'bg-sky-500' },
                    { id: 'violet', label: 'Violet', bg: 'bg-violet-500' },
                    { id: 'amber', label: 'Amber', bg: 'bg-amber-500' },
                    { id: 'rose', label: 'Rose', bg: 'bg-rose-500' },
                    { id: 'slate', label: 'Slate', bg: 'bg-slate-700' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemeColor(t.id as any)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${
                        themeColor === t.id
                          ? 'border-slate-800 bg-white/90 shadow-sm ring-1 ring-slate-800/30'
                          : 'border-slate-200/80 bg-white/40 hover:bg-white/70'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${t.bg} shrink-0`} />
                      <span className="text-slate-700">{t.label}</span>
                      {themeColor === t.id && <Check className="w-3 h-3 text-slate-800" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: MODULES */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" /> 2. Modules & Deep Sub-Settings
              </h3>
              <p className="text-xs text-slate-500">Toggle modules and customize deep rules for inventory, CRM & restaurant.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              <label
                onClick={() => toggleModule('products')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.products
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.products ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Boxes className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Products & Services</span>
                  <span className="text-[11px] text-slate-500">Catalog, item pricing & categories</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('orders')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.orders
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.orders ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Orders & Checkout POS</span>
                  <span className="text-[11px] text-slate-500">Counter sales, quick cart & receipts</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('inventory')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.inventory
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.inventory ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Inventory & Stock</span>
                  <span className="text-[11px] text-slate-500">Stock tracking & low stock alerts</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('billing')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.billing
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.billing ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Billing & Invoices</span>
                  <span className="text-[11px] text-slate-500">Tax invoices & payment vouchers</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('customers')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.customers
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.customers ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Customer CRM & Khata</span>
                  <span className="text-[11px] text-slate-500">Ledger history & credit dues</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('reports')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.reports
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.reports ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Reports & Analytics</span>
                  <span className="text-[11px] text-slate-500">Sales stats, GST tax & profit reports</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('restaurant')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.restaurant
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.restaurant ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Utensils className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Restaurant & Tables</span>
                  <span className="text-[11px] text-slate-500">Table booking & Kitchen KDS view</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('salesman')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.salesman
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.salesman ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Salesman Field Mode</span>
                  <span className="text-[11px] text-slate-500">Handheld field order collection</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('ai_assistant')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.ai_assistant
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.ai_assistant ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">AI Voice Assistant</span>
                  <span className="text-[11px] text-slate-500">Voice orders & smart chat bot</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('expenses')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.expenses
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.expenses ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Purchases & Expenses</span>
                  <span className="text-[11px] text-slate-500">Vendor bills & store expenses</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('staff')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.staff
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.staff ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Staff & Attendance</span>
                  <span className="text-[11px] text-slate-500">Employee roster & commissions</span>
                </div>
              </label>

              <label
                onClick={() => toggleModule('loyalty')}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  modules.loyalty
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-white/40 opacity-70'
                }`}
              >
                <div className={`p-2 rounded-xl ${modules.loyalty ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <BadgePercent className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-800 block">Loyalty & Rewards</span>
                  <span className="text-[11px] text-slate-500">Reward points & discount coupons</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* STEP 3: STAFF PERMISSIONS */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> 3. Granular Staff Permissions & Security
              </h3>
              <p className="text-xs text-slate-500">Customize fine-grained role permissions for Cashiers, Waiters, Staff & Managers.</p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-white/60 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" /> Cashier & Counter Staff Permissions
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cashierCanDiscount}
                      onChange={(e) => setCashierCanDiscount(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>Give Custom Discounts</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cashierCanDeleteOrder}
                      onChange={(e) => setCashierCanDeleteOrder(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>Delete / Cancel Orders</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cashierCanOverridePrice}
                      onChange={(e) => setCashierCanOverridePrice(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>Override Item Unit Prices</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cashierCanRefund}
                      onChange={(e) => setCashierCanRefund(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>Process Order Refunds</span>
                  </label>
                </div>
              </div>

              <div className="p-3.5 bg-white/60 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" /> General Staff & Manager Controls
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffViewCostPrice}
                      onChange={(e) => setStaffViewCostPrice(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>View Item Purchase / Cost Price</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffViewProfitMargins}
                      onChange={(e) => setStaffViewProfitMargins(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>View Business Profit Margins</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffEditStock}
                      onChange={(e) => setStaffEditStock(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>Adjust Stock Quantities</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffExportReports}
                      onChange={(e) => setStaffExportReports(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>Export Financial CSV Reports</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Date Format</label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white/50 px-3 text-xs focus:outline-none"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Indian/UK)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Standard)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Number System</label>
                  <select
                    value={numberFormat}
                    onChange={(e) => setNumberFormat(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white/50 px-3 text-xs focus:outline-none"
                  >
                    <option value="lakhs">Indian System (1,00,000)</option>
                    <option value="international">International System (100,000)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: RECEIPT, TAX & PAYMENTS */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> 4. Deep Receipt, Tax & Payment Customization
              </h3>
              <p className="text-xs text-slate-500">Configure receipt formatting, tax rules, accepted payment channels, and hardware signals.</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Receipt Template</label>
                  <select
                    value={receiptTemplate}
                    onChange={(e) => setReceiptTemplate(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white/50 px-3 text-xs focus:outline-none"
                  >
                    <option value="standard">Standard Store Slip</option>
                    <option value="minimal">Minimal Compact Slip</option>
                    <option value="formal">Formal Tax Invoice (A4)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Paper Size</label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white/50 px-3 text-xs focus:outline-none"
                  >
                    <option value="3inch">3-inch Thermal (80mm)</option>
                    <option value="2inch">2-inch Thermal (58mm)</option>
                    <option value="a4">Full A4 Sheet</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Receipt Copies</label>
                  <select
                    value={receiptCopyCount}
                    onChange={(e) => setReceiptCopyCount(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white/50 px-3 text-xs focus:outline-none"
                  >
                    <option value="1">1 Copy (Customer)</option>
                    <option value="2">2 Copies (Customer + Store)</option>
                    <option value="3">3 Copies (Kitchen + Store + Customer)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Invoice Prefix</label>
                  <Input
                    placeholder="INV-, JOB-, BILL-"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Tax Name</label>
                  <Input
                    placeholder="GST, VAT, Sales Tax"
                    value={taxName}
                    onChange={(e) => setTaxName(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Tax Rate %</label>
                  <Input
                    type="number"
                    placeholder="18"
                    value={defaultTaxRate}
                    onChange={(e) => setDefaultTaxRate(e.target.value)}
                    className="bg-white/50 h-10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Custom Footer Message on Receipt</label>
                <Input
                  placeholder="Thank you for your business! Please visit again."
                  value={footerMessage}
                  onChange={(e) => setFooterMessage(e.target.value)}
                  className="bg-white/50 h-10 text-xs"
                />
              </div>

              <div className="p-3 bg-white/60 rounded-xl border border-slate-200/80 space-y-2">
                <span className="text-xs font-bold text-slate-800 block flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5 text-emerald-600" /> Receipt & Thermal Hardware Signals
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLogoOnReceipt}
                      onChange={(e) => setShowLogoOnReceipt(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>Print Business Logo</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showUpiQrCode}
                      onChange={(e) => setShowUpiQrCode(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>Print Dynamic Payment UPI QR Code</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCutPaper}
                      onChange={(e) => setAutoCutPaper(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>ESC/POS Auto Paper Cutter</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pricesIncludeTax}
                      onChange={(e) => setPricesIncludeTax(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                    />
                    <span>Item Prices Include Tax</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Accepted Payment Channels
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['Cash', 'UPI / QR Code', 'Card (Credit/Debit)', 'Credit / Khata', 'Net Banking', 'Cheque'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => togglePaymentMethod(method)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                        paymentMethods.includes(method)
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                          : 'border-slate-200 bg-white/50 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {paymentMethods.includes(method) ? '✓ ' : '+ '} {method}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: 20 INDUSTRY TERMINOLOGY PRESETS & RICH CUSTOM ATTRIBUTES */}
        {step === 5 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" /> 5. Industry Terminology Presets & Custom Attributes
              </h3>
              <p className="text-xs text-slate-500">Pick from 20 industry terminology presets or customize entity labels + define custom item attributes.</p>
            </div>

            {/* Quick Industry Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5 text-emerald-600" /> 20 Quick Industry Terminology Presets
              </label>
              <div className="flex items-center gap-1.5 flex-wrap max-h-[140px] overflow-y-auto pr-1">
                {[
                  { id: 'retail', label: '🛍️ Retail & Store' },
                  { id: 'restaurant', label: '🍽️ Restaurant & Cafe' },
                  { id: 'clinic', label: '🏥 Clinic & Healthcare' },
                  { id: 'salon', label: '✂️ Salon & Spa' },
                  { id: 'wholesale', label: '📦 Wholesale & B2B' },
                  { id: 'auto', label: '🚗 Auto & Garage' },
                  { id: 'fitness', label: '🏋️ Fitness & Gym' },
                  { id: 'hotel', label: '🏨 Hotel & Lodging' },
                  { id: 'education', label: '🏫 School & Coaching' },
                  { id: 'services', label: '⚖️ Services & Agency' },
                  { id: 'jewelry', label: '💎 Jewelry & Gems' },
                  { id: 'laundry', label: '🧺 Laundry & Cleaners' },
                  { id: 'construction', label: '🏗️ Construction & Supply' },
                  { id: 'hardware_rental', label: '💻 IT Gadgets & Rental' },
                  { id: 'vet', label: '🐾 Vet & Pet Care' },
                  { id: 'catering', label: '🎨 Event & Catering' },
                  { id: 'travel', label: '✈️ Travel & Tourism' },
                  { id: 'photography', label: '📸 Photo Studio' },
                  { id: 'logistics', label: '🚚 Logistics & Freight' },
                  { id: 'bakery', label: '🍞 Bakery & Cakes' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyTerminologyPreset(p.id)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${
                      terminologyPreset === p.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold shadow-sm'
                        : 'border-slate-200 bg-white/50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Terminology Labels (Dropdown + Free-text Edit) */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Products / Services Label</label>
                <div className="flex gap-1.5">
                  <select
                    onChange={(e) => setProductsLabel(e.target.value)}
                    value={productsLabel}
                    className="w-1/2 h-9 rounded-xl border border-slate-200 bg-white text-xs px-2"
                  >
                    <option value="Products">Products</option>
                    <option value="Items">Items</option>
                    <option value="Dishes / Menu">Dishes / Menu</option>
                    <option value="Medicines & Services">Medicines</option>
                    <option value="Services & Packages">Services</option>
                    <option value="Bulk Goods">Bulk Goods</option>
                    <option value="Spare Parts & Repairs">Spare Parts</option>
                    <option value="Memberships & Classes">Memberships</option>
                    <option value="Rooms & Amenities">Rooms</option>
                    <option value="Courses & Batches">Courses</option>
                    <option value="Ornaments & Gems">Ornaments</option>
                    <option value="Garments & Dry Clean">Garments</option>
                    <option value="Materials & Supplies">Materials</option>
                    <option value="Laptops & Gadgets">Gadgets</option>
                    <option value="Pet Care & Vaccines">Pet Care</option>
                    <option value="Catering & Setup">Catering</option>
                    <option value="Tour Packages">Tour Packages</option>
                    <option value="Photoshoots & Edit">Photoshoots</option>
                    <option value="Shipments & Parcels">Shipments</option>
                    <option value="Cakes & Pastries">Cakes</option>
                  </select>
                  <Input
                    value={productsLabel}
                    onChange={(e) => setProductsLabel(e.target.value)}
                    className="w-1/2 bg-white/50 h-9 text-xs"
                    placeholder="Custom label..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Orders / Checkout Label</label>
                <div className="flex gap-1.5">
                  <select
                    onChange={(e) => setOrdersLabel(e.target.value)}
                    value={ordersLabel}
                    className="w-1/2 h-9 rounded-xl border border-slate-200 bg-white text-xs px-2"
                  >
                    <option value="Orders">Orders</option>
                    <option value="Invoices">Invoices</option>
                    <option value="KOT / Orders">KOT / Orders</option>
                    <option value="Appointments">Appointments</option>
                    <option value="Bookings">Bookings</option>
                    <option value="Sales Orders">Sales Orders</option>
                    <option value="Job Cards">Job Cards</option>
                    <option value="Enrollments">Enrollments</option>
                    <option value="Reservations">Reservations</option>
                    <option value="Contracts">Contracts</option>
                    <option value="Sales Slips">Sales Slips</option>
                    <option value="Pickup Orders">Pickup Orders</option>
                    <option value="Purchase Slips">Purchase Slips</option>
                    <option value="Rental Agreements">Rental Agreements</option>
                    <option value="Consultations">Consultations</option>
                    <option value="Event Bookings">Event Bookings</option>
                    <option value="Itineraries">Itineraries</option>
                    <option value="Shoot Bookings">Shoot Bookings</option>
                    <option value="Waybills">Waybills</option>
                    <option value="Pre-Orders">Pre-Orders</option>
                  </select>
                  <Input
                    value={ordersLabel}
                    onChange={(e) => setOrdersLabel(e.target.value)}
                    className="w-1/2 bg-white/50 h-9 text-xs"
                    placeholder="Custom label..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Customers / CRM Label</label>
                <div className="flex gap-1.5">
                  <select
                    onChange={(e) => setCustomersLabel(e.target.value)}
                    value={customersLabel}
                    className="w-1/2 h-9 rounded-xl border border-slate-200 bg-white text-xs px-2"
                  >
                    <option value="Customers">Customers</option>
                    <option value="Clients">Clients</option>
                    <option value="Guests">Guests</option>
                    <option value="Patients">Patients</option>
                    <option value="Dealers / Buyers">Dealers</option>
                    <option value="Vehicle Owners">Vehicle Owners</option>
                    <option value="Members">Members</option>
                    <option value="Students">Students</option>
                    <option value="Buyers">Buyers</option>
                    <option value="Contractors">Contractors</option>
                    <option value="Enterprise Clients">Enterprise Clients</option>
                    <option value="Pet Parents">Pet Parents</option>
                    <option value="Event Hosts">Event Hosts</option>
                    <option value="Travelers">Travelers</option>
                    <option value="Consignees">Consignees</option>
                  </select>
                  <Input
                    value={customersLabel}
                    onChange={(e) => setCustomersLabel(e.target.value)}
                    className="w-1/2 bg-white/50 h-9 text-xs"
                    placeholder="Custom label..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Staff / Employee Label</label>
                <div className="flex gap-1.5">
                  <select
                    onChange={(e) => setStaffLabel(e.target.value)}
                    value={staffLabel}
                    className="w-1/2 h-9 rounded-xl border border-slate-200 bg-white text-xs px-2"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Employees">Employees</option>
                    <option value="Waiters / Chefs">Waiters</option>
                    <option value="Doctors / Nurses">Doctors</option>
                    <option value="Stylists / Therapists">Stylists</option>
                    <option value="Sales Reps">Sales Reps</option>
                    <option value="Mechanics / Techs">Mechanics</option>
                    <option value="Personal Trainers">Trainers</option>
                    <option value="Front Desk Staff">Front Desk</option>
                    <option value="Teachers / Tutors">Teachers</option>
                    <option value="Consultants">Consultants</option>
                    <option value="Artisans / Jewelers">Jewelers</option>
                    <option value="Delivery Staff">Delivery</option>
                    <option value="Site Supervisors">Site Supervisors</option>
                    <option value="Technicians">Technicians</option>
                    <option value="Veterinarians">Veterinarians</option>
                    <option value="Coordinators">Coordinators</option>
                    <option value="Travel Agents">Travel Agents</option>
                    <option value="Photographers">Photographers</option>
                    <option value="Drivers">Drivers</option>
                    <option value="Bakers">Bakers</option>
                  </select>
                  <Input
                    value={staffLabel}
                    onChange={(e) => setStaffLabel(e.target.value)}
                    className="w-1/2 bg-white/50 h-9 text-xs"
                    placeholder="Custom label..."
                  />
                </div>
              </div>
            </div>

            {/* Quick Field Suggestions & Rich Attribute Creator */}
            <div className="pt-2 border-t border-slate-200/60 space-y-2.5">
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">Quick Custom Attribute Suggestions</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { name: 'Warranty Period', type: 'text' },
                    { name: 'Expiry Date', type: 'date' },
                    { name: 'Batch / Lot #', type: 'text' },
                    { name: 'HSN / SAC Code', type: 'text' },
                    { name: 'Brand Name', type: 'text' },
                    { name: 'Storage Temp', type: 'text' },
                    { name: 'Is Prescribed Only?', type: 'boolean' },
                  ].map((q) => (
                    <button
                      key={q.name}
                      type="button"
                      onClick={() => addQuickField(q.name, q.type as any)}
                      className="px-2.5 py-1 rounded-full border border-slate-200 bg-white/60 text-slate-700 text-[11px] hover:bg-emerald-50 hover:border-emerald-500 transition-colors"
                    >
                      + {q.name}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xs font-semibold text-slate-700 block">Add Custom Product Attribute Field</span>
              <div className="flex gap-2">
                <Input
                  placeholder="Field Name (e.g. Serial #, Rack #)"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  className="bg-white/50 h-9 text-xs flex-1"
                />
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as any)}
                  className="h-9 rounded-xl border border-slate-200 bg-white/50 px-2.5 text-xs outline-none"
                >
                  <option value="text">Text Input</option>
                  <option value="number">Number Input</option>
                  <option value="date">Date Picker</option>
                  <option value="boolean">Yes/No Switch</option>
                  <option value="options">Dropdown Options</option>
                  <option value="file">Document / PDF Attachment</option>
                </select>
                <Button type="button" onClick={addCustomField} className="h-9 px-3 rounded-xl text-xs bg-emerald-600 text-white">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {customFields.map((field, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 border border-slate-200 text-xs font-medium text-slate-700">
                    {field.name} ({field.type})
                    <button type="button" onClick={() => removeCustomField(idx)} className="text-rose-500 hover:text-rose-700">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: ELABORATE COMPLETE LAUNCH GUIDE & SUMMARY CARD */}
        {step === 6 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 6. Complete Custom Setup Guide & Final Review
              </h3>
              <p className="text-xs text-slate-500">Review your 360° workspace configuration across all 5 steps before launching.</p>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {/* 1. Business Profile & Branding */}
              <div className="p-3.5 rounded-2xl bg-white/60 border border-slate-200/80 space-y-2.5 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2.5">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover border" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        {name ? name.charAt(0).toUpperCase() : 'B'}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">{name || 'My Business'}</span>
                      <span className="text-[11px] text-slate-500">{tagline || 'Custom Business Profile'}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wide text-[10px]">
                    Theme: {themeColor} • {currency} ({timezone})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>GSTIN / Tax ID: <strong className="text-slate-800">{gstNumber || 'Not specified'}</strong></div>
                  <div>Trade License: <strong className="text-slate-800">{registrationNumber || 'Not specified'}</strong></div>
                  <div>Phone / WhatsApp: <strong className="text-slate-800">{phone || 'Not specified'}</strong></div>
                  <div>Business Email: <strong className="text-slate-800">{email || 'Not specified'}</strong></div>
                  <div className="col-span-2">Address: <strong className="text-slate-800">{address || 'Not specified'} {zipCode ? `(${zipCode})` : ''}</strong></div>
                </div>
              </div>

              {/* 2. Active Application Modules */}
              <div className="p-3.5 rounded-2xl bg-white/60 border border-slate-200/80 space-y-2 text-xs">
                <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" /> Active Application Modules
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(modules).map(([key, enabled]) =>
                    enabled ? (
                      <span key={key} className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-[11px] capitalize">
                        ✓ {key.replace('_', ' ')}
                      </span>
                    ) : null
                  )}
                </div>
              </div>

              {/* 3. Deep Sub-Rules & Security Matrix */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-white/60 border border-slate-200/80 space-y-1.5 text-xs">
                  <span className="font-bold text-slate-800 block flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" /> Deep Sub-Rules
                  </span>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div>Low Stock Threshold: <strong className="text-slate-800">{lowStockAlertThreshold} units</strong></div>
                    <div>Default Credit Limit: <strong className="text-slate-800">₹{defaultCreditLimit}</strong></div>
                    <div>Auto PO Drafts: <strong className="text-slate-800">{autoDraftPOOnLowStock ? 'Enabled' : 'Disabled'}</strong></div>
                    <div>Auto WhatsApp Receipts: <strong className="text-slate-800">{autoSendWhatsappOnDelivery ? 'Enabled' : 'Disabled'}</strong></div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/60 border border-slate-200/80 space-y-1.5 text-xs">
                  <span className="font-bold text-slate-800 block flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Staff Role Security
                  </span>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div>Cashier Discounts: <strong className="text-slate-800">{cashierCanDiscount ? 'Allowed' : 'Restricted'}</strong></div>
                    <div>Order Deletion: <strong className="text-slate-800">{cashierCanDeleteOrder ? 'Allowed' : 'Restricted'}</strong></div>
                    <div>Price Override: <strong className="text-slate-800">{cashierCanOverridePrice ? 'Allowed' : 'Restricted'}</strong></div>
                    <div>Cost Price Access: <strong className="text-slate-800">{staffViewCostPrice ? 'Allowed' : 'Restricted'}</strong></div>
                  </div>
                </div>
              </div>

              {/* 4. Receipts, Tax & Terminology */}
              <div className="p-3.5 rounded-2xl bg-white/60 border border-slate-200/80 space-y-2 text-xs">
                <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Receipts, Tax & Terminology
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>Tax: <strong className="text-slate-800">{taxName} ({defaultTaxRate}%)</strong></div>
                  <div>Invoice Prefix: <strong className="text-slate-800">{invoicePrefix}</strong></div>
                  <div>Receipt Format: <strong className="text-slate-800">{receiptTemplate} ({paperSize})</strong></div>
                  <div>Entity Preset: <strong className="text-slate-800 capitalize">{terminologyPreset}</strong></div>
                  <div className="col-span-2">
                    Custom Attributes ({customFields.length}): <strong className="text-slate-800">{customFields.map((f) => `${f.name} (${f.type})`).join(', ') || 'None'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200/60">
          <Button
            type="button"
            variant="outline"
            onClick={step === 1 ? onCancel : handleBack}
            disabled={loading}
            className="h-10 rounded-xl px-4 text-xs font-medium"
          >
            {step === 1 ? 'Cancel' : <><ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back</>}
          </Button>

          {step < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              className="h-10 rounded-xl px-5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Next Step <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="h-10 rounded-xl px-6 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25"
            >
              {loading ? 'Building Workspace...' : '✨ Launch Custom Workspace'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
