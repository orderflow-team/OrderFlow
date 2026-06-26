import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, subject, text, html, smtp, secret } = body;

    // VERY important: Verify the secret so no one can use Vercel as an open spam relay!
    if (secret !== 'vrc_proxy_8f92a1_super_secure_internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!smtp || !smtp.host || !smtp.port || !smtp.user || !smtp.pass) {
      return NextResponse.json({ error: 'Missing SMTP credentials' }, { status: 400 });
    }

    // Initialize Nodemailer with the passed credentials
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port),
      secure: Number(smtp.port) === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    // Send the email
    await transporter.sendMail({
      from: smtp.from || smtp.user,
      to: email,
      subject: subject,
      text: text,
      html: html,
    });

    return NextResponse.json({ message: 'Email sent successfully via Vercel Proxy' });
  } catch (error: any) {
    console.error('Vercel Email Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
  }
}
