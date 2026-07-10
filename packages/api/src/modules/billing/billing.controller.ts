import { Controller, Get, Post, Param, Query, Body, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { PdfService } from './pdf.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('api/billing')
export class BillingController {
  constructor(
    private invoicesService: InvoicesService,
    private paymentsService: PaymentsService,
    private pdfService: PdfService,
  ) {}

  /** Unauthenticated — WhatsApp opens this link in its own client, not the user's session. Guarded by a short-lived signed token instead of JwtAuthGuard. */
  @Get('invoices/public/pdf')
  async publicPdf(@Query('token') token: string, @Res() res: Response) {
    const { invoiceId, businessId } = await this.pdfService.verifyShareToken(token);
    const filePath = await this.pdfService.getOrGeneratePdf(invoiceId, businessId);
    res.sendFile(filePath);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.ACCOUNTANT)
  @Post('invoices/from-order/:orderId')
  generateInvoice(@Param('orderId') orderId: string, @Query('businessId') businessId: string) {
    return this.invoicesService.generateFromOrder(orderId, businessId);
  }

  @UseGuards(JwtAuthGuard, BusinessScopeGuard)
  @Get('invoices')
  findAllInvoices(@Query('businessId') businessId: string, @Query('orderId') orderId?: string) {
    return this.invoicesService.findAll(businessId, orderId);
  }

  @UseGuards(JwtAuthGuard, BusinessScopeGuard)
  @Get('invoices/:id')
  findOneInvoice(@Param('id') id: string, @Query('businessId') businessId: string) {
    return this.invoicesService.findOne(id, businessId);
  }

  /** Downloads (generating on first request) the A4 PDF for an invoice. */
  @UseGuards(JwtAuthGuard, BusinessScopeGuard)
  @Get('invoices/:id/pdf')
  async downloadPdf(@Param('id') id: string, @Query('businessId') businessId: string, @Res() res: Response) {
    const filePath = await this.pdfService.getOrGeneratePdf(id, businessId);
    res.sendFile(filePath);
  }

  /** Narrow 58/80mm receipt HTML — frontend opens this in a new tab and calls window.print(). */
  @UseGuards(JwtAuthGuard, BusinessScopeGuard)
  @Get('invoices/:id/receipt')
  async thermalReceipt(@Param('id') id: string, @Query('businessId') businessId: string, @Res() res: Response) {
    const html = await this.pdfService.getThermalReceiptHtml(id, businessId);
    res.type('html').send(html);
  }

  /** Short-lived opaque link so the WhatsApp share button can pass a fetchable URL to wa.me. */
  @UseGuards(JwtAuthGuard, BusinessScopeGuard)
  @Get('invoices/:id/share-link')
  async shareLink(@Param('id') id: string, @Query('businessId') businessId: string) {
    const token = await this.pdfService.createShareToken(id, businessId);
    return { url: `/api/billing/invoices/public/pdf?token=${token}` };
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessScopeGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.ACCOUNTANT)
  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, BusinessScopeGuard)
  @Get('payments')
  findAllPayments(
    @Query('businessId') businessId: string,
    @Query('orderId') orderId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.paymentsService.findAll(businessId, orderId, customerId);
  }
}
