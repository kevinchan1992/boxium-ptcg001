-- Add upgradeReminderSentAt to gradingSubmissions for deduplicating overdue reminders
ALTER TABLE `gradingSubmissions` ADD COLUMN `upgradeReminderSentAt` timestamp;
