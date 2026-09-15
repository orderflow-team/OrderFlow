import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * MailService supports:
 * 1. Direct SMTP via nodemailer (ideal for VPS / standalone servers)
 * 2. Vercel proxy via EMAIL_PROXY_URL (for platforms like Render that block SMTP ports)
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
      });
      this.logger.log(`Direct SMTP configured for host: ${host}:${port}`);
    } else if (
      !this.configService.get<string>('EMAIL_PROXY_URL') ||
      !this.configService.get<string>('EMAIL_PROXY_SECRET')
    ) {
      this.logger.warn('Neither direct SMTP nor EMAIL_PROXY_URL configured; emails will be logged instead of sent.');
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

  /** Returns true if the signup OTP was actually emailed, false if it was only logged (no SMTP / send failure). */
  async sendSignupOtpEmail(email: string, code: string): Promise<boolean> {
    return this.sendEmail(
      email,
      'Verify Your OrderFlow Account',
      `Welcome to OrderFlow! Your email verification code is: ${code}. It is valid for 10 minutes.`,
      `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">Welcome to OrderFlow</h2>
        <p style="color: #475569; font-size: 15px;">Please use the verification code below to complete your account registration:</p>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #ea580c;">${code}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code is valid for 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>`,
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
    // 1. Send via Direct SMTP if configured
    if (this.transporter) {
      try {
        const from =
          this.configService.get<string>('SMTP_FROM_EMAIL') ||
          this.configService.get<string>('SMTP_USER') ||
          'no-reply@orderflow.internal';

        await this.transporter.sendMail({
          from,
          to: email,
          subject,
          text,
          html,
        });

        this.logger.log(`Email successfully sent to ${email} via direct SMTP`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send email to ${email} via direct SMTP`, (error as Error).stack);
        this.logger.warn(`[DEV FALLBACK] Code for ${email}: ${logCode}`);
        return false;
      }
    }

    // 2. Send via Vercel proxy if configured
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
    }

    this.logger.warn(`[DEV] Code for ${email}: ${logCode} (no email provider configured — logged instead of sent)`);
    return false;
  }
}
