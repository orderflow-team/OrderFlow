import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, Raw } from 'typeorm';
import { CustomersService } from '../customers/customers.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { SalesmanService } from '../salesman/salesman.service';
import { InvoicesService } from '../billing/invoices.service';
import { PaymentsService } from '../billing/payments.service';
import { Business } from '../../database/entities/business.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Product } from '../../database/entities/product.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Table } from '../../database/entities/table.entity';
import { KOT } from '../../database/entities/kot.entity';
import { Salesman } from '../../database/entities/salesman.entity';
import { Visit } from '../../database/entities/visit.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Ledger } from '../../database/entities/ledger.entity';
import { PriceHistory } from '../../database/entities/price-history.entity';

export const DEV_MODULES = ['customers', 'products', 'orders', 'inventory', 'billing', 'restaurant', 'salesman'] as const;
export type DevModule = (typeof DEV_MODULES)[number];

interface SeedProduct {
  name: string;
  category?: string;
  unit?: string;
  purchasePrice?: number;
  sellingPrice: number;
  taxPercentage?: number;
  stockQuantity?: number;
  batchNumber?: string;
  expiryDate?: string;
  description?: string;
  imageUrl?: string;
}

/** Bundled demo dish photos (uploads/seed/*.jpg, served statically at /uploads/seed). */
const seedImage = (slug: string) => `/uploads/seed/${slug}.jpg`;

/**
 * Per-category demo catalogs (PRD section 6: modules/category enable per
 * business type) so "Load Demo Data" only fills in what that business
 * actually sells — a grocery store doesn't get a restaurant menu, etc.
 */
type CategoryKey = 'grocery' | 'retail' | 'pharmacy' | 'wholesale' | 'salesman' | 'restaurant' | 'others';

@Injectable()
export class DevToolsService {
  constructor(
    private customersService: CustomersService,
    private productsService: ProductsService,
    private suppliersService: SuppliersService,
    private ordersService: OrdersService,
    private inventoryService: InventoryService,
    private restaurantService: RestaurantService,
    private salesmanService: SalesmanService,
    private invoicesService: InvoicesService,
    private paymentsService: PaymentsService,
    private dataSource: DataSource,
  ) {}

private getCatalog(category: CategoryKey): SeedProduct[] {
    switch (category) {
      case 'pharmacy':
        return [
          { name: 'Crocin', category: 'Pharmacy', unit: 'pcs', purchasePrice: 12, sellingPrice: 18, taxPercentage: 12, stockQuantity: 6, batchNumber: 'CR2024A', expiryDate: this.daysFromNow(20) },
          { name: 'Dolo', category: 'Pharmacy', unit: 'pcs', purchasePrice: 14, sellingPrice: 20, taxPercentage: 12, stockQuantity: 50, batchNumber: 'DL2024B', expiryDate: this.daysFromNow(180) },
          { name: 'ORS Powder Sachet', category: 'Pharmacy', unit: 'pkt', purchasePrice: 8, sellingPrice: 12, taxPercentage: 12, stockQuantity: 40, batchNumber: 'ORS24', expiryDate: this.daysFromNow(300) },
          { name: 'Vicks Vaporub', category: 'Pharmacy', unit: 'pcs', purchasePrice: 65, sellingPrice: 85, taxPercentage: 18, stockQuantity: 5 },
        ];
      case 'restaurant':
        return [
          { name: 'Paneer Tikka', category: 'Starters', description: 'Marinated paneer chunks grilled to perfection.', unit: 'plate', purchasePrice: 70, sellingPrice: 180, taxPercentage: 5, stockQuantity: 50, imageUrl: seedImage('paneer-tikka') },
          { name: 'Crispy Corn', category: 'Starters', description: 'Fried sweet corn kernels tossed with Indian spices.', unit: 'plate', purchasePrice: 40, sellingPrice: 120, taxPercentage: 5, stockQuantity: 60, imageUrl: seedImage('crispy-corn') },
          { name: 'Paneer Butter Masala', category: 'Main Course', description: 'Rich and creamy curry made with paneer, spices, onions, tomatoes, and butter.', unit: 'plate', purchasePrice: 80, sellingPrice: 220, taxPercentage: 5, stockQuantity: 100, imageUrl: seedImage('paneer-butter-masala') },
          { name: 'Dal Makhani', category: 'Main Course', description: 'Classic North Indian dish made with whole urad dal, rajma, butter and spices.', unit: 'plate', purchasePrice: 50, sellingPrice: 160, taxPercentage: 5, stockQuantity: 80, imageUrl: seedImage('dal-makhani') },
          { name: 'Veg Biryani', category: 'Main Course', description: 'Aromatic basmati rice cooked with mixed vegetables and traditional spices.', unit: 'plate', purchasePrice: 60, sellingPrice: 190, taxPercentage: 5, stockQuantity: 100, imageUrl: seedImage('veg-biryani') },
          { name: 'Butter Naan', category: 'Breads & Rice', description: 'Soft, buttery Indian flatbread baked in a tandoor.', unit: 'pcs', purchasePrice: 8, sellingPrice: 35, taxPercentage: 5, stockQuantity: 200, imageUrl: seedImage('butter-naan') },
          { name: 'Garlic Naan', category: 'Breads & Rice', description: 'Tandoori naan infused with fresh garlic and cilantro.', unit: 'pcs', purchasePrice: 10, sellingPrice: 45, taxPercentage: 5, stockQuantity: 150, imageUrl: seedImage('garlic-naan') },
          { name: 'Jeera Rice', category: 'Breads & Rice', description: 'Basmati rice flavored with cumin seeds.', unit: 'plate', purchasePrice: 30, sellingPrice: 110, taxPercentage: 5, stockQuantity: 120, imageUrl: seedImage('jeera-rice') },
          { name: 'Tandoori Roti', category: 'Tandoori Specials', description: 'Traditional whole wheat flatbread baked in tandoor.', unit: 'pcs', purchasePrice: 6, sellingPrice: 25, taxPercentage: 5, stockQuantity: 100, imageUrl: seedImage('tandoori-roti') },
          { name: 'Gulab Jamun', category: 'Desserts', description: 'Deep-fried sweet dumplings soaked in sugar syrup.', unit: 'pcs', purchasePrice: 10, sellingPrice: 40, taxPercentage: 5, stockQuantity: 100, imageUrl: seedImage('gulab-jamun') },
          { name: 'Masala Chai', category: 'Beverages', description: 'Indian tea brewed with milk, sugar, and aromatic spices.', unit: 'pcs', purchasePrice: 5, sellingPrice: 20, taxPercentage: 5, stockQuantity: 200, imageUrl: seedImage('masala-chai') },
          { name: 'Sweet Lassi', category: 'Beverages', description: 'Traditional creamy yogurt-based sweet drink.', unit: 'pcs', purchasePrice: 15, sellingPrice: 60, taxPercentage: 5, stockQuantity: 80, imageUrl: seedImage('sweet-lassi') },
        ];
      case 'wholesale':
        return [
          { name: 'Tata Salt', category: 'Wholesale', unit: 'box', purchasePrice: 320, sellingPrice: 380, taxPercentage: 5, stockQuantity: 15 },
          { name: 'Aashirvaad Atta', category: 'Wholesale', unit: 'pkt', purchasePrice: 215, sellingPrice: 250, taxPercentage: 5, stockQuantity: 8 },
          { name: 'Fortune Sunflower Oil', category: 'Wholesale', unit: 'box', purchasePrice: 1900, sellingPrice: 2150, taxPercentage: 5, stockQuantity: 12 },
          { name: 'Sugar', category: 'Wholesale', unit: 'pkt', purchasePrice: 2100, sellingPrice: 2300, taxPercentage: 5, stockQuantity: 6 },
        ];
      case 'salesman':
        return [
          { name: 'Tata Salt', category: 'FMCG', unit: 'pkt', purchasePrice: 18, sellingPrice: 25, taxPercentage: 5, stockQuantity: 40 },
          { name: 'Maggi Noodles', category: 'FMCG', unit: 'pkt', purchasePrice: 10, sellingPrice: 14, taxPercentage: 5, stockQuantity: 8 },
          { name: 'Parle-G Biscuit', category: 'FMCG', unit: 'pkt', purchasePrice: 8, sellingPrice: 10, taxPercentage: 5, stockQuantity: 60 },
          { name: 'Fortune Sunflower Oil', category: 'FMCG', unit: 'pcs', purchasePrice: 140, sellingPrice: 165, taxPercentage: 5, stockQuantity: 30 },
        ];
      case 'grocery':
      case 'retail':
      case 'others':
      default:
        return [
          { name: 'Tata Salt', category: 'Grocery', unit: 'pkt', purchasePrice: 18, sellingPrice: 25, taxPercentage: 5, stockQuantity: 40 },
          { name: 'Aashirvaad Atta', category: 'Grocery', unit: 'pkt', purchasePrice: 220, sellingPrice: 260, taxPercentage: 5, stockQuantity: 25 },
          { name: 'Amul Toned Milk', category: 'Dairy', unit: 'pkt', purchasePrice: 48, sellingPrice: 56, taxPercentage: 0, stockQuantity: 8 },
          { name: 'Fortune Sunflower Oil', category: 'Grocery', unit: 'pcs', purchasePrice: 140, sellingPrice: 165, taxPercentage: 5, stockQuantity: 30 },
        ];
    }
  }

  /** Per PRD section 6 "Modules category ke according automatically enable honge" — mirrors apps/web/lib/business-modules.ts. */
  private getModulesForCategory(category: CategoryKey) {
    switch (category) {
      case 'grocery':
      case 'retail':
        return { inventory: true, restaurant: false, salesman: false };
      case 'pharmacy':
        return { inventory: true, restaurant: false, salesman: true };
      case 'wholesale':
        return { inventory: true, restaurant: false, salesman: true };
      case 'salesman':
        return { inventory: false, restaurant: false, salesman: true };
      case 'restaurant':
        return { inventory: false, restaurant: true, salesman: false };
      case 'others':
      default:
        return { inventory: true, restaurant: true, salesman: true };
    }
  }

  /** Always seeded for every category (see the unconditional `demoCustomerSpecs` array below) — a stable, low-collision marker for "has this business already got its one-time demo orders/invoices/notifications". */
  private static readonly DEMO_CUSTOMER_PHONES = ['9820000001', '9820000002', '9820000004'];

  /**
   * Idempotent per-entity: products/customers/suppliers/salesmen/tables are
   * matched by a natural key (name or phone) and reused if already present,
   * only creating whatever's actually missing — running this repeatedly tops
   * up gaps instead of piling up duplicates.
   *
   * Orders/KOTs/invoices/payments/visits/purchase-orders/notifications have no
   * natural key to dedupe against (they're one-time "demo activity", not
   * catalog data), so that whole block only runs the first time — detected via
   * DEMO_CUSTOMER_PHONES already existing — to avoid piling up duplicate demo
   * transactions on every re-run.
   */
  async seedAll(businessId: string) {

    const business = await this.dataSource.getRepository(Business).findOne({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const alreadySeeded = (await this.dataSource.getRepository(Customer).count({
      where: { business_id: businessId, phone: In(DevToolsService.DEMO_CUSTOMER_PHONES) },
    })) > 0;

    const category = (business.category as CategoryKey) || 'others';
    const modules = this.getModulesForCategory(category);
    // The category default is just a starting point — the business's own explicit
    // toggle (set at onboarding, see business-modules.ts on the frontend) always wins.
    modules.inventory = business.inventory_enabled;
    const catalog = this.getCatalog(category);

    // --- Products: reuse whatever already exists by name, only create what's missing ---
    // is_archived: false — a soft-deleted product (products.service.ts falls back to
    // archiving when a hard delete hits the order_items FK) is invisible everywhere else
    // in the app, so it counts as "missing" here too and gets a fresh row recreated.
    const productRepo = this.dataSource.getRepository(Product);
    const existingProducts = await productRepo.find({
      where: { business_id: businessId, name: In(catalog.map((c) => c.name)), is_archived: false },
    });
    const products = await Promise.all(
      catalog.map(async (p) => existingProducts.find((ep) => ep.name === p.name) ?? this.productsService.create({ businessId, ...p })),
    );
    const [itemA, itemB, itemC, itemD] = products;

    // --- Customers: same idempotent approach, matched by phone ---
    const demoCustomerSpecs = [
      { name: 'Ramesh Kirana Store', phone: '9820000001', address: 'MG Road, Pune', creditLimit: 20000 },
      { name: 'Sunita General Store', phone: '9820000002', address: 'Sector 21, Noida', creditLimit: 10000 },
      { name: 'Walk-in Customer', phone: '9820000004' },
    ];
    const customerRepo = this.dataSource.getRepository(Customer);
    const existingCustomers = await customerRepo.find({
      where: { business_id: businessId, phone: In(demoCustomerSpecs.map((c) => c.phone)) },
    });
    const customers = await Promise.all(
      demoCustomerSpecs.map(async (c) => existingCustomers.find((ec) => ec.phone === c.phone) ?? this.customersService.create({ businessId, ...c })),
    );
    const [custA, custB] = customers;

    let orderCount = 0;
    let tablesCount = 0;
    let salesmenCount = 0;
    let purchaseOrdersCount = 0;
    let invoicesCount = 0;

    if (modules.restaurant) {
      // findOrCreate by name so re-running the seed doesn't pile up duplicate T1/T2/T3 tables.
      const existingTables = await this.restaurantService.findAllTables(businessId);
      const findOrCreateTable = async (name: string, capacity: number) => {
        const existing = existingTables.find((t) => t.name === name);
        if (existing) return existing;
        return this.restaurantService.createTable({ businessId, name, capacity });
      };

      const table1 = await findOrCreateTable('T1', 4);
      const table2 = await findOrCreateTable('T2', 2);
      await findOrCreateTable('T3', 6);
      tablesCount = 3;

      if (!alreadySeeded) {
        // Dine-in orders tied to tables + KOT, the realistic flow for a restaurant business.
        const dineInOrder1 = await this.ordersService.create({
          businessId,
          customerName: 'Table 1 Guest',
          orderType: 'dine_in',
          items: [
            { productId: itemA.id, quantity: 2, unitPrice: Number(itemA.selling_price) },
            { productId: itemB.id, quantity: 4, unitPrice: Number(itemB.selling_price) },
          ],
        });
        const kot1 = await this.restaurantService.createKot({ businessId, orderId: dineInOrder1.id, tableId: table1.id, notes: 'No onions' });
        // KOT status is a forward-only state machine — pending must pass through preparing.
        await this.restaurantService.updateKotStatus(kot1.id, businessId, { status: 'preparing' });
        await this.restaurantService.updateKotStatus(kot1.id, businessId, { status: 'ready' });

        const dineInOrder2 = await this.ordersService.create({
          businessId,
          customerName: 'Table 2 Guest',
          orderType: 'dine_in',
          items: [{ productId: itemC.id, quantity: 2, unitPrice: Number(itemC.selling_price) }],
        });
        await this.restaurantService.createKot({ businessId, orderId: dineInOrder2.id, tableId: table2.id });
        orderCount += 2;

        // Billed + paid dine-in order, to showcase billing exports too.
        const billedOrder = await this.ordersService.create({
          businessId,
          customerName: 'Walk-in Customer',
          orderType: 'dine_in',
          items: [{ productId: itemD.id, quantity: 3, unitPrice: Number(itemD.selling_price) }],
        });
        await this.ordersService.updateStatus(billedOrder.id, businessId, { status: 'confirmed' });
        await this.ordersService.updateStatus(billedOrder.id, businessId, { status: 'delivered' });
        await this.invoicesService.generateFromOrder(billedOrder.id, businessId);
        await this.paymentsService.create({
          businessId,
          orderId: billedOrder.id,
          amount: Number(billedOrder.total_amount),
          paymentMethod: 'Cash',
        });
        await this.ordersService.updateStatus(billedOrder.id, businessId, { status: 'paid' });
        orderCount += 1;
        invoicesCount += 1;
      }
    } else if (!alreadySeeded) {
      // Confirmed + paid order with a real invoice, to showcase billing exports.
      const order1 = await this.ordersService.create({
        businessId,
        customerId: custA.id,
        customerName: custA.name,
        orderType: 'regular',
        items: [
          { productId: itemA.id, quantity: 3, unitPrice: Number(itemA.selling_price) },
          { productId: itemB.id, quantity: 5, unitPrice: Number(itemB.selling_price) },
        ],
      });
      await this.ordersService.updateStatus(order1.id, businessId, { status: 'confirmed' });
      await this.ordersService.updateStatus(order1.id, businessId, { status: 'delivered' });
      await this.invoicesService.generateFromOrder(order1.id, businessId);
      await this.paymentsService.create({
        businessId,
        orderId: order1.id,
        customerId: custA.id,
        amount: Number(order1.total_amount),
        paymentMethod: 'UPI',
        transactionId: 'TXN-DEMO-001',
      });
      await this.ordersService.updateStatus(order1.id, businessId, { status: 'paid' });
      invoicesCount += 1;

      // Confirmed but unpaid order, to showcase Outstanding/Pending Payments.
      const order2 = await this.ordersService.create({
        businessId,
        customerId: custB.id,
        customerName: custB.name,
        orderType: 'regular',
        items: [
          { productId: itemC.id, quantity: 6, unitPrice: Number(itemC.selling_price) },
          { productId: itemD.id, quantity: 4, unitPrice: Number(itemD.selling_price) },
        ],
      });
      await this.ordersService.updateStatus(order2.id, businessId, { status: 'confirmed' });

      // Quick Parchi (free-text) draft order, to showcase auto-product-save.
      await this.ordersService.create({
        businessId,
        customerName: 'Walk-in Customer',
        orderType: 'regular',
        items: [{ customProductName: `${itemA.name} (loose)`, quantity: 2, unit: itemA.unit, unitPrice: Number(itemA.selling_price) / 2 }],
      });
      orderCount += 3;
    }

    if (modules.salesman) {
      // findOrCreate by name so re-running the seed doesn't pile up duplicate salesmen.
      const salesmanRepo = this.dataSource.getRepository(Salesman);
      const existingSalesmen = await salesmanRepo.find({
        where: { business_id: businessId, name: In(['Vikram Singh', 'Anita Desai']) },
      });
      let salesman1 = existingSalesmen.find((s) => s.name === 'Vikram Singh');
      if (!salesman1) {
        salesman1 = await this.salesmanService.create({ businessId, name: 'Vikram Singh', phone: '9830000001', route: 'North Pune Route' });
      }
      if (!existingSalesmen.find((s) => s.name === 'Anita Desai')) {
        await this.salesmanService.create({ businessId, name: 'Anita Desai', phone: '9830000002', route: 'East Pune Route' });
      }
      salesmenCount = 2;

      if (!alreadySeeded) {
        const visit1 = await this.salesmanService.checkIn({ businessId, salesmanId: salesman1.id, customerId: custA.id, gpsLocation: '18.5204,73.8567', notes: 'Discussed monthly order' });
        await this.salesmanService.checkOut(visit1.id, businessId);
        await this.salesmanService.checkIn({ businessId, salesmanId: salesman1.id, customerId: custB.id, gpsLocation: '18.5304,73.8467' });
      }
    }

    if (modules.inventory) {
      // findOrCreate by name so re-running the seed doesn't pile up duplicate suppliers.
      const supplierRepo = this.dataSource.getRepository(Supplier);
      const supplierSpecs = [
        { name: 'Sharma Wholesale Traders', phone: '9810000001', gstNumber: '07AASFS1234A1Z5' },
        { name: 'Patel Distributors', phone: '9810000002', gstNumber: '24AASFS5678B1Z2' },
      ];
      const existingSuppliers = await supplierRepo.find({
        where: { business_id: businessId, name: In(supplierSpecs.map((s) => s.name)) },
      });
      const suppliers = await Promise.all(
        supplierSpecs.map(async (s) => existingSuppliers.find((es) => es.name === s.name) ?? this.suppliersService.create({ businessId, ...s })),
      );

      if (!alreadySeeded) {
        const po1 = await this.inventoryService.createPurchaseOrder({
          businessId,
          supplierId: suppliers[0].id,
          items: [
            { productId: itemA.id, quantity: 50, unitPrice: Number(itemA.purchase_price) },
            { productId: itemB.id, quantity: 30, unitPrice: Number(itemB.purchase_price) },
          ],
        });
        await this.inventoryService.receivePurchaseOrder(po1.id, businessId);

        await this.inventoryService.createPurchaseOrder({
          businessId,
          supplierId: suppliers[1].id,
          items: [{ productId: itemC.id, quantity: 20, unitPrice: Number(itemC.purchase_price) }],
        });
        purchaseOrdersCount = 2;
      }
    }

    // A couple of sample notifications, since the real reminder cron only
    // fires on stale/overdue data (not present right after a fresh seed).
    // Stock/expiry alerts are meaningless for a business that isn't tracking inventory.
    if (modules.inventory && !alreadySeeded) {
      const lowStockItem = products.find((p) => p.stock_quantity <= 10) ?? products[0];
      const expiringItem = products.find((p) => p.expiry_date) ?? lowStockItem;
      await this.dataSource.getRepository(Notification).save([
        this.dataSource.getRepository(Notification).create({
          business_id: businessId,
          type: 'low_stock',
          message: `${lowStockItem.name} is low on stock (${lowStockItem.stock_quantity} left)`,
        }),
        this.dataSource.getRepository(Notification).create({
          business_id: businessId,
          type: 'expiry_alert',
          message: expiringItem.expiry_date
            ? `${expiringItem.name} batch ${expiringItem.batch_number} expires soon`
            : `${expiringItem.name} is running low`,
        }),
      ]);
    }

    return {
      message: alreadySeeded
        ? `Demo catalog data topped up for category "${category}" — demo orders/invoices were already present, so no new ones were added.`
        : `Demo data seeded for category "${category}"`,
      category,
      products: products.length,
      customers: customers.length,
      orders: orderCount,
      tables: tablesCount,
      salesmen: salesmenCount,
      purchaseOrders: purchaseOrdersCount,
      invoices: invoicesCount,
    };
  }

  /**
   * Runs every module's clear in one call. Order matters even though each
   * clearModule() call is its own transaction: 'orders' removes order_items/
   * KOT/payments/invoices tied to those orders first, so 'billing' and
   * 'restaurant' are left with nothing but this business's standalone rows
   * (e.g. an invoice never linked to a surviving order) to clean up.
   */
  private static readonly CLEAR_ALL_ORDER: DevModule[] = [
    'orders', 'billing', 'restaurant', 'salesman', 'customers', 'products', 'inventory',
  ];

  async clearAll(businessId: string) {
    const business = await this.dataSource.getRepository(Business).findOne({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    for (const module of DevToolsService.CLEAR_ALL_ORDER) {
      await this.clearModule(module, businessId);
    }
    return { message: 'All data cleared for this business' };
  }

  /**
   * The DB is created via TypeORM `synchronize: true` from the entity
   * decorators (see database.config.ts) — none of them declare `onDelete`,
   * so every FK is plain NO ACTION regardless of what schema.sql documents.
   * Every clear below deletes children before parents explicitly.
   */
  async clearModule(module: string, businessId: string) {
    // Wipes real business data with no way back — the frontend's
    // ClearModuleButton documents this as dev-only, but we are allowing it in production too as requested.
    if (!DEV_MODULES.includes(module as DevModule)) {
      throw new BadRequestException(`Unknown module "${module}"`);
    }

    return this.dataSource.transaction(async (manager) => {
      switch (module as DevModule) {
        case 'orders': {
          const orderIds = (await manager.find(Order, { where: { business_id: businessId }, select: { id: true } })).map((o) => o.id);
          if (orderIds.length) {
            const invoiceIds = (await manager.find(Invoice, { where: { order_id: this.inIds(orderIds) }, select: { id: true } })).map((i) => i.id);
            if (invoiceIds.length) {
              await manager.delete(InvoiceItem, { invoice_id: this.inIds(invoiceIds) });
              await manager.delete(Invoice, { id: this.inIds(invoiceIds) });
            }
            await manager.delete(OrderItem, { order_id: this.inIds(orderIds) });
            await manager.delete(KOT, { order_id: this.inIds(orderIds) });
            await manager.delete(Payment, { order_id: this.inIds(orderIds) });
            await manager.delete(Order, { id: this.inIds(orderIds) });
          }
          break;
        }

        case 'products': {
          await manager.update(OrderItem, { product_id: this.inSubquery('products', businessId) }, { product_id: null });
          await manager.update(InvoiceItem, { product_id: this.inSubquery('products', businessId) }, { product_id: null });
          await manager.update(PriceHistory, { product_id: this.inSubquery('products', businessId) }, { product_id: null });
          await manager.delete(Stock, { business_id: businessId });
          await manager.delete(PurchaseItem, { product_id: this.inSubquery('products', businessId) });
          await manager.delete(Product, { business_id: businessId });
          break;
        }

        case 'customers': {
          await manager.update(Order, { customer_id: this.inSubquery('customers', businessId) }, { customer_id: null });
          await manager.delete(Visit, { customer_id: this.inSubquery('customers', businessId) });
          await manager.delete(PriceHistory, { customer_id: this.inSubquery('customers', businessId) });
          await manager.delete(Ledger, { customer_id: this.inSubquery('customers', businessId) });
          await manager.delete(Customer, { business_id: businessId });
          break;
        }

        case 'inventory': {
          await manager.delete(PurchaseItem, { purchase_order_id: this.inSubquery('purchase_orders', businessId) });
          await manager.delete(PurchaseOrder, { business_id: businessId });
          await manager.delete(Stock, { business_id: businessId });
          await manager.delete(Ledger, { supplier_id: this.inSubquery('suppliers', businessId) });
          await manager.delete(Supplier, { business_id: businessId });
          break;
        }

        case 'billing': {
          await manager.delete(InvoiceItem, { invoice_id: this.inSubquery('invoices', businessId) });
          await manager.delete(Invoice, { business_id: businessId });
          await manager.delete(Payment, { business_id: businessId });
          break;
        }

        case 'restaurant': {
          // order_items.kot_id / orders.table_id have no FK cascade — null
          // them out before deleting. Using explicit id lists rather than
          // inSubquery('kot', ...) here: TypeORM's raw-SQL token rewriting
          // collides with "kot" since OrderItem.kot is itself a relation
          // property name, corrupting the subquery's FROM table.
          const kotIds = (await manager.find(KOT, { where: { business_id: businessId }, select: { id: true } })).map((k) => k.id);
          if (kotIds.length) {
            await manager.update(OrderItem, { kot_id: this.inIds(kotIds) }, { kot_id: null });
          }
          const tableIds = (await manager.find(Table, { where: { business_id: businessId }, select: { id: true } })).map((t) => t.id);
          if (tableIds.length) {
            await manager.update(Order, { table_id: this.inIds(tableIds) }, { table_id: null });
          }
          await manager.delete(KOT, { business_id: businessId });
          await manager.delete(Table, { business_id: businessId });
          break;
        }

        case 'salesman': {
          await manager.delete(Visit, { salesman_id: this.inSubquery('salesmen', businessId) });
          await manager.delete(Salesman, { business_id: businessId });
          break;
        }
      }

      return { message: `Cleared all ${module} data` };
    });
  }

  private inIds(ids: string[]) {
    return In(ids);
  }

  /** `id IN (SELECT id FROM <table> WHERE business_id = ...)`, as a TypeORM FindOperator. `table` is always one of our own constant names, never user input. */
  private inSubquery(table: string, businessId: string) {
    return Raw((alias) => `${alias} IN (SELECT id FROM ${table} WHERE business_id = :businessId)`, { businessId });
  }

  private daysFromNow(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }
}
