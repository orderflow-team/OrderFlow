import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AllowGuest } from '../../common/decorators/allow-guest.decorator';
import { getGuestScope } from '../../common/utils/guest-scope';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductWithVariantsDto } from './dto/create-product-with-variants.dto';
import { MergeProductsDto } from './dto/merge-products.dto';

const PRODUCT_IMAGES_BUCKET = 'product-images';
// product-images is a public_read bucket, so only real image types may go in.
// The extension comes from the (checked) mime type, never the client's filename.
const PRODUCT_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Controller('api/products')
export class ProductsController {
  private readonly s3 = new S3Client({ forcePathStyle: true });

  constructor(private productsService: ProductsService) {}

  // No `storage` option -> multer's default memory storage, giving us `file.buffer`
  // to upload straight to Neon Object Storage instead of Render's ephemeral disk.
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_req, file, cb) => {
        cb(null, file.mimetype in PRODUCT_IMAGE_EXTENSIONS);
      },
      // Held in memory before upload, so an unbounded size is a memory-exhaustion hole.
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Upload a PNG, JPEG, WebP or GIF image up to 5 MB.');
    }
    const key = `${Date.now()}-${randomUUID()}${PRODUCT_IMAGE_EXTENSIONS[file.mimetype]}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: PRODUCT_IMAGES_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return {
      url: `${process.env.AWS_ENDPOINT_URL_S3}/${PRODUCT_IMAGES_BUCKET}/${key}`,
    };
  }

  /**
   * Quick-Add: one payload, one transaction — a master product plus all of
   * its packaging/pricing variants (e.g. 350ml / 1Ltr / 5Ltr).
   */
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('with-variants')
  createWithVariants(@Body() dto: CreateProductWithVariantsDto) {
    return this.productsService.createWithVariants(dto);
  }

  // Salesman is included alongside admin/manager so the New Order camera
  // scan flow can create a product on the spot for an unrecognized barcode
  // without needing an admin/manager present at the counter.
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALESMAN)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // limit/offset are optional and unbounded when omitted — same
  // opt-in-only contract as orders.controller.ts's pagination, but here the
  // service call underneath actually forks based on whether they're present
  // (see findAllPaginated's comment in products.service.ts) rather than
  // orders' single method, since other callers (chat-order's catalog
  // matching, in particular) call ProductsService.findAll directly and need
  // the full, unbounded array — changing findAll's own contract would have
  // broken them.
  // Also the guest (table QR / takeaway) menu — see stripping below.
  @Get()
  @AllowGuest()
  async findAll(
    @Query('businessId') businessId: string,
    @Query('search') search?: string,
    @Query('isDraft') isDraft?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('category') category?: string,
    @Res({ passthrough: true }) res?: Response,
    @Req() req?: { user?: { role?: string; userId?: string } },
  ) {
    if (getGuestScope(req?.user)) {
      // Guests only need the menu — never cost price or who it's bought from.
      const products = await this.productsService.findAll(businessId, search, isDraft);
      return products.map(({ purchase_price, last_supplier_id, last_supplier, ...menuFields }: any) => menuFields);
    }
    if (limit === undefined && offset === undefined) {
      return this.productsService.findAll(businessId, search, isDraft);
    }
    const { products, total } = await this.productsService.findAllPaginated(
      businessId,
      search,
      isDraft,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      category,
    );
    res?.setHeader('X-Total-Count', String(total));
    return products;
  }

  // Must be registered before the `:id` route below, or "barcode-lookup"
  // would be swallowed as an :id param instead of matching here.
  /** Powers the New Order camera-scan quick-add prefill — cross-tenant by design, see shared-barcode-catalog.entity.ts. `businessId` here is only for the auth guard, not part of the lookup itself. */
  @Get('barcode-lookup')
  getBarcodeSuggestion(@Query('barcode') barcode: string) {
    return this.productsService.getBarcodeSuggestion(barcode);
  }

  // Same "must come before :id" reasoning as barcode-lookup above.
  // Cheap aggregate total + per-category counts — the products list pages'
  // "Total: N" and category tab counts used to be computed client-side from
  // the full loaded array, which goes wrong the moment that list is
  // paginated instead of loading everything.
  @Get('stats')
  getStats(
    @Query('businessId') businessId: string,
    @Query('search') search?: string,
    @Query('isDraft') isDraft?: string,
  ) {
    return this.productsService.getStats(businessId, search, isDraft);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.productsService.findOne(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, businessId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.productsService.remove(id, businessId);
  }

  /** Merges a duplicate product (e.g. from OCR spelling drift on a rescanned invoice) into another, reassigning its order/purchase/price history first. */
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('merge')
  merge(@Body() dto: MergeProductsDto) {
    return this.productsService.mergeProducts(dto.businessId, dto.keepProductId, dto.removeProductId);
  }
}
