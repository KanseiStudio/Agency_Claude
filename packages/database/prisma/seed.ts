/**
 * Seed iniziale del database.
 *
 * Popola il DB con dati minimi di sviluppo:
 *   - utente admin (Michele)
 *   - listino prezzi LLM (Anthropic, OpenAI, Google) corrente
 *   - policy di approvazione: tutte manuali (V1)
 *   - alcuni servizi di esempio nel catalogo
 *
 * Esecuzione:
 *   pnpm --filter @kansei/database prisma:seed
 */

import { PrismaClient, ApprovalCheckpoint } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Hashing password locale al seed.
// La stessa logica vive in @kansei/auth ma duplicarla qui evita una
// dipendenza circolare auth → database e mantiene il seed autonomo.
async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

async function main() {
  console.log('🌱 Seed avviato...');

  // ---------------------------------------------------------------------
  // Utente admin (Michele)
  // Password di sviluppo configurabile via env DEV_ADMIN_PASSWORD.
  // Se non valorizzata, usa il default sotto. CAMBIA IN PRODUZIONE.
  // ---------------------------------------------------------------------
  const devAdminPassword = process.env.DEV_ADMIN_PASSWORD ?? 'kansei-dev-2026!';
  const adminPasswordHash = await hashPassword(devAdminPassword);

  const admin = await prisma.user.upsert({
    where: { email: 'facecchia@kansei-studio.art' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'facecchia@kansei-studio.art',
      role: 'admin',
      locale: 'it',
      passwordHash: adminPasswordHash,
    },
  });
  console.log(`  ✓ Admin user: ${admin.email} (password: ${devAdminPassword})`);

  // ---------------------------------------------------------------------
  // Pricing models (snapshot maggio 2026)
  // ---------------------------------------------------------------------
  const validFrom = new Date('2026-05-01T00:00:00Z');

  const pricing = [
    // Anthropic
    { provider: 'anthropic', model: 'claude-opus-4-6', input: 15.0, output: 75.0, cached: 1.5 },
    { provider: 'anthropic', model: 'claude-sonnet-4-6', input: 3.0, output: 15.0, cached: 0.3 },
    { provider: 'anthropic', model: 'claude-haiku-4-5', input: 1.0, output: 5.0, cached: 0.1 },
    // OpenAI
    { provider: 'openai', model: 'gpt-4o', input: 2.5, output: 10.0, cached: 1.25 },
    { provider: 'openai', model: 'gpt-4o-mini', input: 0.15, output: 0.6, cached: 0.075 },
    // Google
    { provider: 'google', model: 'gemini-2.5-flash-image', input: 0.3, output: 2.5, cached: null },
  ];

  for (const p of pricing) {
    await prisma.pricingModel.upsert({
      where: {
        provider_model_validFrom: {
          provider: p.provider,
          model: p.model,
          validFrom,
        },
      },
      update: {},
      create: {
        provider: p.provider,
        model: p.model,
        inputPricePer1k: p.input / 1000, // i prezzi qui sopra sono per 1M token; salviamo per 1K token
        outputPricePer1k: p.output / 1000,
        cachedPricePer1k: p.cached !== null ? p.cached / 1000 : null,
        currency: 'USD',
        validFrom,
      },
    });
  }
  console.log(`  ✓ Pricing models: ${pricing.length} entries`);

  // ---------------------------------------------------------------------
  // Approval policies — V1: tutte manuali
  // ---------------------------------------------------------------------
  const checkpoints: ApprovalCheckpoint[] = [
    'brief_iniziale',
    'concept_creativo',
    'testi_finali',
    'materiali_finali',
    'preventivo',
    'extra_revision',
    'cost_overrun_yellow',
    'cost_overrun_red',
  ];

  for (const checkpoint of checkpoints) {
    await prisma.approvalPolicy.upsert({
      where: { checkpointCode: checkpoint },
      update: {},
      create: {
        checkpointCode: checkpoint,
        automatic: false,
        description: `Checkpoint ${checkpoint} — V1: approvazione manuale Michele`,
      },
    });
  }
  console.log(`  ✓ Approval policies: ${checkpoints.length} entries (tutte manuali)`);

  // ---------------------------------------------------------------------
  // Service catalog — placeholder iniziali
  // Verranno sostituiti dal listino reale che Michele consegnerà.
  // ---------------------------------------------------------------------
  const services = [
    {
      codice: 'LOGO_BASIC',
      descrizione: 'Logo design — concept singolo + 2 revisioni',
      min: 30000, // 300 EUR in cents
      max: 50000,
      agente: 'art-design',
    },
    {
      codice: 'IMAGE_PACK_3',
      descrizione: 'Pacchetto 3 immagini AI brandizzate',
      min: 9000,
      max: 15000,
      agente: 'art-design',
    },
    {
      codice: 'VIDEO_REEL_15',
      descrizione: 'Reel social 15 secondi (storyboard + generazione)',
      min: 25000,
      max: 40000,
      agente: 'video-audio',
    },
    {
      codice: 'SOCIAL_PLAN_MONTH',
      descrizione: 'Piano editoriale social mensile (16 post)',
      min: 80000,
      max: 120000,
      agente: 'publishing-performance',
    },
  ];

  for (const s of services) {
    await prisma.serviceCatalog.upsert({
      where: { codice: s.codice },
      update: {},
      create: {
        codice: s.codice,
        descrizione: s.descrizione,
        prezzoBaseMinCents: s.min,
        prezzoBaseMaxCents: s.max,
        agenteResponsabile: s.agente,
        attivo: true,
      },
    });
  }
  console.log(`  ✓ Service catalog: ${services.length} placeholder`);

  console.log('🌱 Seed completato.');
}

main()
  .catch(async (e) => {
    console.error('❌ Seed fallito:', e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
