// Route handler che renderizza la fattura in HTML print-friendly.
// Il cliente apre la pagina nel browser e fa Ctrl+P → "Salva come PDF".
// In V2 sostituiremo con generazione PDF server-side (pdfkit/puppeteer).
//
// Auth: cliente loggato + ownership del progetto.
// Niente payment check qui: il cliente deve poter vedere la fattura per
// pagarla, anche se non l'ha ancora pagata.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';

const AGENZIA = {
  nome: 'Kansei-Studio Agency',
  indirizzo: 'Via Esempio 1, 00100 Roma (RM)',
  piva: 'IT01234567890',
  email: 'amministrazione@kansei-studio.art',
  iban: 'IT00 X000 0000 0000 0000 0000 000',
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          client: true,
        },
      },
      quote: {
        include: { items: { orderBy: { ordine: 'asc' } } },
      },
      payments: { where: { status: 'succeeded' }, take: 1 },
    },
  });

  if (!invoice) return new NextResponse('Not found', { status: 404 });
  if (invoice.project.clientId !== session.user.clientId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const html = renderInvoiceHtml(invoice);
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

type InvoiceWithRelations = Awaited<ReturnType<typeof loadInvoice>>;
async function loadInvoice() {
  return prisma.invoice.findUnique({
    where: { id: '' },
    include: {
      project: { include: { client: true } },
      quote: { include: { items: { orderBy: { ordine: 'asc' } } } },
      payments: { where: { status: 'succeeded' }, take: 1 },
    },
  });
}

function renderInvoiceHtml(inv: NonNullable<InvoiceWithRelations>): string {
  const isPaid = inv.payments.length > 0;
  const client = inv.project.client;
  const items = inv.quote?.items ?? [];
  const importoEur = inv.importoCents / 100;

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>Fattura ${escapeHtml(inv.numero)}</title>
<style>
  :root {
    --ink: #0d0d0d; --muted: #6b6b6b; --line: #d4d4d4; --accent: #1a5f5f;
  }
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--ink); background: #fff; max-width: 820px;
    margin: 24px auto; padding: 32px 40px;
  }
  header { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid var(--ink); padding-bottom: 16px; }
  header h1 { margin: 0; font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase; }
  header .meta { text-align: right; font-size: 12px; color: var(--muted); }
  header .meta strong { color: var(--ink); font-size: 14px; display: block; margin-bottom: 4px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
  .party h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); }
  .party p { margin: 2px 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px; }
  thead th { background: #f6f6f6; padding: 8px 10px; text-align: left;
    border-bottom: 1px solid var(--line); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
  tbody td.right { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
  .totals table { width: auto; min-width: 260px; }
  .totals .total { font-size: 16px; font-weight: 600; }
  .totals .total td { border-top: 2px solid var(--ink); padding-top: 10px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .badge.paid { background: #d8f3dc; color: #154e2c; }
  .badge.due { background: #fff3cd; color: #6f4d00; }
  .note { margin-top: 32px; font-size: 11px; color: var(--muted);
    border-top: 1px solid var(--line); padding-top: 16px; }
  .actions { margin: 24px 0; text-align: center; }
  .actions button { padding: 10px 20px; border: 0; border-radius: 8px;
    background: var(--accent); color: white; font-size: 14px;
    font-weight: 600; cursor: pointer; }
  @media print {
    body { margin: 0; padding: 20px; max-width: 100%; }
    .actions { display: none; }
  }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(AGENZIA.nome)}</h1>
      <p style="margin: 6px 0 0; font-size: 12px; color: var(--muted);">
        ${escapeHtml(AGENZIA.indirizzo)}<br />
        P.IVA ${escapeHtml(AGENZIA.piva)} · ${escapeHtml(AGENZIA.email)}
      </p>
    </div>
    <div class="meta">
      <strong>Fattura n. ${escapeHtml(inv.numero)}</strong>
      Emessa il ${inv.issuedAt?.toLocaleDateString('it-IT') ?? '—'}<br />
      ${isPaid
        ? `<span class="badge paid">Pagata il ${inv.paidAt?.toLocaleDateString('it-IT')}</span>`
        : `<span class="badge due">Da pagare</span>`}
    </div>
  </header>

  <div class="parties">
    <div class="party">
      <h3>Fornitore</h3>
      <p><strong>${escapeHtml(AGENZIA.nome)}</strong></p>
      <p>${escapeHtml(AGENZIA.indirizzo)}</p>
      <p>P.IVA ${escapeHtml(AGENZIA.piva)}</p>
      <p style="margin-top: 6px; font-size: 11px; color: var(--muted);">
        IBAN ${escapeHtml(AGENZIA.iban)}
      </p>
    </div>
    <div class="party">
      <h3>Cliente</h3>
      <p><strong>${escapeHtml(client.ragioneSociale)}</strong></p>
      ${client.indirizzo ? `<p>${escapeHtml(client.indirizzo)}</p>` : ''}
      ${client.pIva ? `<p>P.IVA ${escapeHtml(client.pIva)}</p>` : ''}
      <p style="margin-top: 6px; font-size: 11px; color: var(--muted);">
        ${escapeHtml(client.emailFatturazione)}
      </p>
    </div>
  </div>

  <div>
    <h3 style="margin: 0 0 8px; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted);">
      Progetto ${escapeHtml(inv.project.codiceProgetto)} — ${escapeHtml(inv.project.titolo)}
    </h3>
    ${items.length > 0
      ? `<table>
          <thead>
            <tr>
              <th>Voce</th>
              <th class="right" style="text-align: right;">Qta</th>
              <th class="right" style="text-align: right;">Unitario</th>
              <th class="right" style="text-align: right;">Totale</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it) => `
              <tr>
                <td>${escapeHtml(it.voce)}${it.opzionale ? ' <em>(opzionale)</em>' : ''}</td>
                <td class="right">${Number(it.quantita)}</td>
                <td class="right">€ ${(it.prezzoUnitarioCents / 100).toLocaleString('it-IT')}</td>
                <td class="right">€ ${(it.prezzoTotaleCents / 100).toLocaleString('it-IT')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`
      : `<p style="font-size: 13px;">Importo concordato in preventivo.</p>`}

    <div class="totals">
      <table>
        <tr>
          <td>Imponibile</td>
          <td class="right">€ ${importoEur.toLocaleString('it-IT')}</td>
        </tr>
        <tr>
          <td>IVA (22% inclusa nei prezzi)</td>
          <td class="right">—</td>
        </tr>
        <tr class="total">
          <td>Totale ${escapeHtml(inv.valuta)}</td>
          <td class="right">€ ${importoEur.toLocaleString('it-IT')}</td>
        </tr>
      </table>
    </div>
  </div>

  <div class="actions">
    <button onclick="window.print()">Stampa / Salva come PDF</button>
  </div>

  <div class="note">
    Documento generato automaticamente dal portale Kansei-Studio Agency.
    Per assistenza: ${escapeHtml(AGENZIA.email)}.
  </div>
</body>
</html>`;
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
