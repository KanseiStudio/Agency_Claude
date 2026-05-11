// Mock response del Copy Agent. Parsea il userMessage per estrarre
// deliverable + titolo cliente e genera contenuti testuali plausibili.

import type { CopyAgentOutput, CopyDeliverable, CopyDeliverableType, CopyVariant } from './schema';

const DELIVERABLE_TO_COPY_TYPE: Record<string, CopyDeliverableType[]> = {
  social_plan: ['social_post', 'social_post', 'social_post'],
  newsletter: ['newsletter'],
  landing_page: ['landing_page'],
  press_release: ['press_release'],
  logo: ['claim'],
  image_pack: ['claim'],
  video_reel: ['claim'],
  altro: ['claim'],
};

export function buildMockCopyAgentResponse(userMessage: string): string {
  const dMatch = userMessage.match(/Deliverable richiesti:\s*(.+)/);
  const captured = dMatch?.[1];
  const deliverables = captured
    ? captured
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['altro'];

  const tMatch = userMessage.match(/Titolo:\s*(.+)/);
  const titolo = tMatch?.[1]?.trim() ?? 'il brand';

  const cMatch = userMessage.match(/Cliente:\s*(.+)/);
  const cliente = cMatch?.[1]?.trim() ?? 'il cliente';

  const outputs: CopyDeliverable[] = [];

  // Per ogni deliverable richiesto, mappa a tipi copy e genera
  for (const d of deliverables) {
    const copyTypes = DELIVERABLE_TO_COPY_TYPE[d] ?? ['claim'];
    for (let i = 0; i < copyTypes.length; i++) {
      const type = copyTypes[i]!;
      outputs.push(buildDeliverable(type, titolo, cliente, i));
    }
  }

  const out: CopyAgentOutput = {
    deliverables: outputs,
    global_notes:
      'Tutte le varianti sono prodotte in modalità mock: in produzione il Copy Agent reale costruirà testi su misura partendo dal contesto specifico del brief, dello storico cliente e dai riferimenti caricati.',
  };

  return JSON.stringify(out);
}

function buildDeliverable(
  type: CopyDeliverableType,
  titolo: string,
  cliente: string,
  index: number,
): CopyDeliverable {
  switch (type) {
    case 'social_post':
      return socialPostDeliverable(titolo, cliente, index);
    case 'newsletter':
      return newsletterDeliverable(titolo, cliente);
    case 'landing_page':
      return landingDeliverable(titolo, cliente);
    case 'press_release':
      return pressDeliverable(titolo, cliente);
    case 'claim':
      return claimDeliverable(titolo);
    case 'altro':
    default:
      return claimDeliverable(titolo);
  }
}

function makeVariant(
  label: 'A' | 'B' | 'C',
  body: string,
  options: Partial<Omit<CopyVariant, 'label' | 'body' | 'length_chars'>> = {},
): CopyVariant {
  return {
    label,
    body,
    length_chars: body.length,
    ...options,
  };
}

function socialPostDeliverable(titolo: string, _cliente: string, index: number): CopyDeliverable {
  const angoli = ['lancio', 'storia', 'community'];
  const angolo = angoli[index % angoli.length]!;
  return {
    type: 'social_post',
    title: `Post social ${index + 1} · angolo "${angolo}"`,
    variants: [
      makeVariant(
        'A',
        `Oggi abbiamo voglia di raccontarvi qualcosa di nuovo: ${titolo}. Non un semplice progetto, ma il modo in cui scegliamo di stare nel nostro mestiere.`,
        {
          headline: titolo,
          cta: 'Scopri di più nei prossimi giorni →',
          hashtags: ['#brand', '#design', '#italia', '#madeinitaly'],
        },
      ),
      makeVariant(
        'B',
        `${titolo}. Tre parole. Una direzione. Vi piacerà — o almeno, ci proviamo davvero.`,
        {
          headline: titolo,
          cta: 'Continua a seguirci',
          hashtags: ['#brand', '#nuovocapitolo'],
        },
      ),
    ],
    rationale: `Variante A più discorsiva (registro intimo, story-telling). Variante B sintetica (claim-driven, alto impatto per feed densi).`,
  };
}

function newsletterDeliverable(titolo: string, cliente: string): CopyDeliverable {
  return {
    type: 'newsletter',
    title: 'Newsletter di lancio',
    variants: [
      makeVariant(
        'A',
        `Buongiorno,\n\nVi scriviamo per condividere con voi una novità che curiamo da un po': ${titolo}. È il modo con cui ${cliente} prova oggi a rispondere alla domanda "come restiamo riconoscibili senza diventare prevedibili?".\n\nNelle prossime settimane vi mostreremo il dietro le quinte — niente comunicati, solo le cose vere. Se preferite leggerle in anteprima, rispondete a questa mail.\n\nA presto,\nIl team`,
        {
          headline: `${titolo} è qui`,
          cta: 'Rispondi per partecipare in anteprima',
        },
      ),
      makeVariant(
        'B',
        `Una sola novità, niente fronzoli: ${titolo}.\n\nLeggetela quando avete cinque minuti, non prima. È un pensiero lento, voluto. Vi diciamo cosa cambia, perché, e cosa NON cambia.\n\n→ Le tre cose che abbiamo deciso di tenere\n→ Le due che abbiamo lasciato andare\n→ Una scelta che ci ha fatto tribolare\n\nGrazie per il tempo.`,
        {
          headline: `Cosa cambia con ${titolo}`,
          cta: 'Continua a leggere',
        },
      ),
    ],
    rationale:
      'Variante A registro confidenziale e "umano", invita risposta. Variante B più strutturata, parla a un pubblico che vuole sostanza in poco tempo.',
  };
}

function landingDeliverable(titolo: string, cliente: string): CopyDeliverable {
  return {
    type: 'landing_page',
    title: 'Landing page hero + CTA',
    variants: [
      makeVariant(
        'A',
        `${titolo} non è un restyling. È il momento in cui ${cliente} decide cosa portarsi avanti.`,
        {
          headline: titolo,
          cta: 'Scopri il progetto',
        },
      ),
      makeVariant(
        'B',
        `Una nuova voce. Stesso mestiere. ${titolo} è il nostro modo di dirvi che siamo cambiati senza tradirvi.`,
        {
          headline: 'Una voce nuova, lo stesso mestiere',
          cta: 'Entra dentro',
        },
      ),
    ],
    rationale:
      'A più riflessiva e dichiarativa, B più di prossimità (parla al lettore esistente). Entrambe respingono il template "lancio aziendalese".',
  };
}

function pressDeliverable(titolo: string, cliente: string): CopyDeliverable {
  const lede = `${cliente} presenta ${titolo}, progetto di comunicazione che ridefinisce il dialogo con il proprio pubblico attraverso una nuova identità e un sistema visivo coerente sui canali digitali.`;
  return {
    type: 'press_release',
    title: 'Comunicato stampa',
    variants: [
      makeVariant(
        'A',
        `${lede}\n\nIl progetto, sviluppato con un approccio che mette al centro la coerenza tra messaggio e estetica, si articola in una serie di asset coordinati su social, sito e materiali editoriali.\n\n"Volevamo qualcosa che non smettesse di sembrare nostro fra dodici mesi", spiegano dal team di ${cliente}.\n\nPer maggiori informazioni e materiali stampa: press@${cliente.toLowerCase().replace(/\W/g, '')}.it.`,
        {
          headline: `${cliente} lancia ${titolo}`,
        },
      ),
    ],
    rationale:
      'Una sola variante perché il registro press è normato e poco discrezionale. In produzione reale aggiungeremo varianti se il cliente vuole tagli diversi (corporate, locale, settoriale).',
  };
}

function claimDeliverable(titolo: string): CopyDeliverable {
  return {
    type: 'claim',
    title: `Claim per ${titolo}`,
    variants: [
      makeVariant('A', `${titolo}. Lo stesso, ma meglio.`, {
        headline: `${titolo}. Lo stesso, ma meglio.`,
      }),
      makeVariant('B', `Da ${titolo} non vi aspettate niente di meno.`, {
        headline: `Da ${titolo} non vi aspettate niente di meno.`,
      }),
      makeVariant('C', `${titolo}: si vede dai dettagli.`, {
        headline: `${titolo}: si vede dai dettagli.`,
      }),
    ],
    rationale:
      'Tre approcci: A continuità ("lo stesso, ma meglio"), B aspettativa positiva, C dettaglio/qualità. Scegliere in base al posizionamento.',
  };
}
