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

  // FCM rejects sendEachForMulticast outright above this many tokens in one
  // call — fine for a single business's device count, but a platform-wide
  // broadcast needs to chunk.
  private static readonly FCM_BATCH_SIZE = 500;

  /**
   * Sends the same title/body to every token (batched under FCM's 500-token
   * per-call cap, transparent to callers). Returns the subset FCM reports as
   * permanently invalid (app uninstalled, token expired) so the caller can
   * prune them from device_tokens — left unpruned, a stale token fails the
   * same way on every future push forever.
   */
  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<string[]> {
    if (!this.app || tokens.length === 0) return [];

    const invalidTokens: string[] = [];
    for (let i = 0; i < tokens.length; i += FcmService.FCM_BATCH_SIZE) {
      const batch = tokens.slice(i, i + FcmService.FCM_BATCH_SIZE);

      let response: admin.messaging.BatchResponse;
      try {
        response = await admin.messaging(this.app).sendEachForMulticast({ tokens: batch, notification: { title, body }, data });
      } catch (error: any) {
        this.logger.error(`FCM send failed for a batch of ${batch.length}: ${error.message}`);
        continue;
      }

      response.responses.forEach((result, j) => {
        if (result.success) return;
        const code = result.error?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          invalidTokens.push(batch[j]);
        } else {
          this.logger.warn(`Push to a device failed: ${result.error?.message}`);
        }
      });
    }
    return invalidTokens;
  }
}
