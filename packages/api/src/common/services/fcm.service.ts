import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/**
 * Wraps Firebase Cloud Messaging for the native Android app's push
 * notifications. Same "isConfigured, no-op if not" shape as
 * GeminiKeyPoolService — a server without FIREBASE_SERVICE_ACCOUNT set just
 * skips push entirely (in-app notifications still work via the DB), rather
 * than failing the request that triggered it.
 *
 * FIREBASE_SERVICE_ACCOUNT holds the *entire* service-account JSON (from
 * Firebase Console > Project Settings > Service Accounts > Generate new
 * private key) as a single-line string — the private_key field's embedded
 * "\n" line breaks must stay as the literal two-character escape, which is
 * how most .env loaders already store a JSON blob and exactly what
 * JSON.parse expects.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;

  constructor(private configService: ConfigService) {
    const raw = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!raw) return;

    try {
      const serviceAccount = JSON.parse(raw);
      this.app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (error: any) {
      this.logger.error(`Invalid FIREBASE_SERVICE_ACCOUNT — push notifications disabled: ${error.message}`);
    }
  }

  get isConfigured(): boolean {
    return this.app !== null;
  }

  /**
   * Sends the same title/body to every token. Returns the subset FCM reports
   * as permanently invalid (app uninstalled, token expired) so the caller can
   * prune them from device_tokens — left unpruned, a stale token fails the
   * same way on every future push forever.
   */
  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<string[]> {
    if (!this.app || tokens.length === 0) return [];

    let response: admin.messaging.BatchResponse;
    try {
      response = await admin.messaging(this.app).sendEachForMulticast({ tokens, notification: { title, body }, data });
    } catch (error: any) {
      this.logger.error(`FCM send failed: ${error.message}`);
      return [];
    }

    const invalidTokens: string[] = [];
    response.responses.forEach((result, i) => {
      if (result.success) return;
      const code = result.error?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        invalidTokens.push(tokens[i]);
      } else {
        this.logger.warn(`Push to a device failed: ${result.error?.message}`);
      }
    });
    return invalidTokens;
  }
}
