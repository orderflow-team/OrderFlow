import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { InvoiceScanService } from './invoice-scan.service';
import { ConfirmInvoiceScanDto } from './dto/confirm-invoice-scan.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_PAGES = 10;
const INVOICE_SCANS_BUCKET = 'invoice-scans';

@UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
@Controller('api/invoice-scans')
export class InvoiceScanController {
  private readonly s3 = new S3Client({ forcePathStyle: true });

  constructor(private invoiceScanService: InvoiceScanService) {}

  // No `storage` option -> multer's default memory storage, giving us `file.buffer`
  // to upload straight to Neon Object Storage instead of Render's ephemeral disk.
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', MAX_PAGES, { limits: { fileSize: 15 * 1024 * 1024 } }))
  async upload(
    @UploadedFiles() files: any[],
    @Query('businessId') businessId: string,
    @Query('supplierId') supplierId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException('Only JPEG/PNG/WEBP images or PDFs are supported');
      }
    }
    if (!businessId) {
      throw new BadRequestException('businessId is required');
    }

    const pages = await Promise.all(
      files.map(async (file) => {
        const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
        await this.s3.send(
          new PutObjectCommand({
            Bucket: INVOICE_SCANS_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
        return {
          fileUrl: `${process.env.AWS_ENDPOINT_URL_S3}/${INVOICE_SCANS_BUCKET}/${key}`,
          fileBuffer: file.buffer,
          fileType: file.mimetype === 'application/pdf' ? 'pdf' : 'image',
          mimeType: file.mimetype,
        };
      }),
    );

    return this.invoiceScanService.uploadAndParse(businessId, supplierId, pages);
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
