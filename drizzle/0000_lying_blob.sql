CREATE TABLE `object_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `objects` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`is_confidential` integer DEFAULT false NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parameter_set_parameters` (
	`id` text PRIMARY KEY NOT NULL,
	`parameter_set_id` text NOT NULL,
	`parameter_id` text NOT NULL,
	`volgnr` integer DEFAULT 1 NOT NULL,
	`is_meetwaarde` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parameter_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parameter_values` (
	`id` text PRIMARY KEY NOT NULL,
	`parameter_id` text NOT NULL,
	`target_id` text NOT NULL,
	`target_type` text NOT NULL,
	`value` text NOT NULL,
	`is_confidential` integer DEFAULT false NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parameters` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`code` text NOT NULL,
	`data_type` text NOT NULL,
	`unit` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relation_values` (
	`id` text PRIMARY KEY NOT NULL,
	`relation_id` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`volgorde` integer DEFAULT 0,
	`is_confidential` integer DEFAULT false NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relations` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relevante_taxa` (
	`id` text PRIMARY KEY NOT NULL,
	`taxon_naam` text NOT NULL,
	`taxon_level` text,
	`col_identifier` text,
	`gbif_identifier` text,
	`nl_naam` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`symbol` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `value_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`updated_at` text NOT NULL
);
