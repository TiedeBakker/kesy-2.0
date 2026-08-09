// src/lib/db.ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql, and } from "drizzle-orm";
import path from "path";
import * as schema from "../db/schema";

// 1. Lokale SQLite Database (De enige echte SSOT)
const localDbPath = `file:${path.join(process.cwd(), "data", "kesy_local.db")}`;
const localClient = createClient({ url: localDbPath });
export const db = drizzle(localClient, { schema });

// 2. Turso Remote Client (Uitsluitend voor de Sync Engine)
const remoteUrl = process.env.TURSO_DATABASE_URL;
const remoteAuthToken = process.env.TURSO_AUTH_TOKEN;

const remoteClient = remoteUrl && remoteAuthToken
  ? createClient({ url: remoteUrl, authToken: remoteAuthToken })
  : null;

export const dbRemote = remoteClient ? drizzle(remoteClient, { schema }) : null;

//
// 3. ROW-LEVEL PUBLIC SYNC ENGINE (Lokaal ➔ Turso Cloud)
//
export async function syncPubliekeDataNaarTurso(lastSyncTimestamp?: string) {
  if (!dbRemote) {
    throw new Error("Turso database credentials ontbreken in .env.local!");
  }

  const syncTime = new Date().toISOString();
  // Als er geen timestamp is meegegeven, pakken we alle publieke data (Full Push)
  const filterTime = lastSyncTimestamp || "1970-01-01T00:00:00.000Z";

  const resultaten = {
    objects: 0,
    relationValues: 0,
    parameterValues: 0,
    stamgegevens: 0,
  };

  // --- A. STAMGEGEVENS & CATALOGI (100% Publiek) ---
  const relationsData = await db.select().from(schema.relations);
  const parametersData = await db.select().from(schema.parameters);
  const unitsData = await db.select().from(schema.units);
  const taxaData = await db.select().from(schema.relevanteTaxa);

  if (relationsData.length > 0) {
    await dbRemote.insert(schema.relations).values(relationsData).onConflictDoNothing();
  }
  if (parametersData.length > 0) {
    await dbRemote.insert(schema.parameters).values(parametersData).onConflictDoNothing();
  }
  if (unitsData.length > 0) {
    await dbRemote.insert(schema.units).values(unitsData).onConflictDoNothing();
  }

  // 📍 NIEUW: Taxa in batches van 100 pushen naar Turso
if (taxaData.length > 0) {
  for (let i = 0; i < taxaData.length; i += 100) {
    const batch = taxaData.slice(i, i + 100);
    await dbRemote.insert(schema.relevanteTaxa).values(batch).onConflictDoNothing();
  }
}
 resultaten.stamgegevens = 
  relationsData.length + 
  parametersData.length + 
  unitsData.length + 
  taxaData.length; // 📍 Bijgewerkt

  // --- B. ENTITEITEN & WAARDEN (Alleen isConfidential = false) ---
  
  // 1. Objects
  const pubObjects = await db
    .select()
    .from(schema.objects)
    .where(
      and(
        eq(schema.objects.isConfidential, false),
        sql`${schema.objects.updatedAt} >= ${filterTime}`
      )
    );

  if (pubObjects.length > 0) {
    // In batches van 100 naar Turso pushen
    for (let i = 0; i < pubObjects.length; i += 100) {
      const batch = pubObjects.slice(i, i + 100);
      await dbRemote.insert(schema.objects).values(batch).onConflictDoNothing();
    }
    resultaten.objects = pubObjects.length;
  }

  // 2. Relation Values
  const pubRelations = await db
    .select()
    .from(schema.relationValues)
    .where(
      and(
        eq(schema.relationValues.isConfidential, false),
        sql`${schema.relationValues.updatedAt} >= ${filterTime}`
      )
    );

  if (pubRelations.length > 0) {
    for (let i = 0; i < pubRelations.length; i += 100) {
      const batch = pubRelations.slice(i, i + 100);
      await dbRemote.insert(schema.relationValues).values(batch).onConflictDoNothing();
    }
    resultaten.relationValues = pubRelations.length;
  }

  // 3. Parameter Values
  const pubParamValues = await db
    .select()
    .from(schema.parameterValues)
    .where(
      and(
        eq(schema.parameterValues.isConfidential, false),
        sql`${schema.parameterValues.updatedAt} >= ${filterTime}`
      )
    );

  if (pubParamValues.length > 0) {
    for (let i = 0; i < pubParamValues.length; i += 100) {
      const batch = pubParamValues.slice(i, i + 100);
      await dbRemote.insert(schema.parameterValues).values(batch).onConflictDoNothing();
    }
    resultaten.parameterValues = pubParamValues.length;
  }

  return {
    syncTime,
    resultaten,
  };
}