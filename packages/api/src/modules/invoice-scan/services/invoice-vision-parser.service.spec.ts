import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InvoiceVisionParserService } from './invoice-vision-parser.service';
import { GeminiKeyPoolService } from '../../../common/services/gemini-key-pool.service';

describe('InvoiceVisionParserService', () => {
  let service: InvoiceVisionParserService;
  let geminiKeyPool: { isConfigured: boolean; generateContent: jest.Mock };

  beforeEach(async () => {
    geminiKeyPool = { isConfigured: true, generateContent: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [InvoiceVisionParserService, { provide: GeminiKeyPoolService, useValue: geminiKeyPool }],
    }).compile();

    service = module.get(InvoiceVisionParserService);
  });

  it('throws BadRequestException when Gemini is not configured', async () => {
    geminiKeyPool.isConfigured = false;

    await expect(service.parseInvoiceFile(Buffer.from('x'), 'image/png')).rejects.toThrow(BadRequestException);
  });

  it('parses a well-formed JSON array response into normalized lines', async () => {
    geminiKeyPool.generateContent.mockResolvedValue(
      JSON.stringify([
        { productName: '  Paracetamol 500  ', quantity: '10', schemeQuantity: '1', unitPrice: '5.5', mrp: '8', batchNumber: ' B100 ', expiryMonthYear: '03/2027' },
      ]),
    );

    const result = await service.parseInvoiceFile(Buffer.from('x'), 'image/png');

    expect(result).toEqual([
      { productName: 'Paracetamol 500', quantity: 10, schemeQuantity: 1, unitPrice: 5.5, mrp: 8, batchNumber: 'B100', expiryMonthYear: '03/2027' },
    ]);
  });

  it('extracts the JSON array even when the model wraps it in extra text/markdown fences', async () => {
    geminiKeyPool.generateContent.mockResolvedValue('Here is the data:\n```json\n[{"productName":"Item","quantity":1,"schemeQuantity":null,"unitPrice":null,"mrp":null,"batchNumber":null,"expiryMonthYear":null}]\n```');

    const result = await service.parseInvoiceFile(Buffer.from('x'), 'image/png');

    expect(result).toEqual([
      { productName: 'Item', quantity: 1, schemeQuantity: null, unitPrice: null, mrp: null, batchNumber: null, expiryMonthYear: null },
    ]);
  });

  it('drops rows with a missing or blank productName', async () => {
    geminiKeyPool.generateContent.mockResolvedValue(
      JSON.stringify([
        { productName: '', quantity: 1 },
        { productName: '   ', quantity: 1 },
        { quantity: 1 },
        { productName: 'Valid Item', quantity: 1 },
      ]),
    );

    const result = await service.parseInvoiceFile(Buffer.from('x'), 'image/png');

    expect(result).toHaveLength(1);
    expect(result[0].productName).toBe('Valid Item');
  });

  it('defaults quantity to 0 and coerces non-numeric optional fields to null', async () => {
    geminiKeyPool.generateContent.mockResolvedValue(
      JSON.stringify([{ productName: 'Item', quantity: 'not-a-number', schemeQuantity: 'nan', unitPrice: 'bad', mrp: 'bad', batchNumber: 123, expiryMonthYear: 'March 2026' }]),
    );

    const result = await service.parseInvoiceFile(Buffer.from('x'), 'image/png');

    expect(result[0]).toEqual({ productName: 'Item', quantity: 0, schemeQuantity: null, unitPrice: null, mrp: null, batchNumber: null, expiryMonthYear: null });
  });

  it('rejects an expiryMonthYear that does not match MM/YYYY', async () => {
    geminiKeyPool.generateContent.mockResolvedValue(
      JSON.stringify([{ productName: 'Item', quantity: 1, expiryMonthYear: '2026-03' }]),
    );

    const result = await service.parseInvoiceFile(Buffer.from('x'), 'image/png');

    expect(result[0].expiryMonthYear).toBeNull();
  });

  it('throws BadRequestException when the model call itself fails', async () => {
    geminiKeyPool.generateContent.mockRejectedValue(new Error('rate limited'));

    await expect(service.parseInvoiceFile(Buffer.from('x'), 'image/png')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when no JSON array is found in the response', async () => {
    geminiKeyPool.generateContent.mockResolvedValue('Sorry, I could not read this invoice.');

    await expect(service.parseInvoiceFile(Buffer.from('x'), 'image/png')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when the extracted text is not valid JSON', async () => {
    geminiKeyPool.generateContent.mockResolvedValue('[{"productName": "broken",]');

    await expect(service.parseInvoiceFile(Buffer.from('x'), 'image/png')).rejects.toThrow(BadRequestException);
  });
});
