import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);

  private get apiUrl(): string {
    return (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
  }

  private get apiKey(): string {
    return process.env.EVOLUTION_API_KEY || 'OrderFlowWhatsAppSecret2026!';
  }

  private get axiosConfig() {
    return {
      headers: this.headers,
      timeout: 7000,
    };
  }

  /** Creates a new WhatsApp instance in Evolution API for a business. */
  async createInstance(instanceName: string) {
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || 'http://127.0.0.1:4000/api/whatsapp/webhook';
    try {
      const res = await axios.post(
        `${this.apiUrl}/instance/create`,
        {
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
        },
        this.axiosConfig,
      );
      return res.data;
    } catch (err: any) {
      this.logger.error(`Failed to create Evolution API instance ${instanceName}: ${err.message}`);
      throw err;
    }
  }

  /** Gets the base64 QR code or connection pairing status for the instance. */
  async fetchQrCode(instanceName: string) {
    try {
      const res = await axios.get(`${this.apiUrl}/instance/connect/${instanceName}`, this.axiosConfig);
      return res.data; // { code, base64, count }
    } catch (err: any) {
      this.logger.error(`Failed to fetch QR code for ${instanceName}: ${err.message}`);
      return null;
    }
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
    };
  }

  /** Fetches all active instances from Evolution API. */
  async fetchInstances() {
    try {
      const res = await axios.get(`${this.apiUrl}/instance/fetchInstances`, this.axiosConfig);
      return Array.isArray(res.data) ? res.data : [];
    } catch (err: any) {
      this.logger.error(`Failed to fetch instances: ${err.message}`);
      return [];
    }
  }

  /** Checks connection state (open, connected, connecting, close) with fallback to fetchInstances. */
  async fetchConnectionState(instanceName: string) {
    try {
      const res = await axios.get(`${this.apiUrl}/instance/connectionState/${instanceName}`, this.axiosConfig);
      const state = res.data?.instance?.state || res.data?.state;
      if (state && state !== 'close') {
        return state;
      }

      // Fallback: check fetchInstances list for ownerJid or connectionStatus
      const instances = await this.fetchInstances();
      const inst = instances.find((i: any) => i.name === instanceName || i.token === instanceName);
      if (inst) {
        if (inst.connectionStatus === 'open' || inst.ownerJid) {
          return 'open';
        }
        return inst.connectionStatus || 'close';
      }
      return state || 'close';
    } catch (err: any) {
      // Double fallback: try fetchInstances
      try {
        const instances = await this.fetchInstances();
        const inst = instances.find((i: any) => i.name === instanceName || i.token === instanceName);
        if (inst && (inst.connectionStatus === 'open' || inst.ownerJid)) {
          return 'open';
        }
      } catch {}
      return 'close';
    }
  }

  /** Ensures webhook endpoint is set for an instance. */
  async setWebhook(instanceName: string) {
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || 'http://127.0.0.1:4000/api/whatsapp/webhook';
    try {
      await axios.post(
        `${this.apiUrl}/webhook/set/${instanceName}`,
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
    } catch (err: any) {
      // Best-effort setting
    }
  }

  /** Sends an automated text message back to a customer's WhatsApp number. */
  async sendTextMessage(instanceName: string, number: string, text: string) {
    try {
      const formattedNumber = number.replace(/\D/g, '');
      const res = await axios.post(
        `${this.apiUrl}/message/sendText/${instanceName}`,
        {
          number: formattedNumber,
          text: text,
          textMessage: {
            text: text,
          },
          options: {
            delay: 1200,
            presence: 'composing',
          },
        },
        this.axiosConfig,
      );
      return res.data;
    } catch (err: any) {
      this.logger.error(`Failed to send WhatsApp message via ${instanceName} to ${number}: ${err.message}`);
      return null;
    }
  }

  /** Logs out and deletes an instance connection. */
  async logoutInstance(instanceName: string) {
    try {
      await axios.delete(`${this.apiUrl}/instance/logout/${instanceName}`, this.axiosConfig);
      await axios.delete(`${this.apiUrl}/instance/delete/${instanceName}`, this.axiosConfig);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to delete instance ${instanceName}: ${err.message}`);
      return false;
    }
  }
}

