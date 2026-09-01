// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Helper voor standaard ISO timestamps
const currentTimestamp = () => new Date().toISOString();

//
// 0. SYNC METADATA
//
export const syncMetadata = sqliteTable("sync_metadata", {
  id: text("id").primaryKey(), // Bijv. "main_sync"
  lastSyncedAt: text("last_synced_at").notNull(),
});

//
// 1. OBJECTEN
//
export const objects = sqliteTable("objects", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  isConfidential: integer("is_confidential", { mode: "boolean" })
    .notNull()
    .default(false),
  // Domein-historie
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to"),
  // Systeem / Sync-tracking
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"), // 🗑️ Soft-delete tracking for LWW sync
});

//
// 2. RELATIE TYPEN (Stamgegevens)
//
export const relations = sqliteTable("relations", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});

//
// 3. RELATIE WAARDEN (Koppeling tussen twee objecten)
//
export const relationValues = sqliteTable("relation_values", {
  id: text("id").primaryKey(),
  relationId: text("relation_id").notNull(),
  sourceId: text("source_id").notNull(),
  targetId: text("target_id").notNull(),
  volgorde: integer("volgorde").default(0),
  isConfidential: integer("is_confidential", { mode: "boolean" })
    .notNull()
    .default(false),
  // Domein-historie
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to"),
  // Systeem / Sync-tracking
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});

//
// 4. PARAMETERS (Definitie van attributen/eigenschappen - Stamgegevens)
//
export const parameters = sqliteTable("parameters", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  code: text("code").notNull(),
  dataType: text("data_type").notNull(),
  unit: text("unit"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});

//
// 5. PARAMETER WAARDEN (Metingen / Attribuut-waarden)
//
export const parameterValues = sqliteTable("parameter_values", {
  id: text("id").primaryKey(),
  parameterId: text("parameter_id").notNull(),
  targetId: text("target_id").notNull(), // Object OF RelationValue ID
  targetType: text("target_type").notNull(), // 'object' | 'relation_value'
  value: text("value").notNull(),
  isConfidential: integer("is_confidential", { mode: "boolean" })
    .notNull()
    .default(false),
  // Domein-historie (voor puntmetingen geldt: validFrom = validTo)
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to"),
  // Systeem / Sync-tracking
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});

//
// 6. CATALOGI / HULPTABELLEN
//
export const objectTypes = sqliteTable("object_types", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});

export const valueTypes = sqliteTable("value_types", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});

export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  symbol: text("symbol").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});

//
// 7. PARAMETER SETS
//
export const parameterSets = sqliteTable("parameter_sets", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});

export const parameterSetParameters = sqliteTable("parameter_set_parameters", {
  id: text("id").primaryKey(),
  parameterSetId: text("parameter_set_id").notNull(),
  parameterId: text("parameter_id").notNull(),
  volgnr: integer("volgnr").notNull().default(1),
  isMeetwaarde: integer("is_meetwaarde", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});

//
// 8. RELEVANTE TAXA (COL Cache)
//

export const relevanteTaxa = sqliteTable("relevante_taxa", {
  id: text("id").primaryKey(),
  taxonNaam: text("taxon_naam").notNull(),
  taxonLevel: text("taxon_level"),
  colIdentifier: text("col_identifier"),
  gbifIdentifier: text("gbif_identifier"),
  nlNaam: text("nl_naam"),
  taxonomischeBoom: text("taxonomische_boom"), // <-- NIEUW: JSON string met de volledige hiërarchie
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(currentTimestamp),
  deletedAt: text("deleted_at"),
});