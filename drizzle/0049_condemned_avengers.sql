CREATE INDEX `cardId_soldAt_source_grade_idx` ON `priceHistory` (`cardId`,`soldAt`,`source`,`grade`);--> statement-breakpoint
CREATE INDEX `soldAt_idx` ON `priceHistory` (`soldAt`);--> statement-breakpoint
CREATE INDEX `source_idx` ON `priceHistory` (`source`);