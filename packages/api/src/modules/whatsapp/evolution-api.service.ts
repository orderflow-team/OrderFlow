import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/** Why the Evolution gateway can't be used right now. */
export type EvolutionFailureKind = 'key_missing' | 'key_rejected' | 'unreachable' | 'http_error';

export interface EvolutionFailure {
  kind: EvolutionFailureKind;
  status?: number;
  /** For server logs only. Never contains the API key. */
  detail: string;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);

  private workingUrl: string | null = null;

  private get candidateUrls(): string[] {
    const urls: string[] = [];
    if (this.workingUrl) {
      urls.push(this.workingUrl);
    }
    if (process.env.EVOLUTION_API_URL) {
      urls.push(process.env.EVOLUTION_API_URL.replace(/\/+$/, ''));
    }
    // Working production proxy & standard local ports
    urls.push('https://obix360.com/evolution');
    urls.push('http://127.0.0.1:9000');
    urls.push('http://localhost:9000');
    urls.push('http://127.0.0.1:8080');
    urls.push('http://localhost:8080');
    return Array.from(new Set(urls));
  }

  // No fallback: a key baked into the source is public to anyone with the
  // repo, and the gateway is reachable from the internet — whoever holds the
  // key controls every shop's connected WhatsApp number.
  private get apiKey(): string {
    const key = process.env.EVOLUTION_API_KEY;
    if (!key) {
      throw new Error('EVOLUTION_API_KEY is not set — WhatsApp gateway calls are disabled.');
    }
    return key;
  }

  /**
   * The URL Evolution POSTs events to, carrying WHATSAPP_WEBHOOK_SECRET as a
   * query token so WhatsappWebhookController can reject forged events.
   */
  private get webhookUrl(): string {
    const base = process.env.WHATSAPP_WEBHOOK_URL || 'https://obix360.com/api/whatsapp/webhook';
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!secret) return base;
    const url = new URL(base);
    url.searchParams.set('token', secret);
    return url.toString();
  }

  private get headers() {
    return {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private get axiosConfig() {
    return {
      headers: this.headers,
      timeout: 8000,
    };
  }

  public extractQr(data: any): { base64?: string; code?: string; pairingCode?: string; count?: number } | null {
    if (!data) return null;
    const base64 = data.base64 || data.qrcode?.base64 || data.qrcode?.qrcode;
    const code = data.code || data.pairingCode || data.qrcode?.code || data.qrcode?.pairingCode;
    const pairingCode = data.pairingCode || data.qrcode?.pairingCode;
    const count = data.count || data.qrcode?.count;

    if (base64 || code || pairingCode) {
      return { base64, code, pairingCode, count };
    }
    return null;
  }

  /**
   * Works out WHY the gateway can't be used. Every call below swallows its own
   * error and tries the next URL, so by the time a caller sees "no QR code" the
   * real cause (missing key, rejected key, gateway down) is gone. This is a
   * read-only probe, one GET per candidate URL run in parallel, so it stays well
   * inside the web client's 10s timeout. Returns null when the gateway accepted
   * our credentials.
   */
  async diagnose(): Promise<EvolutionFailure | null> {
    let headers: Record<string, string>;
    try {
      headers = this.headers;
    } catch {
      return { kind: 'key_missing', detail: 'EVOLUTION_API_KEY is not set' };
    }

    const results = await Promise.all(
      this.candidateUrls.map(async (url) => {
        try {
          await axios.get(`${url}/instance/fetchInstances`, { headers, timeout: 3000 });
          return { ok: true, url, status: undefined as number | undefined, code: undefined as string | undefined };
        } catch (err: any) {
          return { ok: false, url, status: err?.response?.status as number | undefined, code: err?.code as string | undefined };
        }
      }),
    );

    const accepted = results.find((r) => r.ok);
    if (accepted) {
      this.workingUrl = accepted.url;
      return null;
    }
    const rejected = results.find((r) => r.status === 401 || r.status === 403);
    if (rejected) {
      return {
        kind: 'key_rejected',
        status: rejected.status,
        detail: `gateway at ${hostOf(rejected.url)} rejected EVOLUTION_API_KEY (HTTP ${rejected.status})`,
      };
    }
    const failed = results.find((r) => r.status);
    if (failed) {
      return { kind: 'http_error', status: failed.status, detail: `gateway at ${hostOf(failed.url)} answered HTTP ${failed.status}` };
    }
    const codes = Array.from(new Set(results.map((r) => r.code).filter(Boolean))).join(', ') || 'no response';
    return { kind: 'unreachable', detail: `no gateway answered (${codes})` };
  }

  /** Creates a new WhatsApp instance in Evolution API for a business. */
  async createInstance(instanceName: string) {
    const webhookUrl = this.webhookUrl;
    const payload = {
      instanceName,
      token: instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: [
          'APPLICATION_STARTUP',
          'QRCODE_UPDATED',
          'MESSAGES_SET',
          'MESSAGES_UPSERT',
          'SEND_MESSAGE',
          'CONNECTION_UPDATE',
        ],
      },
    };

    let lastError: any = null;
    for (const url of this.candidateUrls) {
      try {
        const res = await axios.post(`${url}/instance/create`, payload, this.axiosConfig);
        this.workingUrl = url;
        return res.data;
      } catch (err: any) {
        lastError = err;
      }
    }
    this.logger.error(`Failed to create Evolution API instance ${instanceName}: ${lastError?.message}`);
    throw lastError;
  }

  /** Gets the base64 QR code or connection pairing status for the instance. */
  async fetchQrCode(instanceName: string) {
    for (const url of this.candidateUrls) {
      try {
        const res = await axios.get(`${url}/instance/connect/${instanceName}`, this.axiosConfig);
        this.workingUrl = url;
        const extracted = this.extractQr(res.data);
        if (extracted) return extracted;
        if (res.data) return res.data;
      } catch (err: any) {
        // Try next candidate url
      }
    }
    return null;
  }



  /** Fetches all active instances from Evolution API. */
  async fetchInstances() {
    for (const url of this.candidateUrls) {
      try {
        const res = await axios.get(`${url}/instance/fetchInstances`, this.axiosConfig);
        this.workingUrl = url;
        return Array.isArray(res.data) ? res.data : [];
      } catch (err: any) {
        // Try next candidate url
      }
    }
    return [];
  }

  /** Checks connection state (open, connected, connecting, close) accurately. */
  async fetchConnectionState(instanceName: string) {
    for (const url of this.candidateUrls) {
      try {
        const res = await axios.get(`${url}/instance/connectionState/${instanceName}`, this.axiosConfig);
        this.workingUrl = url;
        const state = res.data?.instance?.state || res.data?.state;
        if (state) {
          return state;
        }
      } catch (err: any) {
        // Try next url
      }
    }

    // Fallback: check fetchInstances list for explicit connectionStatus / state
    // (Never use ownerJid alone because ownerJid persists even after disconnect/logout)
    try {
      const instances = await this.fetchInstances();
      const inst = instances.find((i: any) => i.name === instanceName || i.token === instanceName);
      if (inst) {
        const status = inst.connectionStatus || inst.instance?.state || inst.state;
        if (status) {
          return status;
        }
      }
    } catch {}

    return 'close';
  }

  /** Ensures webhook endpoint is set for an instance. Returns whether any gateway accepted it. */
  async setWebhook(instanceName: string): Promise<boolean> {
    const webhookUrl = this.webhookUrl;
    for (const url of this.candidateUrls) {
      try {
        await axios.post(
          `${url}/webhook/set/${instanceName}`,
          {
            webhook: {
              enabled: true,
              url: webhookUrl,
              byEvents: false,
              base64: false,
              events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'QRCODE_UPDATED'],
            },
          },
          this.axiosConfig,
        );
        this.workingUrl = url;
        return true;
      } catch (err: any) {
        // Best-effort setting
      }
    }
    return false;
  }

  /** Sends an automated text message back to a customer's WhatsApp number. */
  async sendTextMessage(instanceName: string, number: string, text: string) {
    const formattedNumber = number.replace(/\D/g, '');
    const payload = {
      number: formattedNumber,
      text: text,
      textMessage: {
        text: text,
      },
      options: {
        delay: 1200,
        presence: 'composing',
      },
    };

    for (const url of this.candidateUrls) {
      try {
        const res = await axios.post(`${url}/message/sendText/${instanceName}`, payload, this.axiosConfig);
        this.workingUrl = url;
        return res.data;
      } catch (err: any) {
        // Try next url
      }
    }
    this.logger.error(`Failed to send WhatsApp message via ${instanceName} to ${number}`);
    return null;
  }

  /** Sends an invoice document (PDF) directly to a customer's WhatsApp number. */
  async sendMediaDocument(
    instanceName: string,
    number: string,
    base64Data: string,
    fileName: string,
    caption?: string,
  ) {
    const formattedNumber = number.replace(/\D/g, '');
    const cleanNumber = formattedNumber.length === 10 ? `91${formattedNumber}` : formattedNumber;
    const payload = {
      number: cleanNumber,
      mediatype: 'document',
      mimetype: 'application/pdf',
      caption: caption || `Invoice ${fileName}`,
      media: base64Data,
      fileName: fileName,
      options: {
        delay: 1200,
        presence: 'composing',
      },
    };

    for (const url of this.candidateUrls) {
      try {
        const res = await axios.post(`${url}/message/sendMedia/${instanceName}`, payload, this.axiosConfig);
        this.workingUrl = url;
        this.logger.log(`Sent WhatsApp PDF document ${fileName} via ${instanceName} to ${cleanNumber}`);
        return res.data;
      } catch (err: any) {
        // Try next url
      }
    }
    this.logger.error(`Failed to send WhatsApp PDF document via ${instanceName} to ${number}`);
    return null;
  }

  /** Logs out and deletes an instance connection. */
  async logoutInstance(instanceName: string) {
    for (const url of this.candidateUrls) {
      try {
        await axios.delete(`${url}/instance/logout/${instanceName}`, this.axiosConfig).catch(() => null);
        await axios.delete(`${url}/instance/delete/${instanceName}`, this.axiosConfig).catch(() => null);
        return true;
      } catch (err: any) {
        // Try next url
      }
    }
    return false;
  }
}

