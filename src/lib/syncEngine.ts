// src/lib/syncEngine.ts
import { db, dbRemote } from "./db";
import * as schema from "../db/schema";
import { eq, gte, and, isNotNull, inArray, sql, getTableColumns } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

function isNewer(updatedAtA: string, updatedAtB?: string | null): boolean {
    if (!updatedAtB) return true;
    return new Date(updatedAtA).getTime() > new Date(updatedAtB).getTime();
}

// Helper om grote arrays in behapbare brokken (chunks) op te spSplitsen
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

export async function voerVolledigeSyncUit() {
    if (!db) throw new Error("Sync kan alleen lokaal worden gestart.");
    if (!dbRemote) throw new Error("Geen verbinding met Turso.");

    const syncStartTime = new Date().toISOString();

    // --- STAP 1: LAATSTE SYNC TIMESTAMP OPHALEN ---
    const [localMeta] = await db.select().from(schema.syncMetadata).limit(1);
    const lastSyncedAt = localMeta?.lastSyncedAt || "1970-01-01T00:00:00.000Z";

    const resultaten = {
        pulledFromTurso: 0,
        pushedToTurso: 0,
        hardDeletedLocal: 0,
        hardDeletedTurso: 0,
        syncStartTime,
    };

    const stamTabellen = [
        { name: "relations", table: schema.relations },
        { name: "parameters", table: schema.parameters },
        { name: "objectTypes", table: schema.objectTypes },
        { name: "valueTypes", table: schema.valueTypes },
        { name: "units", table: schema.units },
        { name: "parameterSets", table: schema.parameterSets },
        { name: "parameterSetParameters", table: schema.parameterSetParameters },
        { name: "relevanteTaxa", table: schema.relevanteTaxa },
    ];

    const entiteitTabellen = [
        { name: "objects", table: schema.objects },
        { name: "relationValues", table: schema.relationValues },
        { name: "parameterValues", table: schema.parameterValues },
    ];

    const alleTabellen = [...stamTabellen, ...entiteitTabellen];

    // --- STAP 2: PULL UIT TURSO (TURSO ➔ LOKAAL IN BULK) ---
    for (const { table } of alleTabellen) {
        const remoteChanges = await dbRemote
            .select()
            .from(table as any)
            .where(gte((table as any).updatedAt, lastSyncedAt));

        if (remoteChanges.length === 0) continue;

        // Haal alle matchende lokale ID's in 1 query op en zet in een Map
        const remoteIds = remoteChanges.map((r: any) => r.id);
        const localMatches: any[] = [];

        // InArray in chunks van 500 om SQL limieten te voorkomen
        for (const idChunk of chunkArray(remoteIds, 500)) {
            const matches = await db
                .select()
                .from(table as any)
                .where(inArray((table as any).id, idChunk));
            localMatches.push(...matches);
        }

        const localMap = new Map(localMatches.map((item) => [item.id, item]));
        const recordsToUpsert: any[] = [];

        // LWW vergelijking volledig in-memory
        for (const remoteRec of remoteChanges) {
            const localRec = localMap.get(remoteRec.id);
            if (isNewer(remoteRec.updatedAt, localRec?.updatedAt)) {
                recordsToUpsert.push(remoteRec);
            }
        }

        // Bulk-upsert in chunks van 100 naar Lokale DB
        if (recordsToUpsert.length > 0) {
            const columns = getTableColumns(table as any);

            const setClause: Record<string, any> = {};
            for (const [colKey, colObj] of Object.entries(columns)) {
                const dbColumnName = (colObj as any).name || colKey;
                setClause[dbColumnName] = sql`EXCLUDED.${sql.identifier(dbColumnName)}`;
            }

            for (const batch of chunkArray(recordsToUpsert, 100)) {
                await db
                    .insert(table as any)
                    .values(batch)
                    .onConflictDoUpdate({
                        target: (table as any).id,
                        set: setClause,
                    });
            }
            resultaten.pulledFromTurso += recordsToUpsert.length;
        }
    }

    // --- STAP 3: HARD DELETE OPKUISBEURT (LOKAAL) ---
    for (const { table } of alleTabellen) {
        const deletedLocally = await db
            .delete(table as any)
            .where(isNotNull((table as any).deletedAt))
            .returning();
        resultaten.hardDeletedLocal += deletedLocally.length;
    }

    // --- STAP 4: PUSH NAAR TURSO (LOKAAL ➔ TURSO IN BULK) ---
    // A. Stamgegevens
    for (const { table } of stamTabellen) {
        const localChanges = await db
            .select()
            .from(table as any)
            .where(gte((table as any).updatedAt, lastSyncedAt));

        if (localChanges.length > 0) {
            for (const batch of chunkArray(localChanges, 100)) {
                await dbRemote
                    .insert(table as any)
                    .values(batch)
                    .onConflictDoNothing(); // Stamgegevens gewoon overzetten
            }
            resultaten.pushedToTurso += localChanges.length;
        }
    }
 // B. Publieke Entiteiten
    // 1. Publieke Objecten ophalen
    const pubObjects = await db
        .select()
        .from(schema.objects)
        .where(
            and(
                eq(schema.objects.isConfidential, false),
                gte(schema.objects.updatedAt, lastSyncedAt)
            )
        );

    // 2. Publieke Relaties ophalen (Alleen als de relatie én BEIDE objecten publiek zijn)
    const pubRelations = await db
        .select({ rv: schema.relationValues })
        .from(schema.relationValues)
        .innerJoin(schema.objects, eq(schema.relationValues.sourceId, schema.objects.id))
        .where(
            and(
                eq(schema.relationValues.isConfidential, false),
                eq(schema.objects.isConfidential, false),
                gte(schema.relationValues.updatedAt, lastSyncedAt)
            )
        )
        .then((rows: any[]) => rows.map((r: any) => r.rv));

    // 3. Publieke Parameterwaarden ophalen (Waterdicht: vlag op 0 EN gekoppeld aan publiek object)
    const pubParamValues = await db
        .select({ pv: schema.parameterValues })
        .from(schema.parameterValues)
        .innerJoin(schema.objects, eq(schema.parameterValues.targetId, schema.objects.id))
        .where(
            and(
                eq(schema.parameterValues.isConfidential, false),
                eq(schema.objects.isConfidential, false), // 🛡️ Dubbele check op het Target Object!
                gte(schema.parameterValues.updatedAt, lastSyncedAt)
            )
        )
        .then((rows: any[]) => rows.map((r: any) => r.pv));

    // Helper voor het pushen van entiteiten
    const entiteitenPushes = [
        { table: schema.objects, data: pubObjects },
        { table: schema.relationValues, data: pubRelations },
        { table: schema.parameterValues, data: pubParamValues },
    ];

    for (const { table, data } of entiteitenPushes) {
        if (data.length > 0) {
            const columns = getTableColumns(table);
            const setClause: Record<string, any> = {};

            for (const [colKey, colObj] of Object.entries(columns)) {
                const dbColumnName = (colObj as any).name || colKey;
                setClause[dbColumnName] = sql`EXCLUDED.${sql.identifier(dbColumnName)}`;
            }

            for (const batch of chunkArray(data, 100)) {
                await dbRemote
                    .insert(table as any)
                    .values(batch)
                    .onConflictDoUpdate({
                        target: (table as any).id,
                        set: setClause,
                    });
            }
            resultaten.pushedToTurso += data.length;
        }
    }
    // --- STAP 5: HARD DELETE OPKUISBEURT (TURSO) ---
    for (const { table } of alleTabellen) {
        const res: any = await dbRemote
            .delete(table as any)
            .where(isNotNull((table as any).deletedAt));
        const deletedCount = res.rowsAffected ?? (Array.isArray(res) ? res.length : (res.rows?.length || 0));
        resultaten.hardDeletedTurso += deletedCount;
    }

    for (const { table } of entiteitTabellen) {
        const localConfidentialIds = (
            await db
                .select({ id: (table as any).id })
                .from(table as any)
                .where(eq((table as any).isConfidential, true))
        ).map((r: any) => r.id);

        if (localConfidentialIds.length > 0) {
            for (const idChunk of chunkArray(localConfidentialIds, 500)) {
                const res: any = await dbRemote
                    .delete(table as any)
                    .where(inArray((table as any).id, idChunk));
                const deletedCount = res.rowsAffected ?? (Array.isArray(res) ? res.length : (res.rows?.length || 0));
                resultaten.hardDeletedTurso += deletedCount;
            }
        }
    }

    // --- STAP 6: SYNC METADATA BIJWERKEN ---
    const syncMetaId = localMeta?.id || uuidv7();

    await db
        .insert(schema.syncMetadata)
        .values({ id: syncMetaId, lastSyncedAt: syncStartTime })
        .onConflictDoUpdate({
            target: schema.syncMetadata.id,
            set: { lastSyncedAt: syncStartTime },
        });

    await dbRemote
        .insert(schema.syncMetadata)
        .values({ id: syncMetaId, lastSyncedAt: syncStartTime })
        .onConflictDoUpdate({
            target: schema.syncMetadata.id,
            set: { lastSyncedAt: syncStartTime },
        });

    return resultaten;
}