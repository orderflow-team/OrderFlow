import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// Internal relay only — called server-to-server by packages/api (Render blocks
// outbound SMTP ports, Vercel's network doesn't), never from a browser. No CORS
// needed. Authenticated with a shared secret from env, not a literal in source.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const { email, subject, text, html, secret } = body;

    const expectedSecret = process.env.EMAIL_PROXY_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM_EMAIL || user;

    if (!host || !port || !user || !pass) {
      res.status(500).json({ error: 'Email service is not configured' });
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({ from, to: email, subject, text, html });

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Mailer send-email error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
