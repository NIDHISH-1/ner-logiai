CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(60) NOT NULL,
	`entityId` varchar(64),
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` varchar(32) NOT NULL,
	`type` varchar(80) NOT NULL,
	`severity` enum('LOW','MODERATE','HIGH','CRITICAL') NOT NULL DEFAULT 'MODERATE',
	`status` enum('UNVERIFIED','UNDER_REVIEW','VERIFIED','REJECTED') NOT NULL DEFAULT 'UNVERIFIED',
	`description` text NOT NULL,
	`latitude` decimal(9,6) NOT NULL,
	`longitude` decimal(9,6) NOT NULL,
	`roadAccessibility` enum('accessible','restricted','blocked','unknown') NOT NULL DEFAULT 'unknown',
	`reporterId` int,
	`photoUrl` text,
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`priority` enum('CRITICAL','HIGH','NORMAL','LOW') NOT NULL DEFAULT 'NORMAL',
	`origin` varchar(120) NOT NULL,
	`destination` varchar(120) NOT NULL,
	`status` enum('planned','in_transit','delayed','delivered') NOT NULL DEFAULT 'planned',
	`etaMinutes` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` varchar(32) NOT NULL,
	`shipmentId` varchar(32),
	`status` enum('on_route','at_risk','delayed','offline','idle') NOT NULL DEFAULT 'idle',
	`risk` enum('LOW','MODERATE','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
	`latitude` decimal(9,6) NOT NULL,
	`longitude` decimal(9,6) NOT NULL,
	`etaMinutes` int NOT NULL DEFAULT 0,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `operationalRole` enum('admin','field_officer','truck_driver','logistics_manager','emergency_team','viewer') DEFAULT 'viewer' NOT NULL;