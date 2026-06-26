import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as dns from 'dns';

// Fix for Render/Docker IPv6 ENETUNREACH issues with Gmail
dns.setDefaultResultOrder('ipv4first');

/**
 * Nodemailer is configured to send OTP emails.
 * If SMTP credentials are missing, it falls back to logging the OTP.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    this.fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || 'noreply@example.com';

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: {
          user,
          pass,
        },
        connectionTimeout: 5000,
        socketTimeout: 5000,
        family: 4, // Force IPv4
      } as nodemailer.TransportOptions);
      this.logger.log(`Nodemailer initialized with SMTP host: ${host}`);
    } else {
      this.logger.warn('SMTP credentials not fully provided; emails will be logged instead of sent.');
    }
  }

  /** Returns true if the OTP was actually emailed, false if it was only logged (no SMTP / send failure). */
  async sendOtpEmail(email: string, code: string): Promise<boolean> {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to: email,
          subject: 'Your Login OTP Code',
          text: `Your OTP code is: ${code}. It is valid for 10 minutes.`,
          html: `<p>Your OTP code is: <strong>${code}</strong></p><p>It is valid for 10 minutes.</p>`,
        });
        this.logger.log(`OTP email sent to ${email}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send OTP email to ${email}`, (error as Error).stack);
        this.logger.warn(`[DEV FALLBACK] OTP for ${email}: ${code}`);
        return false;
      }
    } else {
      this.logger.warn(`[DEV] OTP for ${email}: ${code} (no email provider configured — logged instead of sent)`);
      return false;
    }
  }
}
