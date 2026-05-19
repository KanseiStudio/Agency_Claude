-- CreateTable
CREATE TABLE `email_messages` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `kind` ENUM('quote_sent', 'quote_reminder', 'production_started', 'deliverables_ready', 'revision_completed', 'invoice_issued', 'payment_confirmed', 'payment_reminder', 'project_completed', 'custom') NOT NULL,
    `to_address` VARCHAR(191) NOT NULL,
    `from_address` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body_html` LONGTEXT NOT NULL,
    `body_text` LONGTEXT NOT NULL,
    `status` ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued',
    `smtp_message_id` VARCHAR(191) NULL,
    `error_message` TEXT NULL,
    `run_id` VARCHAR(191) NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_messages_project_id_idx`(`project_id`),
    INDEX `email_messages_kind_created_at_idx`(`kind`, `created_at`),
    INDEX `email_messages_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_messages` ADD CONSTRAINT `email_messages_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
