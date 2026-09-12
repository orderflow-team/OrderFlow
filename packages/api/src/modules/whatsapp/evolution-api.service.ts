import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

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

  private get apiKey(): string {
    return process.env.EVOLUTION_API_KEY || 'OrderFlowWhatsAppSecret2026!';
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

  /** Creates a new WhatsApp instance in Evolution API for a business. */
  async createInstance(instanceName: string) {
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || 'https://obix360.com/api/whatsapp/webhook';
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

  private get headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
    };
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

  /** Checks connection state (open, connected, connecting, close) with fallback to fetchInstances. */
  async fetchConnectionState(instanceName: string) {
    for (const url of this.candidateUrls) {
      try {
        const res = await axios.get(`${url}/instance/connectionState/${instanceName}`, this.axiosConfig);
        this.workingUrl = url;
        const state = res.data?.instance?.state || res.data?.state;
        if (state && state !== 'close') {
          return state;
        }
      } catch (err: any) {
        // Try next url
      }
    }

    // Fallback: check fetchInstances list for ownerJid or connectionStatus
    try {
      const instances = await this.fetchInstances();
      const inst = instances.find((i: any) => i.name === instanceName || i.token === instanceName);
      if (inst) {
        if (inst.connectionStatus === 'open' || inst.ownerJid) {
          return 'open';
        }
        return inst.connectionStatus || 'close';
      }
    } catch {}

    return 'close';
  }

  /** Ensures webhook endpoint is set for an instance. */
  async setWebhook(instanceName: string) {
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || 'https://obix360.com/api/whatsapp/webhook';
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
        break;
      } catch (err: any) {
        // Best-effort setting
      }
    }
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

