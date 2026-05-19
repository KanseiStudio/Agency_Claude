// =========================================================================
// MAILER SERVICE (SMTP via nodemailer) — copia identica di apps/admin/src/lib/mailer.ts
// =========================================================================
//
// Duplicato qui perché il client app deve poter inviare email autonomamente
// (Stripe webhook, approveAndProceedAction). In V2 questo dovrebbe diventare
// un package @kansei/mailer condiviso per evitare drift. Per V1: tenere
// allineato manualmente se cambi qualcosa qui o nell'altro file.
//
// =========================================================================

import nodemailer, { type Transporter } from 'nodemailer';

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return _transporter;
}

export function isMockEmails(): boolean {
  if (process.env.MOCK_EMAILS === 'true') return true;
  if (!process.env.SMTP_HOST) return true;
  return false;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: true;
  messageId: string;
  mocked: boolean;
}

export interface SendEmailError {
  ok: false;
  error: string;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult | SendEmailError> {
  const fromAddr = process.env.MAIL_FROM_ADDRESS ?? 'no-reply@kansei-studio.art';
  const fromName = process.env.MAIL_FROM_NAME ?? 'Kansei-Studio Agency';
  const from = input.from ?? `"${fromName}" <${fromAddr}>`;

  if (isMockEmails()) {
    console.log(`[mailer:MOCK] To: ${input.to} | Subject: ${input.subject}`);
    console.log(`[mailer:MOCK] Body (text, first 200 char): ${input.text.slice(0, 200)}`);
    return {
      ok: true,
      messageId: `mock-${Date.now()}@kansei-studio.art`,
      mocked: true,
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false, error: 'SMTP non configurato (SMTP_HOST mancante).' };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    return { ok: true, messageId: info.messageId, mocked: false };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
