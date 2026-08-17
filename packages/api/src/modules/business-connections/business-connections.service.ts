import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { BusinessConnection } from '../../database/entities/business-connection.entity';
import { Business } from '../../database/entities/business.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Order } from '../../database/entities/order.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { RequestConnectionDto } from './dto/request-connection.dto';
import { normalizePhoneDigits } from '../../common/utils/phone.util';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class BusinessConnectionsService {
  constructor(
    @InjectRepository(BusinessConnection) private connectionsRepository: Repository<BusinessConnection>,
    @InjectRepository(Business) private businessesRepository: Repository<Business>,
    @InjectRepository(Notification) private notificationsRepository: Repository<Notification>,
    private dataSource: DataSource,
    private ordersService: OrdersService,
    private inventoryService: InventoryService,
  ) {}

  /**
   * Finds an existing, not-yet-linked Supplier/Customer contact by phone —
   * used at accept() time so a contact the user already created/matched
   * while placing an order (e.g. via the OBIX phone-match "Connect" prompt)
   * gets linked in place, instead of accept() creating a second, disconnected
   * duplicate contact that the already-placed order has no relation to.
   */
  private async findLinkableContact<T extends { id: string; business_id: string; linked_business_id: string | null }>(
    manager: EntityManager,
    entity: new () => T,
    businessId: string,
    counterpartPhone: string | null | undefined,
  ): Promise<T | null> {
    if (!counterpartPhone) return null;
    const last10 = normalizePhoneDigits(counterpartPhone).slice(-10);
    if (!last10) return null;
    return manager
      .createQueryBuilder(entity, 't')
      .where('t.business_id = :businessId', { businessId })
      .andWhere('t.linked_business_id IS NULL')
      .andWhere(`t.phone IS NOT NULL AND RIGHT(regexp_replace(t.phone, '[^0-9]', '', 'g'), 10) = :last10`, { last10 })
      .orderBy('t.created_at', 'DESC')
      .getOne();
  }

  /**
   * Finds the real OBIX Business behind a phone number, comparing the last 10
   * digits of both sides so "+91 98765-43210", "919876543210", and
   * "9876543210" are all treated as the same number regardless of which side
   * (if either) was entered with a country code.
   */
  private async findBusinessByPhone(phone: string, excludingBusinessId: string): Promise<Business | null> {
    const last10 = normalizePhoneDigits(phone).slice(-10);
    if (!last10) return null;
    return this.businessesRepository
      .createQueryBuilder('b')
      .where(`b.phone IS NOT NULL AND RIGHT(regexp_replace(b.phone, '[^0-9]', '', 'g'), 10) = :last10`, {
        last10,
      })
      .andWhere('b.id != :excludingBusinessId', { excludingBusinessId })
      // No DB-level uniqueness on phone, so two businesses could in principle
      // share a number — most-recently-registered wins instead of an
      // undefined/arbitrary match.
      .orderBy('b.created_at', 'DESC')
      .getOne();
  }

  /**
   * Non-mutating lookup used to nudge the "connect?" prompt at every phone
   * field in the app (Supplier/Customer forms, placing an order), not just
   * the dedicated Business Network panel. Reports any existing connection's
   * status regardless of direction, since the caller hasn't chosen a role
   * yet at this point — so the UI can show "pending"/"already linked"
   * instead of letting request() throw a duplicate-request error.
   */
  async checkPhone(businessId: string, phone: string) {
    const target = await this.findBusinessByPhone(phone, businessId);
    if (!target || target.b2b_sync_enabled === false) {
      return { match: null, connectionStatus: 'none' as const };
    }

    const existing = await this.connectionsRepository.findOne({
      where: [
        { retailer_business_id: businessId, wholesaler_business_id: target.id },
        { retailer_business_id: target.id, wholesaler_business_id: businessId },
      ],
    });

    return {
      match: { businessId: target.id, name: target.name },
      connectionStatus: (existing?.status as 'pending' | 'accepted' | 'rejected' | undefined) ?? 'none',
    };
  }

  async request(dto: RequestConnectionDto) {
    const requester = await this.businessesRepository.findOne({ where: { id: dto.businessId } });
    if (!requester) {
      throw new NotFoundException('Business not found');
    }

    const target = await this.findBusinessByPhone(dto.targetPhone, dto.businessId);
    if (!target) {
      throw new NotFoundException(
        'No OBIX business found with that phone number. Both businesses must be on OBIX to connect.',
      );
    }
    if (target.b2b_sync_enabled === false) {
      throw new BadRequestException(`${target.name} is not currently accepting business connections.`);
    }

    const retailerBusinessId = dto.role === 'retailer' ? dto.businessId : target.id;
    const wholesalerBusinessId = dto.role === 'retailer' ? target.id : dto.businessId;

    const existing = await this.connectionsRepository.findOne({
      where: { retailer_business_id: retailerBusinessId, wholesaler_business_id: wholesalerBusinessId },
    });

    let connection: BusinessConnection;
    if (existing) {
      if (existing.status === 'accepted') {
        throw new BadRequestException('Already connected to this business.');
      }
      if (existing.status === 'pending') {
        throw new BadRequestException('A connection request is already pending with this business.');
      }
      // Previously rejected — allow re-requesting instead of being stuck forever.
      existing.status = 'pending';
      existing.initiated_by_business_id = dto.businessId;
      connection = await this.connectionsRepository.save(existing);
    } else {
      connection = await this.connectionsRepository.save(
        this.connectionsRepository.create({
          retailer_business_id: retailerBusinessId,
          wholesaler_business_id: wholesalerBusinessId,
          initiated_by_business_id: dto.businessId,
          status: 'pending',
        }),
      );
    }

    const requesterIsRetailer = connection.retailer_business_id === requester.id;
    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        business_id: target.id,
        type: 'connection_request',
        message: requesterIsRetailer
          ? `${requester.name} wants to connect as a retailer buying from you on OBIX.`
          : `${requester.name} wants to connect as a wholesaler supplying to you on OBIX.`,
      }),
    );

    return connection;
  }

  async listForBusiness(businessId: string) {
    const rows = await this.connectionsRepository.find({
      where: [{ retailer_business_id: businessId }, { wholesaler_business_id: businessId }],
      relations: { retailer_business: true, wholesaler_business: true },
      order: { created_at: 'DESC' },
    });

    const summaries = rows.map((row) => {
      const iAmRetailer = row.retailer_business_id === businessId;
      const counterpart = iAmRetailer ? row.wholesaler_business : row.retailer_business;
      return {
        id: row.id,
        status: row.status,
        myRole: iAmRetailer ? ('retailer' as const) : ('wholesaler' as const),
        initiatedByMe: row.initiated_by_business_id === businessId,
        counterpartBusinessId: counterpart.id,
        counterpartName: counterpart.name,
        counterpartPhone: counterpart.phone,
        createdAt: row.created_at,
      };
    });

    return {
      connections: summaries.filter((r) => r.status === 'accepted'),
      incomingRequests: summaries.filter((r) => r.status === 'pending' && !r.initiatedByMe),
      outgoingRequests: summaries.filter((r) => r.status === 'pending' && r.initiatedByMe),
    };
  }

  private assertIsRecipient(connection: BusinessConnection, businessId: string) {
    const isParty = connection.retailer_business_id === businessId || connection.wholesaler_business_id === businessId;
    if (!isParty || connection.initiated_by_business_id === businessId) {
      throw new ForbiddenException('Only the recipient of this request can respond to it');
    }
  }

  /**
   * Accepting wires up the actual sync scaffolding: a linked Supplier row on
   * the retailer's side and a linked Customer row on the wholesaler's side,
   * auto-created (or linked if a matching contact already exists) from each
   * business's own profile — so a PO/Order raised right after accepting
   * already has somewhere to attach to.
   */
  async accept(connectionId: string, businessId: string) {
    return this.dataSource.transaction(async (manager) => {
      const connection = await manager.findOne(BusinessConnection, { where: { id: connectionId } });
      if (!connection) {
        throw new NotFoundException('Connection request not found');
      }
      this.assertIsRecipient(connection, businessId);
      if (connection.status !== 'pending') {
        throw new BadRequestException(`Connection is already ${connection.status}`);
      }

      connection.status = 'accepted';
      await manager.save(connection);

      const retailer = await manager.findOne(Business, { where: { id: connection.retailer_business_id } });
      const wholesaler = await manager.findOne(Business, { where: { id: connection.wholesaler_business_id } });

      let supplier = await manager.findOne(Supplier, {
        where: { business_id: connection.retailer_business_id, linked_business_id: connection.wholesaler_business_id },
      });
      if (!supplier) {
        // Reuse a contact the retailer already has for this wholesaler (by phone)
        // if one exists, so any PurchaseOrder already raised against it — the one
        // that may have prompted this very connection request — gets picked up
        // by the backfill below instead of being orphaned under a fresh duplicate.
        supplier = await this.findLinkableContact(manager, Supplier, connection.retailer_business_id, wholesaler?.phone);
        if (supplier) {
          supplier.linked_business_id = connection.wholesaler_business_id;
          await manager.save(Supplier, supplier);
        }
      }
      if (!supplier) {
        supplier = manager.create(Supplier, {
          business_id: connection.retailer_business_id,
          linked_business_id: connection.wholesaler_business_id,
          name: wholesaler?.name ?? 'Linked wholesaler',
          phone: wholesaler?.phone,
          address: wholesaler?.address,
          supplier_type: 'wholesaler',
        });
        await manager.save(Supplier, supplier);
      }

      let customer = await manager.findOne(Customer, {
        where: { business_id: connection.wholesaler_business_id, linked_business_id: connection.retailer_business_id },
      });
      if (!customer) {
        // Same reuse-by-phone logic as the supplier lookup above, mirrored for
        // the wholesaler's existing Customer contact for this retailer.
        customer = await this.findLinkableContact(manager, Customer, connection.wholesaler_business_id, retailer?.phone);
        if (customer) {
          customer.linked_business_id = connection.retailer_business_id;
          await manager.save(Customer, customer);
        }
      }
      if (!customer) {
        customer = manager.create(Customer, {
          business_id: connection.wholesaler_business_id,
          linked_business_id: connection.retailer_business_id,
          name: retailer?.name ?? 'Linked retailer',
          phone: retailer?.phone,
          address: retailer?.address,
        });
        await manager.save(Customer, customer);
      }

      // Backfill: mirror any Order/PurchaseOrder already raised against these
      // contacts before the link existed (e.g. the one that prompted this
      // connection request) — mirrorPurchaseOrderToRetailer/mirrorOrderToWholesaler
      // only ever run at creation time and had nothing to attach to back then.
      const unmirroredOrders = await manager.find(Order, {
        where: { business_id: connection.wholesaler_business_id, customer_id: customer.id, origin: Not('synced') },
      });
      for (const order of unmirroredOrders) {
        await this.ordersService.mirrorExistingOrderToRetailer(manager, order, customer);
      }

      const unmirroredPurchaseOrders = await manager.find(PurchaseOrder, {
        where: { business_id: connection.retailer_business_id, supplier_id: supplier.id, origin: Not('synced') },
      });
      for (const purchaseOrder of unmirroredPurchaseOrders) {
        await this.inventoryService.mirrorExistingPurchaseOrderToWholesaler(manager, purchaseOrder, supplier);
      }

      const accepterName = businessId === connection.retailer_business_id ? retailer?.name : wholesaler?.name;
      await manager.save(
        Notification,
        manager.create(Notification, {
          business_id: connection.initiated_by_business_id,
          type: 'connection_accepted',
          message: `${accepterName} accepted your OBIX connection request.`,
        }),
      );

      return connection;
    });
  }

  async reject(connectionId: string, businessId: string) {
    const connection = await this.connectionsRepository.findOne({ where: { id: connectionId } });
    if (!connection) {
      throw new NotFoundException('Connection request not found');
    }
    this.assertIsRecipient(connection, businessId);
    if (connection.status !== 'pending') {
      throw new BadRequestException(`Connection is already ${connection.status}`);
    }
    connection.status = 'rejected';
    return this.connectionsRepository.save(connection);
  }

  /** Unlinks an accepted connection. The Supplier/Customer contact rows stay — only linked_business_id is cleared. */
  async remove(connectionId: string, businessId: string) {
    return this.dataSource.transaction(async (manager) => {
      const connection = await manager.findOne(BusinessConnection, { where: { id: connectionId } });
      if (!connection) {
        throw new NotFoundException('Connection not found');
      }
      if (connection.retailer_business_id !== businessId && connection.wholesaler_business_id !== businessId) {
        throw new ForbiddenException('Not part of this connection');
      }

      await manager.update(
        Supplier,
        { business_id: connection.retailer_business_id, linked_business_id: connection.wholesaler_business_id },
        { linked_business_id: null },
      );
      await manager.update(
        Customer,
        { business_id: connection.wholesaler_business_id, linked_business_id: connection.retailer_business_id },
        { linked_business_id: null },
      );
      await manager.remove(BusinessConnection, connection);
      return { deleted: true };
    });
  }
}
