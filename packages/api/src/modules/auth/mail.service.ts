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
    return this.sendEmail(
      email,
      'Your Login OTP Code',
      `Your OTP code is: ${code}. It is valid for 10 minutes.`,
      `<p>Your OTP code is: <strong>${code}</strong></p><p>It is valid for 10 minutes.</p>`,
      code,
    );
  }

  /** Returns true if the reset code was actually emailed, false if it was only logged (no SMTP / send failure). */
  async sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
    return this.sendEmail(
      email,
      'Reset Your OrderFlow Password',
      `Your password reset code is: ${code}. It is valid for 10 minutes. If you didn't request this, you can ignore this email.`,
      `<p>Your password reset code is: <strong>${code}</strong></p><p>It is valid for 10 minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
      code,
    );
  }

  private async sendEmail(email: string, subject: string, text: string, html: string, logCode: string): Promise<boolean> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    if (host && port && user && pass) {
      try {
        const payload = {
          email,
          subject,
          text,
          html,
          secret: 'vrc_proxy_8f92a1_super_secure_internal',
          smtp: {
            host,
            port,
            user,
            pass,
            from: this.fromEmail,
          },
        };

        // The proxy URL deployed explicitly for email handling
        const proxyUrl = `https://web-chi-beige-80.vercel.app/api/internal/send-email`;

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Vercel Proxy returned ${response.status}: ${errorText}`);
        }

        this.logger.log(`Email securely proxied to Vercel and sent to ${email}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send email to ${email} via proxy`, (error as Error).stack);
        this.logger.warn(`[DEV FALLBACK] Code for ${email}: ${logCode}`);
        return false;
      }
    } else {
      this.logger.warn(`[DEV] Code for ${email}: ${logCode} (no email provider configured — logged instead of sent)`);
      return false;
    }
  }
}
