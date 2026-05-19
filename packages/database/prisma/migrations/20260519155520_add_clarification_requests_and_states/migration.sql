-- AlterTable
ALTER TABLE `email_messages` MODIFY `kind` ENUM('quote_sent', 'quote_reminder', 'production_started', 'deliverables_ready', 'revision_completed', 'invoice_issued', 'payment_confirmed', 'payment_reminder', 'project_completed', 'brief_clarification_needed', 'brief_clarification_responded', 'custom') NOT NULL;

-- AlterTable
ALTER TABLE `projects` MODIFY `stato` ENUM('bozza', 'in_attesa_approvazione_admin', 'in_analisi', 'attesa_chiarimenti', 'preventivo_inviato', 'preventivo_accettato', 'in_produzione', 'in_revisione', 'sospeso_costi', 'chiuso', 'annullato') NOT NULL DEFAULT 'bozza';

-- CreateTable
CREATE TABLE `clarification_requests` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `brief_id` VARCHAR(191) NOT NULL,
    `questions` JSON NOT NULL,
    `responses` JSON NULL,
    `status` ENUM('pending', 'responded', 'cancelled') NOT NULL DEFAULT 'pending',
    `run_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `responded_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `clarification_requests_project_id_idx`(`project_id`),
    INDEX `clarification_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `clarification_requests` ADD CONSTRAINT `clarification_requests_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clarification_requests` ADD CONSTRAINT `clarification_requests_brief_id_fkey` FOREIGN KEY (`brief_id`) REFERENCES `briefs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
