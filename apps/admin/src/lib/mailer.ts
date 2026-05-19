// =========================================================================
// MAILER SERVICE (SMTP via nodemailer)
// =========================================================================
//
// Wrapper centrale per invio email transazionali.
//
// Modalità:
//   - MOCK (default): MOCK_EMAILS=true OR SMTP_HOST mancante
//     → sendEmail logga in console e ritorna successo simulato.
//     Utile in dev per non spammare la inbox vera del cliente.
//   - REAL: SMTP_HOST configurato + MOCK_EMAILS=false (o assente)
//     → connette al server SMTP e invia davvero.
//
// Env supportate:
//   - SMTP_HOST              (es. "mail.kansei-studio.art")
//   - SMTP_PORT              (es. "465" per SMTPS, "587" per STARTTLS)
//   - SMTP_SECURE            ("true" per SSL/TLS diretto, default true se porta=465)
//   - SMTP_USER              (es. "agency@kansei-studio.art")
//   - SMTP_PASSWORD          (la password)
//   - MAIL_FROM_ADDRESS      (mittente, es. "agency@kansei-studio.art")
//   - MAIL_FROM_NAME         (display name, es. "Kansei-Studio Agency")
//   - MOCK_EMAILS            ("true" → mock; default false se SMTP_HOST presente)
//
// =========================================================================

import nodemailer, { type Transporter } from 'nodemailer';

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  // SMTP_SECURE: true forza SSL/TLS diretto (richiesto per porta 465);
  // false attiva STARTTLS upgrade (porta 587). Auto-detect basato sulla porta
  // se la env non è specificata.
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

/**
 * True se siamo in mock mode (nessun invio reale).
 *   - MOCK_EMAILS=true OPPURE
 *   - SMTP_HOST mancante
 */
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
  /** Override mittente. Default: MAIL_FROM_ADDRESS / MAIL_FROM_NAME. */
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: true;
  /** Message-Id ritornato dal server SMTP (vuoto in mock mode). */
  messageId: string;
  mocked: boolean;
}

export interface SendEmailError {
  ok: false;
  error: string;
}

/**
 * Invia un'email. Ritorna oggetto unione discriminato per gestione errori
 * pulita (no throw — il caller decide come gestire fallimenti SMTP).
 */
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

/**
 * Verifica la connessione SMTP (utile per smoke test in dev).
 */
export async function verifySmtpConnection(): Promise<{ ok: boolean; message: string }> {
  if (isMockEmails()) {
    return { ok: true, message: 'Mock mode attivo (nessuna verifica SMTP reale).' };
  }
  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false, message: 'SMTP_HOST non configurato.' };
  }
  try {
    await transporter.verify();
    return { ok: true, message: `Connessione SMTP ok (${process.env.SMTP_HOST}).` };
  } catch (e) {
    return { ok: false, message: `Connessione SMTP fallita: ${(e as Error).message}` };
  }
}
