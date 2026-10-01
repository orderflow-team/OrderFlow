import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { AllowGuest } from '../../common/decorators/allow-guest.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { getGuestScope, GuestScope } from '../../common/utils/guest-scope';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateOrderItemDto, AddOrderItemsDto, ReturnOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const PRESCRIPTIONS_BUCKET = 'prescriptions';
const ALLOWED_PRESCRIPTION_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * A guest must pay the catalog price — never trust a client-supplied
 * unitPrice from them. Staff keep the ability to override at checkout.
 */
function stripGuestPriceOverrides(items: CreateOrderItemDto[] | undefined, role?: string) {
  if (role !== UserRole.GUEST || !items) return;
  for (const item of items) delete item.unitPrice;
}

/** A table guest may only touch its own table's dine-in orders; a takeaway guest only takeaway orders. */
function guestOwnsOrder(scope: GuestScope, order: { table_id?: string | null; order_type?: string }) {
  return scope.kind === 'table'
    ? order.table_id === scope.tableId && order.order_type === 'dine_in'
    : order.order_type === 'take_away';
}

type AuthedRequest = Request & { user?: { userId?: string; businessId?: string; role?: string } };

// Anyone who scans a table QR / opens a takeaway link gets a GUEST token for
// the business, no login needed. JwtAuthGuard blocks guests on every route
// except the four @AllowGuest() ones the self-service order pages call
// (list/view/create/add items), and each of those is scoped to the guest's
// own table / takeaway orders below.
@UseGuards(JwtAuthGuard, BusinessScopeGuard)
@Controller('api/orders')
export class OrdersController {
  private readonly s3 = new S3Client({ forcePathStyle: true });

  constructor(private ordersService: OrdersService) {}

  // No `storage` option -> multer's default memory storage, giving us `file.buffer`
  // to upload straight to Neon Object Storage. Uploaded before the order exists yet
  // (checkout builds the cart first) — the returned key gets passed into
  // CreateOrderDto.prescriptionImageKey once the order is actually submitted.
  @Post('prescription-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        cb(null, ALLOWED_PRESCRIPTION_MIME_TYPES.has(file.mimetype));
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadPrescription(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: PRESCRIPTIONS_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return { key };
  }

  // `prescriptions` is a private bucket (patient health information) — every
  // read goes through a short-lived presigned URL instead of a bare link.
  @Get(':id/prescription-url')
  async getPrescriptionUrl(@Param('id') id: string, @Query('businessId') businessId: string) {
    const order = await this.ordersService.findOne(id, businessId);
    if (!order.prescription_image_key) {
      throw new NotFoundException('No prescription photo attached to this order');
    }
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: PRESCRIPTIONS_BUCKET, Key: order.prescription_image_key }),
      { expiresIn: 3600 },
    );
    return { url };
  }

  @Post()
  @AllowGuest()
  async create(@Body() dto: CreateOrderDto, @Req() req: AuthedRequest) {
    const guest = getGuestScope(req.user);
    if (guest) {
      stripGuestPriceOverrides(dto.items, req.user?.role);
      // Guests can't pick the table, order type or a customer account (that
      // would put the bill on someone's credit ledger) — it all comes from
      // the QR / link their token was issued for.
      dto.orderType = guest.kind === 'table' ? 'dine_in' : 'take_away';
      dto.tableId = guest.kind === 'table' ? guest.tableId : undefined;
      dto.customerId = undefined;
      dto.prescriptionImageKey = undefined;
      // Synthetic "guest-..." id isn't a users row — never record it as creator.
      return this.ordersService.create(dto, undefined);
    }
    return this.ordersService.create(dto, req.user?.userId);
  }

  @Post(':id/send-whatsapp-invoice')
  async sendWhatsappInvoice(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body('phone') rawPhone?: string,
  ) {
    const order = await this.ordersService.findOne(id, businessId);
    await this.ordersService.dispatchWhatsappInvoice(order, businessId, rawPhone);
    return { success: true, message: 'Invoice PDF dispatched to WhatsApp' };
  }

  @Get()
  @AllowGuest()
  async findAll(
    @Req() req: AuthedRequest,
    @Query('businessId') businessId?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const effectiveBizId = businessId || req.user?.businessId || '';
    const guest = getGuestScope(req.user);
    if (guest) {
      // Only the open tab on the guest's own table — never the business's
      // order history. The takeaway page tracks its order by id instead.
      return guest.kind === 'table'
        ? this.ordersService.findOpenOrdersForTable(effectiveBizId, guest.tableId)
        : [];
    }
    const { orders, total } = await this.ordersService.findAll(
      effectiveBizId,
      status,
      customerId,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      search || undefined,
    );
    // Total goes in a header, not the body — the body stays a plain array so
    // every existing caller that doesn't pass limit/offset (most of them;
    // see orders.service.ts's findAll) keeps working unchanged.
    res?.setHeader('X-Total-Count', String(total));
    return orders;
  }

  // Static routes MUST come before @Get(':id') or NestJS will match them as the id param
  @Get('customer-prices')
  customerPrices(
    @Query('businessId') businessId: string,
    @Query('customerId') customerId: string,
  ) {
    return this.ordersService.customerPrices(businessId, customerId);
  }

  @Post('suggest-price')
  suggestPrice(
    @Query('businessId') businessId: string,
    @Query('customerId') customerId: string,
    @Body() item: CreateOrderItemDto,
  ) {
    return this.ordersService.suggestPrice(businessId, customerId, item);
  }

  @Get(':id/receipt')
  async getReceipt(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Res() res: Response,
  ) {
    const html = await this.ordersService.getOrderReceiptHtml(id, businessId);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get(':id')
  @AllowGuest()
  async findOne(@Param('id') id: string, @Query('businessId') businessId: string, @Req() req?: AuthedRequest) {
    const order = await this.ordersService.findOne(id, businessId);
    const guest = getGuestScope(req?.user);
    if (guest && !guestOwnsOrder(guest, order)) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, businessId, dto);
  }

  @Post(':id/return')
  returnOrder(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: ReturnOrderDto,
  ) {
    return this.ordersService.returnOrder(id, businessId, dto?.items);
  }

  @Post(':id/items')
  @AllowGuest()
  async addItems(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: AddOrderItemsDto,
    @Req() req?: AuthedRequest,
  ) {
    const guest = getGuestScope(req?.user);
    if (guest) {
      const order = await this.ordersService.findOne(id, businessId);
      if (!guestOwnsOrder(guest, order)) {
        throw new NotFoundException('Order not found');
      }
      stripGuestPriceOverrides(dto.items, req?.user?.role);
      dto.customerId = undefined;
    }
    return this.ordersService.addItems(id, businessId, dto);
  }

  @Put(':id/items')
  replaceItems(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.ordersService.replaceItems(id, businessId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.ordersService.remove(id, businessId);
  }
}
