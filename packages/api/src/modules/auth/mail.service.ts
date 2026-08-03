import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MailService proxies email sending to a small dedicated Vercel function (apps/mailer).
 * This bypasses Render's permanent hard firewall on SMTP ports (465, 587).
 * Vercel's network allows outbound SMTP, so that's where the actual nodemailer send happens.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    if (!this.configService.get<string>('EMAIL_PROXY_URL') || !this.configService.get<string>('EMAIL_PROXY_SECRET')) {
      this.logger.warn('EMAIL_PROXY_URL/EMAIL_PROXY_SECRET not configured; emails will be logged instead of sent.');
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
    const proxyUrl = this.configService.get<string>('EMAIL_PROXY_URL');
    const proxySecret = this.configService.get<string>('EMAIL_PROXY_SECRET');

    if (proxyUrl && proxySecret) {
      try {
        const payload = { email, subject, text, html, secret: proxySecret };

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
