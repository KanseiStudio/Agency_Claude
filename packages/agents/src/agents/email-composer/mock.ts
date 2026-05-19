// Mock dell'Email Composer.
// Template italiani per ogni kind. Sostituisce variabili {client_name},
// {project_title}, {amount_eur}, ecc. dal context parsato dal userMessage.

import type { EmailComposerOutput, EmailKind } from './schema';

export function buildMockEmailComposerResponse(userMessage: string): string {
  const kind = (matchLine(userMessage, /Tipo email:\s*(\w+)/) ?? 'custom') as EmailKind;
  const clientName = matchLine(userMessage, /Cliente:\s*(.+)/) ?? 'cliente';
  const project = matchLine(userMessage, /Progetto:\s*(.+?)\s*\(/) ?? 'progetto';
  const projectCode = matchLine(userMessage, /\(([\w-]+)\)\s*$/m) ?? '';
  const invoiceNumber = matchLine(userMessage, /Numero fattura:\s*(.+)/) ?? '';
  const amountLine = matchLine(userMessage, /Importo:\s*([\d.]+)\s+(\w+)/);
  const amountEur = amountLine ?? '';
  const revisionRound = matchLine(userMessage, /Round revisione:\s*(\d+)/);
  const deliverableCount = matchLine(userMessage, /Deliverable pubblicati:\s*(\d+)/);
  const daysWaiting = matchLine(userMessage, /Giorni di attesa:\s*(\d+)/);
  const portalUrl = matchLine(userMessage, /URL portale cliente:\s*(\S+)/) ?? 'https://kansei-studio.art';
  const customNotes = matchLine(userMessage, /Note specifiche:\s*([\s\S]+?)(?:\n\n|$)/);
  // Lista domande di chiarimento (una per riga, dopo "Domande chiarimento:")
  const questionsBlock = matchLine(
    userMessage,
    /Domande chiarimento:\s*\n([\s\S]+?)(?:\n\n|$)/,
  );
  const clarificationQuestions = questionsBlock
    ? questionsBlock
        .split('\n')
        .map((l) => l.replace(/^\s*[-*\d.)\s]+/, '').trim())
        .filter((s) => s.length > 5)
    : [];

  const template = TEMPLATES[kind] ?? TEMPLATES.custom;
  const out = template({
    clientName,
    project,
    projectCode,
    invoiceNumber,
    amountEur,
    revisionRound: revisionRound ?? undefined,
    deliverableCount: deliverableCount ?? undefined,
    daysWaiting: daysWaiting ?? undefined,
    portalUrl,
    customNotes: customNotes ?? undefined,
    clarificationQuestions: clarificationQuestions.length > 0 ? clarificationQuestions : undefined,
  });

  return JSON.stringify(out);
}

interface TemplateVars {
  clientName: string;
  project: string;
  projectCode: string;
  invoiceNumber: string;
  amountEur: string;
  revisionRound?: string;
  deliverableCount?: string;
  daysWaiting?: string;
  portalUrl: string;
  customNotes?: string;
  clarificationQuestions?: string[];
}

const SIGNATURE_TEXT = '— Lo staff di Kansei-Studio Agency';
const SIGNATURE_HTML = '<p>— Lo staff di Kansei-Studio Agency</p>';

function wrapHtml(paragraphs: string[]): string {
  return paragraphs.map((p) => `<p>${p}</p>`).join('');
}

const TEMPLATES: Record<EmailKind, (v: TemplateVars) => EmailComposerOutput> = {
  quote_sent: (v) => ({
    subject: `Il preventivo per "${v.project}" è pronto`,
    preheader: `Dai un'occhiata al portale e dicci come ti sembra.`,
    body_text: `Ciao ${v.clientName},

abbiamo preparato il preventivo per il progetto "${v.project}" (${v.projectCode}). Lo trovi sul portale cliente — puoi accettarlo, chiederci chiarimenti o suggerire modifiche.

Apri il portale: ${v.portalUrl}

Restiamo a disposizione per qualsiasi domanda.

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      `abbiamo preparato il preventivo per il progetto <strong>"${v.project}"</strong> (${v.projectCode}). Lo trovi sul portale cliente — puoi accettarlo, chiederci chiarimenti o suggerire modifiche.`,
      `<a href="${v.portalUrl}">Apri il portale</a>`,
      `Restiamo a disposizione per qualsiasi domanda.`,
    ]) + SIGNATURE_HTML,
  }),

  quote_reminder: (v) => ({
    subject: `Tutto ok con il preventivo per "${v.project}"?`,
    preheader: `Volevamo sapere se hai avuto modo di esaminarlo.`,
    body_text: `Ciao ${v.clientName},

ci siamo accorti che il preventivo per "${v.project}" è in attesa di valutazione${v.daysWaiting ? ` da ${v.daysWaiting} giorni` : ''}. Volevamo solo assicurarci che ti sia arrivato e chiederti se hai bisogno di qualche chiarimento prima di decidere.

Lo trovi sempre qui: ${v.portalUrl}

Senza fretta — fammi sapere quando hai un momento.

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      `ci siamo accorti che il preventivo per <strong>"${v.project}"</strong> è in attesa di valutazione${v.daysWaiting ? ` da ${v.daysWaiting} giorni` : ''}. Volevamo solo assicurarci che ti sia arrivato e chiederti se hai bisogno di qualche chiarimento prima di decidere.`,
      `<a href="${v.portalUrl}">Apri il preventivo</a>`,
      `Senza fretta — fammi sapere quando hai un momento.`,
    ]) + SIGNATURE_HTML,
  }),

  production_started: (v) => ({
    subject: `Abbiamo iniziato a lavorare su "${v.project}"`,
    preheader: `Ti aggiorniamo non appena avremo i primi materiali.`,
    body_text: `Ciao ${v.clientName},

abbiamo dato il via alla produzione del tuo progetto "${v.project}". Il team sta lavorando ai primi concept e materiali — ti aggiorneremo non appena saranno pronti per la tua revisione.

Nel frattempo, se vuoi seguire lo stato di avanzamento puoi farlo dal portale: ${v.portalUrl}

A presto!

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      `abbiamo dato il via alla produzione del tuo progetto <strong>"${v.project}"</strong>. Il team sta lavorando ai primi concept e materiali — ti aggiorneremo non appena saranno pronti per la tua revisione.`,
      `Nel frattempo, se vuoi seguire lo stato di avanzamento puoi farlo dal portale: <a href="${v.portalUrl}">${v.portalUrl}</a>`,
      `A presto!`,
    ]) + SIGNATURE_HTML,
  }),

  deliverables_ready: (v) => ({
    subject: `${v.deliverableCount ?? 'I primi'} deliverable di "${v.project}" sono pronti`,
    preheader: `Dai un'occhiata sul portale e dicci se vuoi modifiche.`,
    body_text: `Ciao ${v.clientName},

${v.deliverableCount ? `I ${v.deliverableCount} deliverable` : 'I primi deliverable'} del progetto "${v.project}" sono pronti per la tua revisione. Li trovi sul portale: puoi vederli in anteprima, chiedere modifiche se ti servono, oppure approvarli e procedere al pagamento.

Apri il portale: ${v.portalUrl}

Fammi sapere come ti sembrano!

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      `${v.deliverableCount ? `I <strong>${v.deliverableCount} deliverable</strong>` : 'I primi deliverable'} del progetto <strong>"${v.project}"</strong> sono pronti per la tua revisione. Li trovi sul portale: puoi vederli in anteprima, chiedere modifiche se ti servono, oppure approvarli e procedere al pagamento.`,
      `<a href="${v.portalUrl}">Apri il portale</a>`,
      `Fammi sapere come ti sembrano!`,
    ]) + SIGNATURE_HTML,
  }),

  revision_completed: (v) => ({
    subject: `Round revisione ${v.revisionRound ?? ''} chiuso · "${v.project}"`,
    preheader: `La nuova versione è online, dai un'occhiata.`,
    body_text: `Ciao ${v.clientName},

abbiamo processato le tue richieste di revisione${v.revisionRound ? ` (round ${v.revisionRound})` : ''} per il progetto "${v.project}". La nuova versione dei deliverable è online sul portale.

Apri il portale: ${v.portalUrl}

Dai un'occhiata e fammi sapere se serve un altro giro o se siamo pronti per chiudere.

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      `abbiamo processato le tue richieste di revisione${v.revisionRound ? ` (round <strong>${v.revisionRound}</strong>)` : ''} per il progetto <strong>"${v.project}"</strong>. La nuova versione dei deliverable è online sul portale.`,
      `<a href="${v.portalUrl}">Apri il portale</a>`,
      `Dai un'occhiata e fammi sapere se serve un altro giro o se siamo pronti per chiudere.`,
    ]) + SIGNATURE_HTML,
  }),

  invoice_issued: (v) => ({
    subject: `Fattura ${v.invoiceNumber} · ${v.project}`,
    preheader: `Trovi tutto sul portale per il pagamento.`,
    body_text: `Ciao ${v.clientName},

abbiamo emesso la fattura ${v.invoiceNumber}${v.amountEur ? ` di € ${v.amountEur}` : ''} per il progetto "${v.project}".

Puoi visualizzare la fattura e procedere al pagamento direttamente dal portale: ${v.portalUrl}

Una volta confermato il pagamento, tutti i file finali saranno scaricabili.

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      `abbiamo emesso la fattura <strong>${v.invoiceNumber}</strong>${v.amountEur ? ` di <strong>€ ${v.amountEur}</strong>` : ''} per il progetto <strong>"${v.project}"</strong>.`,
      `Puoi visualizzare la fattura e procedere al pagamento direttamente dal portale: <a href="${v.portalUrl}">${v.portalUrl}</a>`,
      `Una volta confermato il pagamento, tutti i file finali saranno scaricabili.`,
    ]) + SIGNATURE_HTML,
  }),

  payment_confirmed: (v) => ({
    subject: `Pagamento ricevuto · grazie!`,
    preheader: `I file finali sono ora scaricabili dal portale.`,
    body_text: `Ciao ${v.clientName},

abbiamo ricevuto il pagamento della fattura ${v.invoiceNumber} per il progetto "${v.project}". Grazie!

Tutti i file finali sono ora scaricabili dal portale cliente: ${v.portalUrl}

È stato un piacere lavorare con te su questo progetto.

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      `abbiamo ricevuto il pagamento della fattura <strong>${v.invoiceNumber}</strong> per il progetto <strong>"${v.project}"</strong>. Grazie!`,
      `Tutti i file finali sono ora scaricabili dal portale cliente: <a href="${v.portalUrl}">${v.portalUrl}</a>`,
      `È stato un piacere lavorare con te su questo progetto.`,
    ]) + SIGNATURE_HTML,
  }),

  payment_reminder: (v) => ({
    subject: `Promemoria fattura ${v.invoiceNumber}`,
    preheader: `Un piccolo reminder, niente di urgente.`,
    body_text: `Ciao ${v.clientName},

ci permettiamo un piccolo promemoria: la fattura ${v.invoiceNumber}${v.amountEur ? ` di € ${v.amountEur}` : ''} per il progetto "${v.project}" risulta ancora da pagare${v.daysWaiting ? ` (emessa ${v.daysWaiting} giorni fa)` : ''}.

Puoi completare il pagamento dal portale: ${v.portalUrl}

Se serve qualche chiarimento sulla fattura, scrivici pure.

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      `ci permettiamo un piccolo promemoria: la fattura <strong>${v.invoiceNumber}</strong>${v.amountEur ? ` di <strong>€ ${v.amountEur}</strong>` : ''} per il progetto <strong>"${v.project}"</strong> risulta ancora da pagare${v.daysWaiting ? ` (emessa ${v.daysWaiting} giorni fa)` : ''}.`,
      `<a href="${v.portalUrl}">Completa il pagamento dal portale</a>`,
      `Se serve qualche chiarimento sulla fattura, scrivici pure.`,
    ]) + SIGNATURE_HTML,
  }),

  project_completed: (v) => ({
    subject: `"${v.project}" è chiuso · grazie!`,
    preheader: `È stato un piacere collaborare.`,
    body_text: `Ciao ${v.clientName},

il progetto "${v.project}" è ufficialmente chiuso. Tutti i file sono nel portale e restano lì a tua disposizione.

È stato un piacere collaborare con te. Se in futuro hai altri progetti — o anche solo un'idea da raccontare — sappi che siamo sempre qui.

A risentirci presto!

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      `il progetto <strong>"${v.project}"</strong> è ufficialmente chiuso. Tutti i file sono nel portale e restano lì a tua disposizione.`,
      `È stato un piacere collaborare con te. Se in futuro hai altri progetti — o anche solo un'idea da raccontare — sappi che siamo sempre qui.`,
      `A risentirci presto!`,
    ]) + SIGNATURE_HTML,
  }),

  brief_clarification_needed: (v) => {
    const qs = v.clarificationQuestions ?? [];
    const qListText = qs.length > 0
      ? qs.map((q, i) => `${i + 1}. ${q}`).join('\n')
      : 'Trovi le domande sul portale.';
    const qListHtml = qs.length > 0
      ? `<ol>${qs.map((q) => `<li>${q}</li>`).join('')}</ol>`
      : '<p>Trovi le domande sul portale.</p>';
    return {
      subject: `Servono alcune info per partire con "${v.project}"`,
      preheader: `Bastano poche risposte per sbloccare il preventivo.`,
      body_text: `Ciao ${v.clientName},

per preparare al meglio il preventivo del progetto "${v.project}" ci servono ancora alcune informazioni che non abbiamo trovato nel brief.

${qListText}

Puoi rispondere comodamente dal portale cliente: ${v.portalUrl}

Appena riceviamo le risposte facciamo partire la lavorazione. Senza fretta, ma queste info ci aiuteranno a darti un preventivo più preciso.

${SIGNATURE_TEXT}`,
      body_html: wrapHtml([
        `Ciao <strong>${v.clientName}</strong>,`,
        `per preparare al meglio il preventivo del progetto <strong>"${v.project}"</strong> ci servono ancora alcune informazioni che non abbiamo trovato nel brief.`,
      ]) + qListHtml + wrapHtml([
        `Puoi rispondere comodamente dal <a href="${v.portalUrl}">portale cliente</a>.`,
        `Appena riceviamo le risposte facciamo partire la lavorazione. Senza fretta, ma queste info ci aiuteranno a darti un preventivo più preciso.`,
      ]) + SIGNATURE_HTML,
    };
  },

  brief_clarification_responded: (v) => ({
    subject: `Risposte ricevute · ${v.project}`,
    preheader: `Il cliente ha completato il brief, si può procedere.`,
    body_text: `Aggiornamento progetto "${v.project}" (${v.projectCode}).

${v.clientName} ha appena risposto alle domande di chiarimento sul brief. Trovi tutto nel pannello admin del progetto: ${v.portalUrl}

Ora puoi ri-eseguire il Direttore Operativo e procedere con il preventivo.

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Aggiornamento progetto <strong>"${v.project}"</strong> (${v.projectCode}).`,
      `<strong>${v.clientName}</strong> ha appena risposto alle domande di chiarimento sul brief. Trovi tutto nel <a href="${v.portalUrl}">pannello admin</a>.`,
      `Ora puoi ri-eseguire il Direttore Operativo e procedere con il preventivo.`,
    ]) + SIGNATURE_HTML,
  }),

  custom: (v) => ({
    subject: `Aggiornamento sul progetto "${v.project}"`,
    preheader: `Un breve aggiornamento dal team Kansei-Studio.`,
    body_text: `Ciao ${v.clientName},

${v.customNotes ?? 'volevamo aggiornarti sul tuo progetto.'}

Per qualsiasi domanda, restiamo a disposizione.

${SIGNATURE_TEXT}`,
    body_html: wrapHtml([
      `Ciao <strong>${v.clientName}</strong>,`,
      v.customNotes ?? 'volevamo aggiornarti sul tuo progetto.',
      `Per qualsiasi domanda, restiamo a disposizione.`,
    ]) + SIGNATURE_HTML,
  }),
};

function matchLine(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1]?.trim() ?? null;
}
