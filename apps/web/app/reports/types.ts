export interface AnalyticsPayload {
  kpis: {
    todaysSalesRevenue: number;
    todaysPurchaseExpenses: number;
    grossProfitMargin: number;
    netCashFlow: number;
    taxSummary: {
      today: { outputGst: number; inputGst: number };
      month: { outputGst: number; inputGst: number };
    };
  };
  chart: { date: string; sales: number; purchases: number }[];
  purchaseHistory: { id: string; supplierName: string; orderNumber: string | null; status: string; totalAmount: number; createdAt: string }[];
  salesHistory: { id: string; customerName: string; orderNumber: string | null; status: string; totalAmount: number; createdAt: string }[];
  fastMoving: { productId: string; productName: string; totalQuantity: number; totalRevenue: number }[];
  lowStockProducts: { id: string; name: string; stock_quantity: number; batch_number: string | null }[];
  expiringSoon: { id: string; name: string; batch_number: string | null; expiry_date: string | null }[];
  customers: {
    topCustomers: { customerId: string; customerName: string; orderCount: number; totalSpent: number }[];
    newVsReturning: { newCustomers: number; newRevenue: number; returningCustomers: number; returningRevenue: number };
    averageOrderValue: number;
    inactiveCustomers: { customerId: string; customerName: string; lastOrderAt: string; lifetimeSpent: number }[];
    allTimeTopCustomers: { customerId: string; customerName: string; orderCount: number; totalSpent: number }[];
    creditExposure: { id: string; name: string; outstandingAmount: number; creditLimit: number; utilizationPercent: number }[];
  };
  products: {
    categoryBreakdown: { category: string; totalRevenue: number; totalQuantity: number }[];
    slowMoving: { id: string; name: string; stockQuantity: number; tiedUpValue: number }[];
    inventoryValuation: { totalValue: number; skuCount: number; totalUnits: number };
    topMarginProducts: { productId: string; productName: string; totalMargin: number; totalQuantity: number }[];
    rxOtcSplit: { rx: { totalRevenue: number; totalQuantity: number }; otc: { totalRevenue: number; totalQuantity: number } };
    expiryValueAtRisk: number;
    reorderSuggestions: { id: string; name: string; stockQuantity: number; velocityPerDay: number; daysLeft: number }[];
  };
  suppliers: {
    topSuppliers: { supplierId: string; supplierName: string; orderCount: number; totalSpent: number }[];
    leadTime: { supplierId: string; supplierName: string; avgLeadTimeDays: number; orderCount: number }[];
  };
  finance: {
    paymentMethodBreakdown: { method: string; total: number }[];
    expenses: {
      total: number;
      byCategory: { category: string; total: number }[];
      recent: { id: string; category: string | null; amount: number | string; description: string | null; expense_date: string }[];
      trend: { date: string; total: number }[];
    };
    netProfit: number;
    monthOverMonthGrowthPercent: number;
    netGstPayable: number;
  };
  operations: {
    orderStatusBreakdown: { status: string; orderCount: number; totalAmount: number }[];
    cancellationRatePercent: number;
    salesByDayOfWeek: { day: string; total: number }[];
    salesByHourOfDay: { hour: number; total: number }[];
    salesmanPerformance: { salesmanId: string; salesmanName: string; orderCount: number; totalSales: number }[];
  };
}

export interface OutstandingCustomer {
  id: string;
  name: string;
  outstanding_amount: string | number;
}
