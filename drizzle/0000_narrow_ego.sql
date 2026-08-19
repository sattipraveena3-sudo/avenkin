CREATE TABLE `care_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`scheduled_for` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` text,
	`completed_by` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `care_items_family_schedule_idx` ON `care_items` (`family_id`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `care_items_status_idx` ON `care_items` (`status`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`owner_name` text NOT NULL,
	`parent_name` text NOT NULL,
	`parent_location` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`alert_window_minutes` integer DEFAULT 120 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `families_owner_email_unique` ON `families` (`owner_email`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`access_token` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_access_token_unique` ON `members` (`access_token`);--> statement-breakpoint
CREATE INDEX `members_family_idx` ON `members` (`family_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`care_item_id` integer,
	`channel` text DEFAULT 'email' NOT NULL,
	`recipient` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`care_item_id`) REFERENCES `care_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `timeline_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`care_item_id` integer,
	`kind` text NOT NULL,
	`actor` text NOT NULL,
	`message` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`care_item_id`) REFERENCES `care_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `timeline_family_created_idx` ON `timeline_entries` (`family_id`,`created_at`);