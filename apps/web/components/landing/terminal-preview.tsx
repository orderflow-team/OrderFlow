'use client';

import { useState } from 'react';
import {
  ShoppingCart,
  UtensilsCrossed,
  Pill,
  PackageCheck,
  UserCheck,
  CheckCircle2,
  Printer,
  QrCode,
  MapPin,
  FileText,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  Clock,
  Search,
  Check,
  Store,
  Building2,
  AlertTriangle,
  ShieldCheck,
  MessageSquare,
  IndianRupee,
  ChevronRight,
  Send,
} from 'lucide-react';

interface GroceryItem {
  id: string;
  name: string;
  price: number;
  hsn: string;
  gst: number;
  stock: number;
  qty: number;
}

const INITIAL_GROCERY_ITEMS: GroceryItem[] = [
  { id: '1', name: 'Parle-G Gold 100g (Pack of 10)', price: 120, hsn: '1905', gst: 18, stock: 142, qty: 1 },
  { id: '2', name: 'Amul Taaza T-Special 1L Pouch', price: 136, hsn: '0401', gst: 0, stock: 48, qty: 2 },
  { id: '3', name: 'Fortune Refined Sunflower Oil 1L', price: 155, hsn: '1512', gst: 5, stock: 6, qty: 1 },
];

export function TerminalPreview() {
  const [activeTab, setActiveTab] = useState<'grocery' | 'restaurant' | 'pharmacy' | 'wholesale' | 'salesman'>('grocery');

  // Grocery Interactive State
  const [groceryCart, setGroceryCart] = useState<GroceryItem[]>(INITIAL_GROCERY_ITEMS);
  const [lastScanned, setLastScanned] = useState('8901030612349');

  // Restaurant Interactive State
  const [selectedTable, setSelectedTable] = useState(2);

  // Pharmacy Interactive State
  const [showNearExpiryOnly, setShowNearExpiryOnly] = useState(false);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Grocery Cart Calculation
  const subtotal = groceryCart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const gstTotal = groceryCart.reduce((acc, item) => acc + (item.price * item.qty * item.gst) / 100, 0);

  const addItemToGrocery = (name: string, price: number, gst: number, stock: number) => {
    const existing = groceryCart.find((i) => i.name === name);
    if (existing) {
      setGroceryCart(
        groceryCart.map((i) => (i.name === name ? { ...i, qty: i.qty + 1 } : i))
      );
    } else {
      setGroceryCart([
        ...groceryCart,
        {
          id: String(Date.now()),
          name,
          price,
          hsn: '2106',
          gst,
          stock,
          qty: 1,
        },
      ]);
    }
    const newBarcode = String(Math.floor(8901000000000 + Math.random() * 999999999));
    setLastScanned(newBarcode);
    showToast(`Scanned ${name} • Barcode ${newBarcode} matched!`);
  };

  const removeGroceryItem = (id: string) => {
    setGroceryCart(groceryCart.filter((i) => i.id !== id));
  };

  return (
    <div className="rounded-[2.5rem] bg-white/95 backdrop-blur-2xl border border-slate-200/90 p-6 sm:p-9 shadow-2xl relative overflow-hidden group">
      {/* Ambient background accent glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Action Toast Notification */}
      {toastMessage && (
        <div className="absolute top-6 right-6 z-30 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Category Tabs Header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none border-b border-slate-200">
        {[
          { id: 'grocery', label: 'Kirana & Supermarket', icon: ShoppingCart },
          { id: 'restaurant', label: 'Restaurant & Cafe (KOT)', icon: UtensilsCrossed },
          { id: 'pharmacy', label: 'Pharmacy & Chemist (Rx)', icon: Pill },
          { id: 'wholesale', label: 'Wholesale & B2B Ledger', icon: PackageCheck },
          { id: 'salesman', label: 'Field Salesman Force', icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-100 scale-[1.01]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Terminal Bar (Realistic Software Window Chrome) */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 bg-slate-100/90 rounded-2xl px-4 py-3 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
            <span>OBIX Live POS Terminal</span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-700 font-bold">
              {activeTab === 'grocery' && 'Supermarket & Kirana Counter'}
              {activeTab === 'restaurant' && 'Dine-in Floor Plan & Kitchen Display (KOT)'}
              {activeTab === 'pharmacy' && 'Chemist Rx & Schedule H1 Register'}
              {activeTab === 'wholesale' && 'B2B Wholesale Dispatch & Credit Ledger'}
              {activeTab === 'salesman' && 'Salesman Field Fleet & Route Orders'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ESC/POS 3&quot; Thermal Ready
          </span>
        </div>
      </div>

      {/* Terminal Content Body (Realistic White App Canvas) */}
      <div className="mt-4 bg-slate-50/70 rounded-3xl p-4 sm:p-6 border border-slate-200 min-h-[420px] flex flex-col justify-between shadow-inner">
        
        {/* ============================================================ */}
        {/* TAB 1: GROCERY & SUPERMARKET */}
        {/* ============================================================ */}
        {activeTab === 'grocery' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Barcode scan status */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
              <span className="flex items-center gap-2 font-mono font-medium text-slate-700">
                <Search className="w-4 h-4 text-blue-600" />
                <span>BARCODE SCANNER (F2):</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{lastScanned}</span>
              </span>
              <span className="text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 text-[11px]">
                {groceryCart.length} ITEMS IN BASKET
              </span>
            </div>

            {/* Quick Add Barcode Simulation Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1 mr-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Click to Simulate Barcode Scan:
              </span>
              <button
                type="button"
                onClick={() => addItemToGrocery('Britannia Good Day 75g', 35, 18, 95)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" /> Good Day ₹35
              </button>
              <button
                type="button"
                onClick={() => addItemToGrocery('Tata Salt 1kg Pouch', 28, 0, 210)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" /> Tata Salt ₹28
              </button>
              <button
                type="button"
                onClick={() => addItemToGrocery('Cadbury Dairy Milk 50g', 50, 18, 30)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" /> Dairy Milk ₹50
              </button>
              <button
                type="button"
                onClick={() => addItemToGrocery('Amul Butter 100g', 56, 12, 45)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" /> Amul Butter ₹56
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 text-xs max-h-[260px] overflow-y-auto pr-1">
              {groceryCart.length === 0 ? (
                <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 text-xs">
                  Basket is empty. Click any item above to simulate instant barcode scan.
                </div>
              ) : (
                groceryCart.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-slate-900 font-bold text-sm">{item.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          HSN {item.hsn} • GST {item.gst}% • Qty: {item.qty} × ₹{item.price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-slate-900 font-bold text-sm font-mono">
                          ₹{(item.price * item.qty).toFixed(2)}
                        </div>
                        <div className={`text-[10px] font-semibold ${item.stock < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          Shelf Stock: {item.stock - item.qty} left
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGroceryItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Billing Footer Summary */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <div className="text-xs text-slate-500 font-medium">Net Amount Payable</div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  ₹{(subtotal + gstTotal).toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    (Subtotal ₹{subtotal.toFixed(2)} + GST ₹{gstTotal.toFixed(2)})
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => showToast(`Printed ₹${(subtotal + gstTotal).toFixed(2)} bill to 3" ESC/POS thermal printer!`)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Printer className="w-3.5 h-3.5" /> 1-Tap Print (F8)
                </button>
                <button
                  type="button"
                  onClick={() => showToast('Generated dynamic UPI QR on customer display screen!')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-600/20"
                >
                  <QrCode className="w-3.5 h-3.5" /> Dynamic UPI QR
                </button>
                <button
                  type="button"
                  onClick={() => showToast('Tax invoice PDF auto-sent to customer WhatsApp!')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Bill (F9)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: RESTAURANT & CAFE (KOT) */}
        {/* ============================================================ */}
        {activeTab === 'restaurant' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800">FLOOR PLAN • MAIN DINING (CLICK ANY TABLE TO VIEW KOT)</span>
              <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-bold text-[11px]">
                2 ACTIVE KITCHEN TICKETS COOKING
              </span>
            </div>

            {/* Interactive Table Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 1, name: 'Table 1', guests: '4 Guests', status: 'Dining', amount: '₹1,450', color: 'emerald' },
                { id: 2, name: 'Table 2', guests: 'KOT #108 Fired', status: 'Kitchen Cooking', amount: '₹890', color: 'amber' },
                { id: 3, name: 'Table 3', guests: 'Vacant', status: 'Available', amount: '--', color: 'slate' },
                { id: 4, name: 'Table 4', guests: 'Bill Requested', status: 'Pending Payment', amount: '₹2,180', color: 'emerald' },
              ].map((table) => {
                const isSelected = selectedTable === table.id;
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => {
                      setSelectedTable(table.id);
                      showToast(`Selected ${table.name} • Active order updated!`);
                    }}
                    className={`p-3.5 rounded-2xl text-center transition-all cursor-pointer border ${
                      isSelected
                        ? 'ring-2 ring-blue-600 bg-blue-50/80 border-blue-400 shadow-sm scale-102'
                        : table.color === 'emerald'
                        ? 'bg-white border-emerald-300 hover:border-emerald-400'
                        : table.color === 'amber'
                        ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400'
                        : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1">
                      {table.name} {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{table.guests}</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1 font-mono">{table.amount}</div>
                  </button>
                );
              })}
            </div>

            {/* Dynamic KOT Details Box */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-xs shadow-2xs">
              <div className="flex justify-between items-center text-amber-800 font-bold border-b border-slate-200 pb-2 mb-2">
                <span className="flex items-center gap-1.5">
                  <UtensilsCrossed className="w-4 h-4 text-amber-600" />
                  LIVE KITCHEN ORDER TICKET (Selected: Table {selectedTable})
                </span>
                <span className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> 02:40 mins ago
                </span>
              </div>
              {selectedTable === 2 ? (
                <div className="text-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span>• 2x Paneer Butter Masala (Medium Spicy, No Onion)</span>
                    <span className="font-bold font-mono">₹480.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 4x Butter Garlic Naan (Crispy)</span>
                    <span className="font-bold font-mono">₹240.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 1x Jeera Rice Special (Extra Raitha)</span>
                    <span className="font-bold font-mono">₹170.00</span>
                  </div>
                </div>
              ) : selectedTable === 1 ? (
                <div className="text-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span>• 1x Dal Makhani Special Handi</span>
                    <span className="font-bold font-mono">₹320.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 6x Tandoori Butter Roti</span>
                    <span className="font-bold font-mono">₹180.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 2x Special Sweet Lassi</span>
                    <span className="font-bold font-mono">₹160.00</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-center py-4 text-xs">
                  Table is active. Ready to add items, transfer table, or generate final bill.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Kitchen Display Screen (KDS) &amp; Printer Synced
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => showToast(`KOT sent to kitchen printer for Table ${selectedTable}!`)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl cursor-pointer border border-slate-200"
                >
                  Fire KOT
                </button>
                <button
                  type="button"
                  onClick={() => showToast(`Final bill settled and printed for Table ${selectedTable}!`)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-blue-600/20 transition-all"
                >
                  Settle &amp; Print Bill
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: PHARMACY & CHEMIST */}
        {/* ============================================================ */}
        {activeTab === 'pharmacy' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 font-mono">
              <span className="font-bold text-slate-800">DRUG LICENSE: 20B/21B-MH-90214</span>
              <button
                type="button"
                onClick={() => {
                  setShowNearExpiryOnly(!showNearExpiryOnly);
                  showToast(showNearExpiryOnly ? 'Showing all inventory' : 'Filtered to near-expiry medicines only');
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  showNearExpiryOnly
                    ? 'bg-amber-500 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {showNearExpiryOnly ? '⚠️ Filter: Near Expiry Only (Active)' : 'Filter Expiry Stock'}
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {(!showNearExpiryOnly || false) && (
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex justify-between items-center">
                  <div>
                    <div className="text-slate-900 font-bold text-sm">Augmentin 625 Duo Tablet (Strip of 10)</div>
                    <div className="text-slate-500 mt-0.5 text-[11px]">Batch: AUG-2490 • MFG: GlaxoSmithKline • Sched H1</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                      Exp: 08/2028 (OK)
                    </div>
                    <div className="text-slate-900 font-bold font-mono mt-1">MRP ₹201.50</div>
                  </div>
                </div>
              )}

              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/90 shadow-2xs flex justify-between items-center">
                <div>
                  <div className="text-slate-900 font-bold text-sm">Pantocid D SR Capsule (Strip of 15)</div>
                  <div className="text-slate-600 mt-0.5 text-[11px]">Batch: PNT-1092 • MFG: Cipla Ltd • Sched H</div>
                </div>
                <div className="text-right">
                  <div className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                    Exp: 09/2026 (Near Expiry)
                  </div>
                  <div className="text-slate-900 font-bold font-mono mt-1">MRP ₹148.00</div>
                </div>
              </div>

              {(!showNearExpiryOnly || false) && (
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex justify-between items-center">
                  <div>
                    <div className="text-slate-900 font-bold text-sm">Dolo 650mg Paracetamol (Strip of 15)</div>
                    <div className="text-slate-500 mt-0.5 text-[11px]">Batch: CR-8812 • MFG: Micro Labs • OTC</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                      Exp: 04/2027 (OK)
                    </div>
                    <div className="text-slate-900 font-bold font-mono mt-1">MRP ₹34.00</div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Prescribing Doctor: <strong>Dr. S. N. Mehta (MD)</strong></span>
              </div>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                Form 20/21 Compliant Ready
              </span>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <div className="text-xs text-slate-500">
                Net Chemist Bill:{' '}
                <span className="text-slate-900 font-extrabold text-base font-mono">₹383.50</span>
              </div>
              <button
                type="button"
                onClick={() => showToast('Chemist Tax Invoice generated with Batch numbers & Drug License details!')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Printer className="w-3.5 h-3.5" /> Print Chemist Tax Bill
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: WHOLESALE & B2B */}
        {/* ============================================================ */}
        {activeTab === 'wholesale' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200 font-mono">
              <span className="font-bold text-slate-800">B2B DEALER: MAHALAXMI TRADERS (GSTIN: 24AAACM9012F1Z4)</span>
              <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                CREDIT TIER: NET 30 DAYS
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex justify-between items-center">
                <div>
                  <div className="text-slate-900 font-bold text-sm">Sharbati Wheat 50kg Bags × 20 Bags</div>
                  <div className="text-slate-500 mt-0.5">Wholesale Tier B1 Discount Rate @ ₹2,200/bag</div>
                </div>
                <div className="text-right font-extrabold text-slate-900 font-mono text-sm">₹44,000.00</div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex justify-between items-center">
                <div>
                  <div className="text-slate-900 font-bold text-sm">Basmati Rice 30kg Bags × 10 Bags</div>
                  <div className="text-slate-500 mt-0.5">Wholesale Tier B1 Discount Rate @ ₹2,850/bag</div>
                </div>
                <div className="text-right font-extrabold text-slate-900 font-mono text-sm">₹28,500.00</div>
              </div>
            </div>

            {/* Mirrored Udhar Ledger Panel */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap justify-between items-center text-xs gap-3">
              <div>
                <span className="text-slate-500 block text-[11px]">Previous Dues: ₹18,200.00</span>
                <span className="text-slate-500 block text-[11px]">Current Invoice: ₹72,500.00</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[11px]">Total Mirrored Ledger Balance:</span>
                <span className="text-blue-700 font-extrabold text-base font-mono">₹90,700.00</span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <div className="text-xs text-slate-500">PO #PO-8910 Logged</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => showToast('Dispatched mirrored ledger balance statement to customer WhatsApp!')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-200"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Statement
                </button>
                <button
                  type="button"
                  onClick={() => showToast('Generated GST Tax Invoice PDF & E-Way Bill JSON!')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
                >
                  <FileText className="w-3.5 h-3.5" /> Generate B2B Invoice &amp; E-Way Bill
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: FIELD SALESMAN */}
        {/* ============================================================ */}
        {activeTab === 'salesman' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200 font-mono">
              <span className="font-bold text-slate-800">FIELD SALESMAN: RAJESH KUMAR (ROUTE #4 - DADAR)</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" /> GPS LIVE VERIFIED
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-900 font-bold flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-blue-600" /> Shree Ganesh Provision Store
                </span>
                <span className="text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold text-[11px]">
                  10:42 AM Geo-Checkin Verified (Accuracy: 2m)
                </span>
              </div>
              <div className="text-xs text-slate-600">
                Order Booked: 12 Cases Soft Drinks + 5 Packs Biscuits (Subtotal ₹14,500.00)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-slate-500 font-medium">Visits Completed Today</div>
                <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">14 / 18 Shops</div>
              </div>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-2xs">
                <div className="text-emerald-800 font-medium">Orders Booked on Route</div>
                <div className="text-xl font-extrabold text-emerald-900 mt-1 font-mono">₹78,400.00</div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center text-xs">
              <div className="text-slate-500 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Cloud Real-Time Depot Sync
              </div>
              <button
                type="button"
                onClick={() => showToast('Route check-in and orders pushed to central warehouse dispatch queue!')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
              >
                <Send className="w-3.5 h-3.5" /> Push Order to Central Depot Dispatch
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
