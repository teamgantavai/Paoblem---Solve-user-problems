type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Paoblem <noreply@paoblem.com>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed: ${body}`);
  }

  return response.json();
}

export function getAppUrl(requestOrigin?: string | null) {
  return process.env.NEXT_PUBLIC_APP_URL || requestOrigin || 'http://localhost:3000';
}

