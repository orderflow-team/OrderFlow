import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Ledger } from '../../database/entities/ledger.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Business } from '../../database/entities/business.entity';
import { BillingController } from './billing.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Order, OrderItem, Payment, Ledger, Customer, Business]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [BillingController],
  providers: [InvoicesService, PaymentsService, PdfService],
  exports: [InvoicesService, PaymentsService],
})
export class BillingModule {}
