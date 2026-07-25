export interface User {
  id: string;
  email: string;
  fullName?: string;
  role: 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen_staff' | 'delivery_person' | 'accountant' | 'salesman';
  businessId?: string;
}

export interface Business {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  inventoryEnabled: boolean;
  aiChatEnabled: boolean;
  customSettings?: Record<string, any> | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  sellingPrice: string | number;
  purchasePrice?: string | number | null;
  taxPercentage?: string | number;
  stockQuantity: number;
  description?: string | null;
  isAvailable: boolean;
  category?: string | null;
  imageUrl?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  creditLimit: string | number;
  outstandingAmount: string | number;
}

export interface OrderItem {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unit?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName: string;
  status: 'draft' | 'confirmed' | 'packed' | 'dispatched' | 'delivered' | 'paid' | 'returned' | 'cancelled';
  totalAmount: number;
  createdAt: string;
  items?: OrderItem[];
}
