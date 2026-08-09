// scripts/migrate-kesy1.ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// 1. Verbindingen opzetten
const oldLocalUrl = `file:${path.join(process.cwd(), "data", "kesy1_old.db")}`;
const newLocalUrl = `file:${path.join(process.cwd(), "data", "kesy_local.db")}`;

const oldLocalClient = createClient({ url: oldLocalUrl });
const oldRemoteClient = process.env.KESY1_TURSO_URL
  ? createClient({
      url: process.env.KESY1_TURSO_URL,
      authToken: process.env.KESY1_TURSO_TOKEN,
    })
  : null;

const newLocalClient = createClient({ url: newLocalUrl });
const dbNew = drizzle(newLocalClient, { schema });

async function migrateTable(
  tableName: string,
  targetSchemaTable: any,
  hasIsConfidential: boolean = false
) {
  console.log(`\n-----------------------------------`);
  console.log(`Start migratie van tabel: [${tableName}]`);

  // Haal data op uit oude lokale DB
  let localRows: any[] = [];
  try {
    const res = await oldLocalClient.execute(`SELECT * FROM ${tableName}`);
    localRows = res.rows;
    console.log(`  - Oude Lokale DB: ${localRows.length} records gevonden.`);
  } catch (e) {
    console.log(`  - Tabel [${tableName}] niet gevonden in oude lokale DB.`);
  }

  // Haal data op uit oude Turso Cloud DB
  let remoteRows: any[] = [];
  if (oldRemoteClient) {
    try {
      const res = await oldRemoteClient.execute(`SELECT * FROM ${tableName}`);
      remoteRows = res.rows;
      console.log(`  - Oude Turso DB: ${remoteRows.length} records gevonden.`);
    } catch (e) {
      console.log(`  - Tabel [${tableName}] niet gevonden in oude Turso DB.`);
    }
  }

  // Samenvoegen & Dedupliceren op ID
  const map = new Map<string, any>();
  [...localRows, ...remoteRows].forEach((row) => {
    map.set(row.id as string, row);
  });

  const uniqueRows = Array.from(map.values());
  console.log(`  - Totaal unieke records na consolidatie: ${uniqueRows.length}`);

  if (uniqueRows.length === 0) return;

  // Transformeer velden naar KESY 2.0 format (camelCase & updatedAt toevoegen)
  const preparedRows = uniqueRows.map((row) => {
    const validFromStr = row.valid_from || row.validFrom || new Date().toISOString();
    const validToStr = row.valid_to || row.validTo || null;
    const updatedAtStr = validToStr || validFromStr; // Gebruik geldigheid/einddatum als basis voor updatedAt

    const base: Record<string, any> = {
      id: row.id,
      label: row.label,
      updatedAt: updatedAtStr,
    };

    if (hasIsConfidential) {
      base.isConfidential = Boolean(row.is_confidential ?? row.isConfidential ?? false);
      base.validFrom = validFromStr;
      base.validTo = validToStr;
    }

    // Tabel-specifieke mapping
    if (tableName === "relation_values") {
      base.relationId = row.relation_id || row.relationId;
      base.sourceId = row.source_id || row.sourceId;
      base.targetId = row.target_id || row.targetId;
      base.volgorde = row.volgorde ?? 0;
    } else if (tableName === "parameters") {
      base.code = row.code;
      base.dataType = row.data_type || row.dataType;
      base.unit = row.unit || null;
    } else if (tableName === "parameter_values") {
      base.parameterId = row.parameter_id || row.parameterId;
      base.targetId = row.target_id || row.targetId;
      base.targetType = row.target_type || row.targetType;
      base.value = row.value;
    } else if (tableName === "units") {
      base.symbol = row.symbol;
    } else if (tableName === "relevante_taxa") {
      delete base.label;
      base.taxonNaam = row.taxon_naam || row.taxonNaam;
      base.taxonLevel = row.taxon_level || row.taxonLevel;
      base.colIdentifier = row.col_identifier || row.colIdentifier;
      base.gbifIdentifier = row.gbif_identifier || row.gbifIdentifier;
      base.nlNaam = row.nl_naam || row.nlNaam;
    }

    return base;
  });

  // Batch insert in nieuwe SQLite SSOT
  try {
    // In batches van 100 verwerken voor stabiliteit
    for (let i = 0; i < preparedRows.length; i += 100) {
      const batch = preparedRows.slice(i, i + 100);
      await dbNew.insert(targetSchemaTable).values(batch as any).onConflictDoNothing();
    }
    console.log(`  ✓ succesvol gemigreerd naar KESY 2.0 SQLite SSOT!`);
  } catch (err) {
    console.error(`  ❌ Fout bij invoegen in KESY 2.0:`, err);
  }
}

async function run() {
  console.log("=== START KESY 1.0 ➔ KESY 2.0 MIGRATIE ===");

  // Voer eerst Drizzle schema push uit op de nieuwe DB
  const { execSync } = require("child_process");
  console.log("Aanmaken nieuwe SQLite tabellen...");
  execSync("npx drizzle-kit push", { stdio: "inherit" });

  // Migreer tabellen een voor een
  await migrateTable("relations", schema.relations, false);
  await migrateTable("parameters", schema.parameters, false);
  await migrateTable("units", schema.units, false);
  await migrateTable("object_types", schema.objectTypes, false);
  await migrateTable("value_types", schema.valueTypes, false);
  await migrateTable("parameter_sets", schema.parameterSets, false);
  await migrateTable("relevante_taxa", schema.relevanteTaxa, false);

  await migrateTable("objects", schema.objects, true);
  await migrateTable("relation_values", schema.relationValues, true);
  await migrateTable("parameter_values", schema.parameterValues, true);

  console.log("\n=== MIGRATIE SUCCESVOL AFGEROND! ===");
  process.exit(0);
}

run();