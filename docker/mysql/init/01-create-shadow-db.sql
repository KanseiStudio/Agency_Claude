-- Init script eseguito automaticamente da MySQL alla prima inizializzazione
-- del data directory (solo se vuoto). Vive in /docker-entrypoint-initdb.d/
-- ed è triggherato dall'entrypoint dell'immagine ufficiale mysql.
--
-- Crea il database "shadow" che Prisma usa durante `migrate dev` per
-- validare le migrazioni in un workspace temporaneo prima di applicarle
-- al DB principale (`kansei_agency`).
--
-- Concede all'utente applicativo i privilegi minimi necessari per
-- lavorare nello shadow DB (CREATE/DROP table) senza dargli CREATE
-- DATABASE globale: la mantiene una "least-privilege account" anche
-- per i flussi di migrazione di Prisma.

CREATE DATABASE IF NOT EXISTS kansei_shadow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON kansei_shadow.* TO 'kansei'@'%';

FLUSH PRIVILEGES;
