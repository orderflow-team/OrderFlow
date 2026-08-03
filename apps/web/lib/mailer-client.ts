// apps/mailer is a separate Vercel deployment, kept alive purely because Render
// (where packages/api runs) blocks outbound SMTP ports and Vercel's network doesn't.
const MAILER_BASE_URL = process.env.NEXT_PUBLIC_MAILER_URL || 'http://localhost:3010';

export const CONTACT_URL = `${MAILER_BASE_URL}/api/contact`;
