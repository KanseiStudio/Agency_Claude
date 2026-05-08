-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NULL,
    `role` ENUM('admin', 'client') NOT NULL DEFAULT 'client',
    `locale` ENUM('it', 'en') NOT NULL DEFAULT 'it',
    `client_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` VARCHAR(191) NOT NULL,
    `ragione_sociale` VARCHAR(191) NOT NULL,
    `p_iva` VARCHAR(191) NULL,
    `email_fatturazione` VARCHAR(191) NOT NULL,
    `indirizzo` TEXT NULL,
    `locale_preferito` ENUM('it', 'en') NOT NULL DEFAULT 'it',
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_p_iva_key`(`p_iva`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `codice_progetto` VARCHAR(191) NOT NULL,
    `titolo` VARCHAR(191) NOT NULL,
    `project_type` ENUM('one_shot', 'recurring_cycle') NOT NULL DEFAULT 'one_shot',
    `parent_subscription_id` VARCHAR(191) NULL,
    `stato` ENUM('bozza', 'in_attesa_approvazione_admin', 'in_analisi', 'preventivo_inviato', 'preventivo_accettato', 'in_produzione', 'in_revisione', 'sospeso_costi', 'chiuso', 'annullato') NOT NULL DEFAULT 'bozza',
    `language` ENUM('it', 'en') NOT NULL DEFAULT 'it',
    `costo_stimato_cents` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `closed_at` DATETIME(3) NULL,

    UNIQUE INDEX `projects_codice_progetto_key`(`codice_progetto`),
    INDEX `projects_client_id_idx`(`client_id`),
    INDEX `projects_stato_idx`(`stato`),
    INDEX `projects_project_type_idx`(`project_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `briefs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `descrizione` TEXT NOT NULL,
    `obiettivi_json` JSON NULL,
    `deliverable_richiesti_json` JSON NULL,
    `deadline` DATETIME(3) NULL,
    `budget_indicativo_cents` INTEGER NULL,
    `files_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `briefs_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_files` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('reference', 'working', 'deliverable') NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `dimensione` BIGINT NULL,
    `uploaded_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_files_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` VARCHAR(191) NOT NULL,
    `codice` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descrizione` TEXT NULL,
    `deliverable_per_ciclo_json` JSON NOT NULL,
    `prezzo_mensile_cents` INTEGER NOT NULL,
    `billing_cycle` ENUM('monthly', 'quarterly', 'yearly') NOT NULL DEFAULT 'monthly',
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscription_plans_codice_key`(`codice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `stripe_subscription_id` VARCHAR(191) NULL,
    `status` ENUM('active', 'paused', 'canceled', 'trialing', 'past_due') NOT NULL DEFAULT 'active',
    `started_at` DATETIME(3) NOT NULL,
    `ended_at` DATETIME(3) NULL,
    `next_billing_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscriptions_stripe_subscription_id_key`(`stripe_subscription_id`),
    INDEX `subscriptions_client_id_idx`(`client_id`),
    INDEX `subscriptions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `cycle_project_id` VARCHAR(191) NULL,
    `cycle_start` DATETIME(3) NOT NULL,
    `cycle_end` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `subscription_deliveries_cycle_project_id_key`(`cycle_project_id`),
    INDEX `subscription_deliveries_subscription_id_idx`(`subscription_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotes` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `prezzo_min_cents` INTEGER NOT NULL,
    `prezzo_max_cents` INTEGER NOT NULL,
    `gap_pct` DECIMAL(5, 2) NOT NULL,
    `breakdown_json` JSON NULL,
    `valid_until` DATETIME(3) NULL,
    `status` ENUM('draft', 'inviato', 'accettato', 'rifiutato', 'scaduto') NOT NULL DEFAULT 'draft',
    `pdf_storage_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quotes_project_id_idx`(`project_id`),
    INDEX `quotes_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_items` (
    `id` VARCHAR(191) NOT NULL,
    `quote_id` VARCHAR(191) NOT NULL,
    `agente` VARCHAR(191) NULL,
    `voce` VARCHAR(191) NOT NULL,
    `quantita` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `prezzo_unitario_cents` INTEGER NOT NULL,
    `prezzo_totale_cents` INTEGER NOT NULL,
    `opzionale` BOOLEAN NOT NULL DEFAULT false,
    `ordine` INTEGER NOT NULL DEFAULT 0,

    INDEX `quote_items_quote_id_idx`(`quote_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_runs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `quote_id` VARCHAR(191) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `stato` ENUM('in_corso', 'completata', 'fallita', 'sospesa') NOT NULL DEFAULT 'in_corso',
    `note` TEXT NULL,

    INDEX `production_runs_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revision_rounds` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `numero` INTEGER NOT NULL,
    `tipo` ENUM('incluso', 'extra_a_pagamento') NOT NULL,
    `prezzo_cents` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('richiesta', 'in_lavorazione', 'completata', 'rifiutata') NOT NULL DEFAULT 'richiesta',
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `revision_rounds_project_id_idx`(`project_id`),
    UNIQUE INDEX `revision_rounds_project_id_numero_key`(`project_id`, `numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revision_requests` (
    `id` VARCHAR(191) NOT NULL,
    `round_id` VARCHAR(191) NOT NULL,
    `deliverable_id` VARCHAR(191) NULL,
    `descrizione_modifica` TEXT NOT NULL,
    `asset_riferimento` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `revision_requests_round_id_idx`(`round_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_outputs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `agente` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NULL,
    `payload_json` JSON NOT NULL,
    `status` ENUM('pending', 'success', 'failed', 'needs_human_review') NOT NULL DEFAULT 'pending',
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `agent_outputs_project_id_agente_idx`(`project_id`, `agente`),
    INDEX `agent_outputs_run_id_idx`(`run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_logs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `agente` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NULL,
    `livello` ENUM('debug', 'info', 'warn', 'error') NOT NULL DEFAULT 'info',
    `messaggio` TEXT NOT NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `agent_logs_project_id_idx`(`project_id`),
    INDEX `agent_logs_run_id_idx`(`run_id`),
    INDEX `agent_logs_agente_created_at_idx`(`agente`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_runs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `agente` VARCHAR(191) NOT NULL,
    `workflow_id` VARCHAR(191) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,
    `status` ENUM('running', 'success', 'failed', 'timeout') NOT NULL DEFAULT 'running',
    `latency_ms` INTEGER NULL,

    INDEX `agent_runs_project_id_idx`(`project_id`),
    INDEX `agent_runs_agente_started_at_idx`(`agente`, `started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_strategy_outputs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `strategy_summary` TEXT NULL,
    `target_analysis` TEXT NULL,
    `positioning` TEXT NULL,
    `tone_of_voice` TEXT NULL,
    `campaign_angle` TEXT NULL,
    `recommended_channels` JSON NULL,
    `kpi` JSON NULL,
    `risks` JSON NULL,
    `missing_information` JSON NULL,
    `raw_payload` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_strategy_outputs_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_research_outputs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `competitors` JSON NULL,
    `trends` JSON NULL,
    `target_insights` JSON NULL,
    `white_spaces` JSON NULL,
    `risks` JSON NULL,
    `sources` JSON NULL,
    `raw_payload` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_research_outputs_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_creative_outputs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `concept_principale` TEXT NULL,
    `alternative_concepts` JSON NULL,
    `brief_copy` TEXT NULL,
    `brief_design` TEXT NULL,
    `brief_video` TEXT NULL,
    `brief_audio` TEXT NULL,
    `mood_keywords` JSON NULL,
    `must_haves` JSON NULL,
    `must_avoids` JSON NULL,
    `raw_payload` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_creative_outputs_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_finance_outputs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `prezzo_min_cents` INTEGER NOT NULL,
    `prezzo_max_cents` INTEGER NOT NULL,
    `gap_pct` DECIMAL(5, 2) NOT NULL,
    `breakdown` JSON NULL,
    `conditions` JSON NULL,
    `valid_until` DATETIME(3) NULL,
    `note` TEXT NULL,
    `raw_payload` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_finance_outputs_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_account_outputs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `messaggio_cliente` TEXT NULL,
    `motivazione_richiesta` TEXT NULL,
    `info_mancanti` JSON NULL,
    `domande_per_cliente` JSON NULL,
    `stato_richiesta` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `sentiment` VARCHAR(191) NULL,
    `suggested_next_step` VARCHAR(191) NULL,
    `raw_payload` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_account_outputs_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pricing_models` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `input_price_per_1k` DECIMAL(12, 6) NOT NULL,
    `output_price_per_1k` DECIMAL(12, 6) NOT NULL,
    `cached_price_per_1k` DECIMAL(12, 6) NULL,
    `unit_type` VARCHAR(191) NULL DEFAULT 'token',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `valid_from` DATETIME(3) NOT NULL,
    `valid_to` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pricing_models_provider_model_idx`(`provider`, `model`),
    UNIQUE INDEX `pricing_models_provider_model_valid_from_key`(`provider`, `model`, `valid_from`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `token_usage` (
    `id` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NULL,
    `project_id` VARCHAR(191) NULL,
    `agente` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `input_tokens` INTEGER NOT NULL DEFAULT 0,
    `output_tokens` INTEGER NOT NULL DEFAULT 0,
    `cached_tokens` INTEGER NOT NULL DEFAULT 0,
    `total_tokens` INTEGER NOT NULL DEFAULT 0,
    `cost_usd` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    `cost_eur` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `token_usage_project_id_idx`(`project_id`),
    INDEX `token_usage_agente_created_at_idx`(`agente`, `created_at`),
    INDEX `token_usage_provider_model_idx`(`provider`, `model`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_api_usage` (
    `id` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NULL,
    `project_id` VARCHAR(191) NULL,
    `agente` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(191) NULL,
    `units` DECIMAL(14, 4) NOT NULL,
    `unit_type` VARCHAR(191) NOT NULL,
    `cost_usd` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    `cost_eur` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `external_api_usage_project_id_idx`(`project_id`),
    INDEX `external_api_usage_agente_created_at_idx`(`agente`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cost_alerts` (
    `id` VARCHAR(191) NOT NULL,
    `scope` ENUM('agency_daily', 'agency_weekly', 'agency_monthly', 'project', 'agent_run') NOT NULL,
    `severity` ENUM('yellow', 'red', 'hard_stop') NOT NULL,
    `soglia_cents` INTEGER NOT NULL,
    `attuale_cents` INTEGER NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `agente` VARCHAR(191) NULL,
    `raised_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,
    `note` TEXT NULL,

    INDEX `cost_alerts_project_id_idx`(`project_id`),
    INDEX `cost_alerts_scope_severity_raised_at_idx`(`scope`, `severity`, `raised_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deliverables` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `titolo` VARCHAR(191) NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NULL,
    `agente_creatore` VARCHAR(191) NULL,
    `status` ENUM('bozza', 'qa_passed', 'approvato_cliente', 'consegnato') NOT NULL DEFAULT 'bozza',
    `language` ENUM('it', 'en') NOT NULL DEFAULT 'it',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `deliverables_project_id_idx`(`project_id`),
    INDEX `deliverables_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deliverable_versions` (
    `id` VARCHAR(191) NOT NULL,
    `deliverable_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `deliverable_versions_deliverable_id_version_key`(`deliverable_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `quote_id` VARCHAR(191) NULL,
    `numero` VARCHAR(191) NOT NULL,
    `importo_cents` INTEGER NOT NULL,
    `valuta` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    `status` ENUM('draft', 'emessa', 'pagata', 'scaduta', 'annullata') NOT NULL DEFAULT 'draft',
    `pdf_storage_key` VARCHAR(191) NULL,
    `issued_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_numero_key`(`numero`),
    INDEX `invoices_project_id_idx`(`project_id`),
    INDEX `invoices_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `importo_cents` INTEGER NOT NULL,
    `metodo` ENUM('stripe', 'paypal', 'bonifico') NOT NULL,
    `transaction_id` VARCHAR(191) NULL,
    `status` ENUM('pending', 'succeeded', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_transaction_id_key`(`transaction_id`),
    INDEX `payments_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approvals` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `checkpoint_code` ENUM('brief_iniziale', 'concept_creativo', 'testi_finali', 'materiali_finali', 'preventivo', 'extra_revision', 'cost_overrun_yellow', 'cost_overrun_red') NOT NULL,
    `payload_json` JSON NULL,
    `esito` ENUM('pending', 'approvato', 'rifiutato', 'modifiche_richieste') NOT NULL DEFAULT 'pending',
    `decided_by` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decided_at` DATETIME(3) NULL,

    INDEX `approvals_project_id_idx`(`project_id`),
    INDEX `approvals_checkpoint_code_esito_idx`(`checkpoint_code`, `esito`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_policies` (
    `id` VARCHAR(191) NOT NULL,
    `checkpoint_code` ENUM('brief_iniziale', 'concept_creativo', 'testi_finali', 'materiali_finali', 'preventivo', 'extra_revision', 'cost_overrun_yellow', 'cost_overrun_red') NOT NULL,
    `automatic` BOOLEAN NOT NULL DEFAULT false,
    `auto_rule_json` JSON NULL,
    `description` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `approval_policies_checkpoint_code_key`(`checkpoint_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_blocks` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `area` ENUM('social_campaign', 'press_campaign') NOT NULL,
    `motivo` TEXT NULL,
    `attivo_from` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `attivo_to` DATETIME(3) NULL,
    `importo_rimborsato_cents` INTEGER NULL,

    INDEX `client_blocks_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services_catalog` (
    `id` VARCHAR(191) NOT NULL,
    `codice` VARCHAR(191) NOT NULL,
    `descrizione` VARCHAR(191) NOT NULL,
    `prezzo_base_min_cents` INTEGER NOT NULL,
    `prezzo_base_max_cents` INTEGER NOT NULL,
    `agente_responsabile` VARCHAR(191) NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `services_catalog_codice_key`(`codice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `events_project_id_created_at_idx`(`project_id`, `created_at`),
    INDEX `events_tipo_created_at_idx`(`tipo`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_parent_subscription_id_fkey` FOREIGN KEY (`parent_subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `briefs` ADD CONSTRAINT `briefs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_files` ADD CONSTRAINT `project_files_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_deliveries` ADD CONSTRAINT `subscription_deliveries_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_deliveries` ADD CONSTRAINT `subscription_deliveries_cycle_project_id_fkey` FOREIGN KEY (`cycle_project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_items` ADD CONSTRAINT `quote_items_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_runs` ADD CONSTRAINT `production_runs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `revision_rounds` ADD CONSTRAINT `revision_rounds_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `revision_requests` ADD CONSTRAINT `revision_requests_round_id_fkey` FOREIGN KEY (`round_id`) REFERENCES `revision_rounds`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_outputs` ADD CONSTRAINT `agent_outputs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_logs` ADD CONSTRAINT `agent_logs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_runs` ADD CONSTRAINT `agent_runs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_strategy_outputs` ADD CONSTRAINT `project_strategy_outputs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_research_outputs` ADD CONSTRAINT `project_research_outputs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_creative_outputs` ADD CONSTRAINT `project_creative_outputs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_finance_outputs` ADD CONSTRAINT `project_finance_outputs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_account_outputs` ADD CONSTRAINT `project_account_outputs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `token_usage` ADD CONSTRAINT `token_usage_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `agent_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `token_usage` ADD CONSTRAINT `token_usage_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_api_usage` ADD CONSTRAINT `external_api_usage_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `agent_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_api_usage` ADD CONSTRAINT `external_api_usage_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cost_alerts` ADD CONSTRAINT `cost_alerts_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverables` ADD CONSTRAINT `deliverables_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverable_versions` ADD CONSTRAINT `deliverable_versions_deliverable_id_fkey` FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_decided_by_fkey` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_blocks` ADD CONSTRAINT `client_blocks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
