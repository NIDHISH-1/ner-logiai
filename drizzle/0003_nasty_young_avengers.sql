CREATE TABLE `weatherSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roadSegment` varchar(80) NOT NULL,
	`rainfallIntensity` decimal(6,2),
	`temperatureC` decimal(6,2),
	`floodWarning` boolean NOT NULL DEFAULT false,
	`landslideWarning` boolean NOT NULL DEFAULT false,
	`weatherSource` varchar(80) NOT NULL DEFAULT 'SIMULATED WEATHER DATA',
	`weatherStatus` varchar(24) NOT NULL,
	`weatherTimestamp` timestamp,
	`predictionTimestamp` timestamp NOT NULL,
	`predictionProbability` int,
	`predictionConfidence` int,
	`predictionRiskLevel` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weatherSnapshots_id` PRIMARY KEY(`id`)
);
