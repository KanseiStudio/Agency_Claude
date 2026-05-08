// Entry point principale del pacchetto @kansei/shared
// Esporta tutti i moduli condivisi del monorepo.
//
// Convenzione import: niente estensioni `.js` nei path relativi.
// TypeScript con `moduleResolution: "Bundler"` (vedi tsconfig.base.json)
// risolve direttamente i file `.ts` senza bisogno di estensione.

export * from './types/index';
export * from './agents/index';
