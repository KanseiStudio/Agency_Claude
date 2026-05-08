// Entry point principale del pacchetto @kansei/shared
// Esporta tutti i moduli condivisi del monorepo.

export * from './types/index';
export * from './agents/index';
export { buildProjectCode } from './codes/project-code';
export {
  briefSchema,
  DELIVERABLE_TYPES,
  type BriefInput,
  type BriefData,
  type DeliverableType,
} from './schemas/brief';
