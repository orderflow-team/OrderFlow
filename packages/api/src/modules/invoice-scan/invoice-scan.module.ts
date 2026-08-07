import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceScan } from '../../database/entities/invoice-scan.entity';
import { InvoiceScanItem } from '../../database/entities/invoice-scan-item.entity';
import { InvoiceScanFile } from '../../database/entities/invoice-scan-file.entity';
import { Product } from '../../database/entities/product.entity';
import { InvoiceScanController } from './invoice-scan.controller';
import { InvoiceScanService } from './invoice-scan.service';
import { InvoiceVisionParserService } from './services/invoice-vision-parser.service';
import { InventoryModule } from '../inventory/inventory.module';
import { GeminiKeyPoolService } from '../../common/services/gemini-key-pool.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceScan, InvoiceScanItem, InvoiceScanFile, Product]), InventoryModule],
  controllers: [InvoiceScanController],
  providers: [InvoiceScanService, InvoiceVisionParserService, GeminiKeyPoolService],
})
export class InvoiceScanModule {}
