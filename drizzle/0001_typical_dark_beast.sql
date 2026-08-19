ALTER TABLE `families` ADD `notification_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `families` SET `notification_email` = `owner_email` WHERE `notification_email` = '';--> statement-breakpoint
ALTER TABLE `families` ADD `email_alerts_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `error_message` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `sent_at` text;
