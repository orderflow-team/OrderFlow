import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MailService proxies email sending through the web app's internal API route,
 * which holds the actual SMTP credentials and sends via Nodemailer.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const proxyUrl = this.configService.get<string>('INTERNAL_EMAIL_PROXY_URL');
    if (!proxyUrl) {
      this.logger.warn('INTERNAL_EMAIL_PROXY_URL not configured; emails will be logged instead of sent.');
    }
  }

  /** Returns true if the OTP was actually emailed, false if it was only logged (no proxy / send failure). */
  async sendOtpEmail(email: string, code: string): Promise<boolean> {
    return this.sendEmail(
      email,
      'Your Login OTP Code',
      `Your OTP code is: ${code}. It is valid for 10 minutes.`,
      `<p>Your OTP code is: <strong>${code}</strong></p><p>It is valid for 10 minutes.</p>`,
      code,
    );
  }

  /** Returns true if the reset code was actually emailed, false if it was only logged (no proxy / send failure). */
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
    const proxyUrl = this.configService.get<string>('INTERNAL_EMAIL_PROXY_URL');
    const proxySecret = this.configService.get<string>('INTERNAL_EMAIL_PROXY_SECRET');

    if (proxyUrl && proxySecret) {
      try {
        const payload = {
          email,
          subject,
          text,
          html,
          secret: proxySecret,
        };

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Email proxy returned ${response.status}: ${errorText}`);
        }

        this.logger.log(`Email securely proxied and sent to ${email}`);
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
