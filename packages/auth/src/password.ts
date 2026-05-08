// Helper per hashing e verifica password con bcrypt.
//
// Usiamo bcryptjs (pure JS) invece di bcrypt (native) per evitare
// problemi di compilazione cross-platform su Windows. La differenza di
// performance è irrilevante alle scale dell'agenzia.

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Crea l'hash di una password in chiaro.
 * Usato dal seed e dalle eventuali API di registrazione/cambio password.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Verifica una password in chiaro contro un hash salvato a DB.
 * Ritorna true se combaciano. Resistente a timing attacks grazie a bcrypt.
 */
export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
