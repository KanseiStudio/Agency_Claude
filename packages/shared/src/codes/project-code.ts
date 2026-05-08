// Generatore di codici progetto leggibili.
// Formato: KSA-YYYY-NNNN (es. KSA-2026-0007)
//
// La generazione richiede una count sui progetti dell'anno corrente:
// l'unicità è garantita a DB (constraint @unique su codiceProgetto).
// In caso di race condition concorrente con stesso numero, l'insert
// fallisce e il chiamante può ritentare.

export function buildProjectCode(year: number, sequenceNumber: number): string {
  if (sequenceNumber < 1) {
    throw new Error('sequenceNumber deve essere >= 1');
  }
  if (sequenceNumber > 9999) {
    throw new Error('sequenceNumber > 9999: superata capacità annua. Estendere il padding.');
  }
  return `KSA-${year}-${String(sequenceNumber).padStart(4, '0')}`;
}
