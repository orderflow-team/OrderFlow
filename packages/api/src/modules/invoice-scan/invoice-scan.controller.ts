import {
  Controller,
  Get,
  Post,
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
import { InvoiceScanService } from './invoice-scan.service';
import { ConfirmInvoiceScanDto } from './dto/confirm-invoice-scan.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Controller('api/invoice-scans')
export class InvoiceScanController {
  constructor(private invoiceScanService: InvoiceScanService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/invoice-scans';
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
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: any,
    @Query('businessId') businessId: string,
    @Query('supplierId') supplierId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('Only JPEG/PNG/WEBP images or PDFs are supported');
    }
    if (!businessId) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('businessId is required');
    }

    const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    const fileUrl = `/uploads/invoice-scans/${file.filename}`;

    return this.invoiceScanService.uploadAndParse(businessId, supplierId, fileUrl, file.path, fileType, file.mimetype);
  }

  @Get()
  findAll(@Query('businessId') businessId: string) {
    return this.invoiceScanService.findAll(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.invoiceScanService.findOne(id, businessId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ConfirmInvoiceScanDto) {
    return this.invoiceScanService.confirm(id, dto);
  }
}
