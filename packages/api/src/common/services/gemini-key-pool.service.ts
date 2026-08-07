import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

/**
 * Wraps one or more GEMINI_API_KEY* env vars so callers get automatic
 * fallback to the next key when one is rate-limited/quota-exhausted (429),
 * plus a couple of retries per key on Gemini's transient 503 "overloaded".
 * Add a second key via GEMINI_API_KEY_2 to roughly double the effective
 * free-tier quota without any caller-side changes.
 */
@Injectable()
export class GeminiKeyPoolService {
  private readonly clients: GoogleGenerativeAI[];

  constructor(private configService: ConfigService) {
    const keys = [
      this.configService.get<string>('GEMINI_API_KEY'),
      this.configService.get<string>('GEMINI_API_KEY_2'),
    ].filter((key): key is string => !!key && key !== 'test-key');
    this.clients = keys.map((key) => new GoogleGenerativeAI(key));
  }

  get isConfigured(): boolean {
    return this.clients.length > 0;
  }

  async generateContent(modelName: string, parts: (string | Part)[]): Promise<string> {
    if (this.clients.length === 0) {
      throw new Error('Generative AI is not configured on the server.');
    }

    let lastError: any;
    for (const client of this.clients) {
      const model = client.getGenerativeModel({ model: modelName });
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await model.generateContent(parts as any);
          return result.response.text();
        } catch (error: any) {
          lastError = error;
          const isRateLimited = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
          if (isRateLimited) break; // this key is spent for now — move on to the next one
          const isOverloaded = error.message?.includes('503') || error.message?.toLowerCase().includes('overloaded');
          if (!isOverloaded || attempt === 2) break; // not a transient error, or out of retries on this key
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    throw lastError;
  }
}
