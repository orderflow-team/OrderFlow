import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import nodemailer from 'nodemailer';

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, subject, text, html, secret } = body;

    const expectedSecret = process.env.INTERNAL_EMAIL_PROXY_SECRET;

    // VERY important: Verify the secret so no one can use this endpoint as an open spam relay!
    if (!expectedSecret || typeof secret !== 'string' || !safeCompare(secret, expectedSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM_EMAIL || user;

    if (!host || !port || !user || !pass) {
      return NextResponse.json({ error: 'SMTP is not configured' }, { status: 500 });
    }

    // Always send through our own configured SMTP account — never accept
    // caller-supplied SMTP credentials/host, which would turn this into an open relay.
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: subject,
      text: text,
      html: html,
    });

    return NextResponse.json({ message: 'Email sent successfully via internal proxy' });
  } catch (error: any) {
    console.error('Internal Email Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
  }
}
