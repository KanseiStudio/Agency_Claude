// =========================================================================
// NOTIFICATIONS HELPER (server-side)
// =========================================================================
//
// Funzione centrale `sendProjectEmail(projectId, kind, customNotes?)`:
//   1. Carica il progetto + cliente + invoice corrente
//   2. Esegue l'Email Composer Agent per generare subject + body
//   3. Crea record EmailMessage (queued)
//   4. Chiama mailer.sendEmail
//   5. Aggiorna EmailMessage con esito (sent/failed)
//   6. Crea evento "email.sent" / "email.failed"
//
// Usata da:
//   - `composeAndSendEmailAction` (invio manuale dal pannello admin)
//   - Auto-trigger nelle action admin (sendQuote, publishToClient, ecc.)
//
// Filosofia "fail-soft": un fallimento di composizione o SMTP NON throwa.
// Ritorna sempre un risultato discriminato. Il caller decide se loggare
// l'errore o ignorarlo (per gli auto-trigger, lo logghiamo ma andiamo
// avanti senza rollbacare l'azione principale).
//
// =========================================================================

import { prisma } from '@kansei/database';
import {
  runAgent,
  emailComposerAgent,
  type EmailKind,
  type EmailComposerOutput,
} from '@kansei/agents';
import { sendEmail } from './mailer';

export interface SendProjectEmailInput {
  projectId: string;
  kind: EmailKind;
  customNotes?: string;
  /**
   * Tono di comunicazione. Default "professionale".
   * Per i reminder ha senso "urgente" (gentile ma diretto).
   */
  tone?: 'professionale' | 'caloroso' | 'urgente' | 'informale';
  /**
   * Per kind=brief_clarification_needed: lista domande da iniettare
   * nel body dell'email.
   */
  clarificationQuestions?: string[];
}

export type SendProjectEmailResult =
  | { ok: true; emailMessageId: string; mocked: boolean }
  | { ok: false; error: string };

export async function sendProjectEmail(
  input: SendProjectEmailInput,
): Promise<SendProjectEmailResult> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { client: true },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };

  // Carica dati di contesto opzionali (invoice, revisioni, deliverable)
  const invoice = await prisma.invoice.findFirst({
    where: { projectId: input.projectId },
    orderBy: { createdAt: 'desc' },
  });
  const completedRounds = await prisma.revisionRound.count({
    where: { projectId: input.projectId, status: 'completata' },
  });
  const deliverableCount = await prisma.deliverable.count({
    where: { projectId: input.projectId },
  });
  const portalBase = process.env.APP_CLIENT_URL ?? 'http://localhost:3001';

  // Step 1 — Componi via agente
  let composed: EmailComposerOutput;
  let composerRunId: string | null = null;
  try {
    const runResult = await runAgent(
      emailComposerAgent,
      {
        kind: input.kind,
        context: {
          client_name: project.client.ragioneSociale,
          project_title: project.titolo,
          project_code: project.codiceProgetto,
          invoice_number: invoice?.numero,
          amount_cents: invoice?.importoCents,
          currency: invoice?.valuta ?? 'EUR',
          revision_round: completedRounds > 0 ? completedRounds : undefined,
          deliverable_count: deliverableCount > 0 ? deliverableCount : undefined,
          portal_url: `${portalBase}/projects/${input.projectId}`,
          custom_notes: input.customNotes,
          clarification_questions: input.clarificationQuestions,
        },
        language: project.language as 'it' | 'en',
        tone: input.tone ?? 'professionale',
      },
      { projectId: project.id },
    );
    composed = runResult.output as EmailComposerOutput;
    composerRunId = runResult.runId;
  } catch (e) {
    return { ok: false, error: `Email Composer fallito: ${(e as Error).message}` };
  }

  const toAddress = project.client.emailFatturazione;
  const fromAddress = process.env.MAIL_FROM_ADDRESS ?? 'agency@kansei-studio.art';

  // Step 2 — Record DB (queued)
  const emailMessage = await prisma.emailMessage.create({
    data: {
      projectId: input.projectId,
      kind: input.kind,
      toAddress,
      fromAddress,
      subject: composed.subject,
      bodyHtml: composed.body_html,
      bodyText: composed.body_text,
      status: 'queued',
      runId: composerRunId,
    },
  });

  // Step 3 — Invio
  const sendResult = await sendEmail({
    to: toAddress,
    subject: composed.subject,
    html: composed.body_html,
    text: composed.body_text,
  });

  // Step 4 — Update DB + evento
  if (sendResult.ok) {
    await prisma.emailMessage.update({
      where: { id: emailMessage.id },
      data: {
        status: 'sent',
        smtpMessageId: sendResult.messageId,
        sentAt: new Date(),
      },
    });
    await prisma.event.create({
      data: {
        projectId: input.projectId,
        tipo: 'email.sent',
        payload: { kind: input.kind, to: toAddress, mocked: sendResult.mocked },
      },
    });
    return { ok: true, emailMessageId: emailMessage.id, mocked: sendResult.mocked };
  } else {
    await prisma.emailMessage.update({
      where: { id: emailMessage.id },
      data: {
        status: 'failed',
        errorMessage: sendResult.error,
      },
    });
    await prisma.event.create({
      data: {
        projectId: input.projectId,
        tipo: 'email.failed',
        payload: { kind: input.kind, to: toAddress, error: sendResult.error },
      },
    });
    return { ok: false, error: sendResult.error };
  }
}

/**
 * Versione "safe" pensata per auto-trigger: NON throwa mai. Logga in console
 * eventuali errori ma non li propaga al chiamante. Da usare DOPO una action
 * principale è andata a buon fine (es. publish, invoice issue, ecc.).
 */
export async function safelyTriggerEmail(input: SendProjectEmailInput): Promise<void> {
  try {
    const r = await sendProjectEmail(input);
    if (!r.ok) {
      console.error(
        `[notifications] auto-trigger "${input.kind}" su progetto ${input.projectId} fallito:`,
        r.error,
      );
    }
  } catch (e) {
    console.error(
      `[notifications] auto-trigger "${input.kind}" su progetto ${input.projectId} ha throwato:`,
      (e as Error).message,
    );
  }
}
