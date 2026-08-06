import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductWithVariantsDto } from './dto/create-product-with-variants.dto';
import { MergeProductsDto } from './dto/merge-products.dto';
import { getPublicBaseUrl } from '../../common/utils/public-url.util';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Controller('api/products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/media';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return {
      url: `${getPublicBaseUrl()}/uploads/media/${file.filename}`,
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

  @Get()
  findAll(
    @Query('businessId') businessId: string, 
    @Query('search') search?: string,
    @Query('isDraft') isDraft?: string
  ) {
    return this.productsService.findAll(businessId, search, isDraft);
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
