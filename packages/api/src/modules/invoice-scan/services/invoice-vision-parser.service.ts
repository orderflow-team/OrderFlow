import { Injectable, BadRequestException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

export interface ParsedInvoiceLine {
  productName: string;
  quantity: number;
  schemeQuantity: number | null;
  /** The distributor's billed per-unit rate (net of any discount) — the real cost basis, always <= mrp. */
  unitPrice: number | null;
  /** Printed maximum retail price — the ceiling sale price, always >= unitPrice. */
  mrp: number | null;
  batchNumber: string | null;
  expiryMonthYear: string | null;
}

/**
 * Vision extraction for Scan-to-Inventory. Uses Gemini's multimodal input
 * (image/PDF as inlineData) as the vision backend for now — the extraction
 * contract (prompt + JSON shape) is written provider-agnostically so this can
 * be swapped for an OpenAI-compatible Qwen2.5-VL endpoint later without
 * touching callers.
 */
@Injectable()
export class InvoiceVisionParserService {
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey && apiKey !== 'test-key') {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('GEMINI_API_KEY is not configured or is set to test-key. Invoice scanning will be unavailable.');
    }
  }

  async parseInvoiceFile(filePath: string, mimeType: string): Promise<ParsedInvoiceLine[]> {
    if (!this.genAI) {
      throw new BadRequestException('Generative AI is not configured on the server. Please check the environment variables.');
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const data = fs.readFileSync(filePath).toString('base64');

    const prompt = `
      You are a data-entry assistant for a pharmacy. You will be shown a photo or PDF of a
      wholesale distributor invoice. Extract every product line item into structured JSON.

      Rules:
      - Ignore handwritten checkmarks, ticks, or other markings — they are not data.
      - Skip lines that are not products: section headers (e.g. "STORE ROOM 1"), totals,
        taxes, addresses, and any other non-product text.
      - Distributor invoices often write a "billed + scheme" quantity like "3+.15" or "10+1" —
        the first number is the billed (paid) quantity, the number after "+" is a free/scheme
        quantity. Split these into separate quantity and schemeQuantity fields. If there is no
        "+", schemeQuantity is null.
      - Standardize every expiry date to "MM/YYYY" format regardless of how it's written on the
        invoice (e.g. "03/26", "3-2026", "Mar 2026" all become "03/2026"). If no expiry is
        legible, use null.
      - If batch/lot number is not legible or absent, use null.
      - Each line usually has TWO separate price columns — extract them separately, never merge them:
        - "M.R.P." (maximum retail price): the printed ceiling sale price. This is always the
          HIGHER of the two prices.
        - "RATE" (sometimes "N.RATE" or "NET RATE"): the distributor's actual billed per-unit
          price, net of any trade discount. This is always the LOWER of the two prices.
        Put the M.R.P. column into "mrp" and the RATE column into "unitPrice". If only one price
        is printed on the line, put it in "unitPrice" and leave "mrp" null. If either is not
        legible or absent, use null for that field.

      Return ONLY a JSON array (no other text, no markdown fences) in this exact shape:
      [
        {
          "productName": "string, exactly as printed on the invoice",
          "quantity": number,
          "schemeQuantity": number | null,
          "unitPrice": number | null,
          "mrp": number | null,
          "batchNumber": string | null,
          "expiryMonthYear": "MM/YYYY" | null
        }
      ]
    `;

    let text: string;
    try {
      const result = await model.generateContent([
        { inlineData: { mimeType, data } },
        { text: prompt },
      ]);
      text = result.response.text();
    } catch (error) {
      throw new BadRequestException(`Vision extraction failed: ${error.message}`);
    }

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new BadRequestException('Could not extract any line items from this invoice.');
    }

    let parsed: any[];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new BadRequestException('Invoice extraction returned malformed data.');
    }

    return parsed
      .filter((row) => row && typeof row.productName === 'string' && row.productName.trim().length > 0)
      .map((row) => ({
        productName: row.productName.trim(),
        quantity: Number(row.quantity) || 0,
        schemeQuantity: row.schemeQuantity != null && !isNaN(Number(row.schemeQuantity)) ? Number(row.schemeQuantity) : null,
        unitPrice: row.unitPrice != null && !isNaN(Number(row.unitPrice)) ? Number(row.unitPrice) : null,
        mrp: row.mrp != null && !isNaN(Number(row.mrp)) ? Number(row.mrp) : null,
        batchNumber: typeof row.batchNumber === 'string' && row.batchNumber.trim().length > 0 ? row.batchNumber.trim() : null,
        expiryMonthYear: typeof row.expiryMonthYear === 'string' && /^\d{2}\/\d{4}$/.test(row.expiryMonthYear.trim())
          ? row.expiryMonthYear.trim()
          : null,
      }));
  }
}
