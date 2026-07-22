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
  const [activeTab, setActiveTab] = useState('grocery');

  // Grocery Interactive State
  const [groceryCart, setGroceryCart] = useState<GroceryItem[]>(INITIAL_GROCERY_ITEMS);
  const [lastScanned, setLastScanned] = useState('8901030612349');

  // Restaurant Interactive State
  const [selectedTable, setSelectedTable] = useState(2);

  // Pharmacy Interactive State
  const [showNearExpiryOnly, setShowNearExpiryOnly] = useState(false);

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
    setLastScanned(String(Math.floor(1000000000000 + Math.random() * 9000000000000)));
  };

  const removeGroceryItem = (id: string) => {
    setGroceryCart(groceryCart.filter((i) => i.id !== id));
  };

  return (
    <div className="rounded-3xl bg-slate-900/95 border border-slate-800 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
      {/* Category Tabs Header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none border-b border-slate-800">
        {[
          { id: 'grocery', label: 'Grocery Counter', icon: ShoppingCart },
          { id: 'restaurant', label: 'Restaurant & Cafe', icon: UtensilsCrossed },
          { id: 'pharmacy', label: 'Pharmacy & Chemist', icon: Pill },
          { id: 'wholesale', label: 'Wholesale B2B', icon: PackageCheck },
          { id: 'salesman', label: 'Field Salesman', icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Terminal Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-slate-950/70 rounded-2xl p-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span>OrderFlow Live POS Terminal</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-bold">Interactive Mode</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ESC/POS Printer Ready
          </span>
        </div>
      </div>

      {/* Terminal Content Body */}
      <div className="mt-4 bg-slate-950 rounded-2xl p-6 border border-slate-800 min-h-[400px] flex flex-col justify-between">
        {/* GROCERY TAB */}
        {activeTab === 'grocery' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono border-b border-slate-800/80 pb-3">
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-emerald-400" /> BARCODE SCANNER: {lastScanned}
              </span>
              <span className="text-emerald-400 font-bold">{groceryCart.length} ITEMS IN BASKET</span>
            </div>

            {/* Quick Add Barcode Simulation Buttons */}
            <div className="flex flex-wrap gap-2 pt-1 pb-2">
              <span className="text-xs text-slate-500 font-mono flex items-center mr-1">Simulate Scan:</span>
              <button
                onClick={() => addItemToGrocery('Good Day Butter 75g', 35, 18, 95)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono border border-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400" /> Good Day ₹35
              </button>
              <button
                onClick={() => addItemToGrocery('Tata Salt 1kg Pouch', 28, 0, 210)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono border border-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400" /> Tata Salt ₹28
              </button>
              <button
                onClick={() => addItemToGrocery('Cadbury Dairy Milk 50g', 50, 18, 30)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono border border-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400" /> Dairy Milk ₹50
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 font-mono text-sm max-h-[220px] overflow-y-auto pr-1">
              {groceryCart.length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-xs">
                  Basket empty. Click any item above to simulate barcode scan.
                </div>
              ) : (
                groceryCart.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-slate-200 font-semibold">{item.name}</div>
                        <div className="text-xs text-slate-500">
                          HSN {item.hsn} • GST {item.gst}% • Qty: {item.qty}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-slate-100 font-bold">₹{item.price * item.qty}.00</div>
                        <div className={`text-xs ${item.stock < 10 ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                          Stock: {item.stock - item.qty} left
                        </div>
                      </div>
                      <button
                        onClick={() => removeGroceryItem(item.id)}
                        className="text-slate-600 hover:text-rose-400 transition-colors p-1"
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
            <div className="pt-4 border-t border-slate-800 flex flex-wrap justify-between items-center gap-4">
              <div>
                <div className="text-xs text-slate-400">Total Net Amount</div>
                <div className="text-2xl font-bold text-emerald-400 font-mono">
                  ₹{(subtotal + gstTotal).toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-500">(Incl. GST ₹{gstTotal.toFixed(2)})</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert(`Printing thermal GST bill for ₹${(subtotal + gstTotal).toFixed(2)}!`)}
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-emerald-400 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Printer className="w-3.5 h-3.5" /> Thermal Print (1-Tap)
                </button>
                <button
                  onClick={() => alert(`UPI QR Code displayed on customer display screen!`)}
                  className="px-4 py-2 bg-slate-800 text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" /> Dynamic UPI QR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RESTAURANT TAB */}
        {activeTab === 'restaurant' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-800/80 pb-3">
              <span>FLOOR MAP • MAIN DINING (CLICK A TABLE TO VIEW KOT)</span>
              <span className="text-amber-400 font-bold">2 ACTIVE KITCHEN TICKETS</span>
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
                    onClick={() => setSelectedTable(table.id)}
                    className={`p-3.5 rounded-2xl text-center transition-all cursor-pointer border ${
                      isSelected
                        ? 'ring-2 ring-emerald-400 bg-emerald-500/15 border-emerald-500/50 scale-105'
                        : table.color === 'emerald'
                        ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                        : table.color === 'amber'
                        ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
                        : 'bg-slate-900 border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="text-xs font-mono font-bold text-white flex items-center justify-center gap-1">
                      {table.name} {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1">{table.guests}</div>
                    <div className="text-sm font-bold text-emerald-400 mt-1">{table.amount}</div>
                  </button>
                );
              })}
            </div>

            {/* Dynamic KOT Details Box */}
            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 font-mono text-xs">
              <div className="flex justify-between items-center text-amber-400 font-bold border-b border-slate-800 pb-2 mb-2">
                <span>🔥 LIVE KITCHEN ORDER TICKET (Selected: Table {selectedTable})</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 02:40 mins ago</span>
              </div>
              {selectedTable === 2 ? (
                <div className="text-slate-300 space-y-1.5">
                  <div className="flex justify-between"><span>• 2x Paneer Butter Masala (Medium Spicy)</span><span className="text-slate-400">₹480</span></div>
                  <div className="flex justify-between"><span>• 4x Butter Garlic Naan</span><span className="text-slate-400">₹240</span></div>
                  <div className="flex justify-between"><span>• 1x Jeera Rice (Extra Raitha)</span><span className="text-slate-400">₹170</span></div>
                </div>
              ) : selectedTable === 1 ? (
                <div className="text-slate-300 space-y-1.5">
                  <div className="flex justify-between"><span>• 1x Dal Makhani Special</span><span className="text-slate-400">₹320</span></div>
                  <div className="flex justify-between"><span>• 6x Tandoori Roti</span><span className="text-slate-400">₹180</span></div>
                  <div className="flex justify-between"><span>• 2x Sweet Lassi</span><span className="text-slate-400">₹160</span></div>
                </div>
              ) : (
                <div className="text-slate-400 text-center py-2">Table active. Ready for item addition or bill print.</div>
              )}
            </div>

            <div className="pt-2 flex justify-between items-center text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Kitchen Display Screen (KDS) Synced
              </div>
              <button
                onClick={() => alert(`Printing final bill for Table ${selectedTable}!`)}
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer hover:bg-emerald-400 transition-all"
              >
                Settle &amp; Print Bill
              </button>
            </div>
          </div>
        )}

        {/* PHARMACY TAB */}
        {activeTab === 'pharmacy' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono border-b border-slate-800/80 pb-3">
              <span>DRUG LICENSE: DL-MH-20B-90214</span>
              <button
                onClick={() => setShowNearExpiryOnly(!showNearExpiryOnly)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  showNearExpiryOnly ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {showNearExpiryOnly ? '⚠️ Filter: Near Expiry Only' : 'Filter Expiry'}
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {(!showNearExpiryOnly || false) && (
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="text-slate-200 font-semibold">Augmentin 625 Duo Tablet (Strip of 10)</div>
                    <div className="text-slate-500 mt-0.5">Batch: AUG-2490 • MFG: GlaxoSmithKline</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">Exp: 08/2027 (OK)</div>
                    <div className="text-slate-300 font-semibold">MRP ₹201.50</div>
                  </div>
                </div>
              )}

              <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 flex justify-between items-center">
                <div>
                  <div className="text-slate-200 font-semibold">Pantocid D SR Capsule (Strip of 15)</div>
                  <div className="text-slate-500 mt-0.5">Batch: PNT-1092 • MFG: Cipla Ltd</div>
                </div>
                <div className="text-right">
                  <div className="text-amber-400 font-bold">Exp: 09/2026 (Near Expiry)</div>
                  <div className="text-slate-300 font-semibold">MRP ₹148.00</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" /> Prescribing Doctor: Dr. S. N. Mehta (MD)
              </div>
              <span className="text-emerald-400 font-mono font-bold">Form 20/21 Complaint Ready</span>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <div className="text-xs text-slate-400">Net Chemist Bill: <span className="text-emerald-400 font-bold text-sm">₹349.50</span></div>
              <button
                onClick={() => alert('Printing Chemist Bill with Drug License details!')}
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-emerald-400"
              >
                <Printer className="w-3.5 h-3.5" /> Print Chemist Bill
              </button>
            </div>
          </div>
        )}

        {/* WHOLESALE TAB */}
        {activeTab === 'wholesale' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-800/80 pb-3">
              <span>B2B CUSTOMER: MAHALAXMI TRADERS (GSTIN: 27AABCM9012F1Z4)</span>
              <span className="text-amber-400 font-bold">CREDIT TIER: NET 15 DAYS</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <div className="text-slate-200 font-semibold">Sharbati Wheat 50kg Bags x 20</div>
                  <div className="text-slate-500">Tier Pricing: Wholesale Bulk Tier B2</div>
                </div>
                <div className="text-right font-bold text-slate-200">₹44,000.00</div>
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <div className="text-slate-200 font-semibold">Basmati Rice 30kg Bags x 10</div>
                  <div className="text-slate-500">Tier Pricing: Wholesale Bulk Tier B1</div>
                </div>
                <div className="text-right font-bold text-slate-200">₹28,500.00</div>
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Previous Dues: ₹18,200</span>
              <span className="text-emerald-400 font-mono font-bold">Total Ledger Balance: ₹90,700</span>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <div className="text-xs text-slate-400">PO #PO-8910 Logged</div>
              <button
                onClick={() => alert('Generating B2B Invoice PDF with HSN Summary!')}
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-emerald-400"
              >
                Generate B2B Invoice
              </button>
            </div>
          </div>
        )}

        {/* SALESMAN TAB */}
        {activeTab === 'salesman' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-800/80 pb-3">
              <span>FIELD SALESMAN: RAJESH KUMAR (ROUTE #4 - DADAR)</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> GPS LIVE
              </span>
            </div>

            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Shree Ganesh Provision Store
                </span>
                <span className="text-emerald-400 font-mono">10:42 AM Check-in Verified</span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Order Collected: 12 Cases Soft Drinks + 5 Packs Biscuits (Total ₹14,500)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center text-xs font-mono">
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-slate-400">Visits Completed</div>
                <div className="text-lg font-bold text-white mt-0.5">14 / 18 Shops</div>
              </div>
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="text-emerald-400">Orders Collected Today</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">₹78,400</div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <div className="text-xs text-slate-400 font-mono">Sync Status: Cloud Realtime</div>
              <button
                onClick={() => alert('Opening Mobile Route Check-in Log!')}
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-emerald-400"
              >
                Log Route Visit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
