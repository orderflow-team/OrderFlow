import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

const BUSINESS_CATEGORIES: Record<string, string> = {
  grocery: 'Grocery Store',
  restaurant: 'Restaurant',
  pharmacy: 'Pharmacy',
  wholesale: 'Wholesale',
  salesman: 'Salesman Order Collection',
  other: 'Other',
  others: 'Other',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitize(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Called cross-origin from both the web app and the Capacitor app shell,
// so (unlike the old same-origin Next.js route) this needs its own CORS
// headers rather than relying on the browser treating it as same-origin.
function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const name = typeof body.name === 'string' ? sanitize(body.name).slice(0, 200) : '';
  const email = typeof body.email === 'string' ? sanitize(body.email).slice(0, 200) : '';
  const businessCategory = typeof body.businessCategory === 'string' ? body.businessCategory : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';

  if (!name || !email || !message || !businessCategory) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address' });
    return;
  }
  const categoryLabel = BUSINESS_CATEGORIES[businessCategory];
  if (!categoryLabel) {
    res.status(400).json({ error: 'Please select a valid business category' });
    return;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;
  const toEmail = process.env.CONTACT_TO_EMAIL || fromEmail;

  if (!host || !port || !user || !pass || !toEmail) {
    console.error('Contact form: SMTP is not configured');
    res.status(500).json({ error: 'Email service is not configured' });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      replyTo: `${name} <${email}>`,
      subject: `New OBIX contact form message — ${categoryLabel}`,
      text: `Name: ${name}\nEmail: ${email}\nBusiness category: ${categoryLabel}\n\n${message}`,
      html: `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Business category:</strong> ${escapeHtml(categoryLabel)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>
      `,
    });

    res.status(200).json({ message: 'Message sent successfully' });
  } catch (error: any) {
    console.error('Contact form email error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
}
