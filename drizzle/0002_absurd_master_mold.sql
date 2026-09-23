ALTER TABLE `incidents` ADD `reporterRole` varchar(40) DEFAULT 'field_officer' NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `isDemo` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shipments` ADD `isDemo` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `isDemo` boolean DEFAULT false NOT NULL;