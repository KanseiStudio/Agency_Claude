/*
  Warnings:

  - A unique constraint covering the columns `[stripe_session_id]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_payment_intent_id]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `payments` ADD COLUMN `stripe_payment_intent_id` VARCHAR(191) NULL,
    ADD COLUMN `stripe_session_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `payments_stripe_session_id_key` ON `payments`(`stripe_session_id`);

-- CreateIndex
CREATE UNIQUE INDEX `payments_stripe_payment_intent_id_key` ON `payments`(`stripe_payment_intent_id`);
