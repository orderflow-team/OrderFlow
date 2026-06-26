import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MailService proxies email sending to the Vercel frontend.
 * This bypasses Render's permanent hard firewall on SMTP ports (465, 587).
 * Vercel's Edge network allows port 465, so Vercel safely establishes the Nodemailer TCP socket.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || 'noreply@example.com';
    const host = this.configService.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP credentials not fully provided; emails will be logged instead of sent.');
    }
  }

  /** Returns true if the OTP was actually emailed, false if it was only logged (no SMTP / send failure). */
  async sendOtpEmail(email: string, code: string): Promise<boolean> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    if (host && port && user && pass) {
      try {
        const payload = {
          email,
          subject: 'Your Login OTP Code',
          text: `Your OTP code is: ${code}. It is valid for 10 minutes.`,
          html: `<p>Your OTP code is: <strong>${code}</strong></p><p>It is valid for 10 minutes.</p>`,
          secret: 'vrc_proxy_8f92a1_super_secure_internal',
          smtp: {
            host,
            port,
            user,
            pass,
            from: this.fromEmail,
          },
        };

        // If local, uses localhost. If on Render, uses the real Vercel URL
        const webUrl = this.configService.get<string>('WEB_URL') || 'https://orderflow-web-iota.vercel.app';
        const proxyUrl = `${webUrl}/api/internal/send-email`;

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Vercel Proxy returned ${response.status}: ${errorText}`);
        }

        this.logger.log(`OTP email securely proxied to Vercel and sent to ${email}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send OTP email to ${email} via proxy`, (error as Error).stack);
        this.logger.warn(`[DEV FALLBACK] OTP for ${email}: ${code}`);
        return false;
      }
    } else {
      this.logger.warn(`[DEV] OTP for ${email}: ${code} (no email provider configured — logged instead of sent)`);
      return false;
    }
  }
}
