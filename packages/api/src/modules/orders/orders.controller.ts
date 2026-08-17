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
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateOrderItemDto, AddOrderItemsDto, ReturnOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const PRESCRIPTIONS_BUCKET = 'prescriptions';

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
  @UseInterceptors(FileInterceptor('file'))
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
  async create(@Body() dto: CreateOrderDto, @Req() req: Request & { user?: { userId: string } }) {
    try {
      return await this.ordersService.create(dto, req.user?.userId);
    } catch (error: any) {
      require('fs').appendFileSync('error.log', error.stack + '\n\n');
      throw error;
    }
  }

  @Get()
  findAll(
    @Query('businessId') businessId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.ordersService.findAll(businessId, status, customerId);
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
  findOne(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.ordersService.findOne(id, businessId);
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
  addItems(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: AddOrderItemsDto,
  ) {
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
