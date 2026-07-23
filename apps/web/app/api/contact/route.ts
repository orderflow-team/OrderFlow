import { NextResponse } from 'next/server';
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

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? sanitize(body.name).slice(0, 200) : '';
  const email = typeof body.email === 'string' ? sanitize(body.email).slice(0, 200) : '';
  const businessCategory = typeof body.businessCategory === 'string' ? body.businessCategory : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';

  if (!name || !email || !message || !businessCategory) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  }
  const categoryLabel = BUSINESS_CATEGORIES[businessCategory];
  if (!categoryLabel) {
    return NextResponse.json({ error: 'Please select a valid business category' }, { status: 400 });
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;
  const toEmail = process.env.CONTACT_TO_EMAIL || fromEmail;

  if (!host || !port || !user || !pass || !toEmail) {
    console.error('Contact form: SMTP is not configured');
    return NextResponse.json({ error: 'Email service is not configured' }, { status: 500 });
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
      subject: `New OrderFlow contact form message — ${categoryLabel}`,
      text: `Name: ${name}\nEmail: ${email}\nBusiness category: ${categoryLabel}\n\n${message}`,
      html: `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Business category:</strong> ${escapeHtml(categoryLabel)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>
      `,
    });

    return NextResponse.json({ message: 'Message sent successfully' });
  } catch (error: any) {
    console.error('Contact form email error:', error);
    return NextResponse.json({ error: 'Failed to send message. Please try again later.' }, { status: 500 });
  }
}
