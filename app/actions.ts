// app/actions.ts
"use server";

import { db, syncPubliekeDataNaarTurso, dbRemote } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { sql, eq, like, and } from "drizzle-orm";
import {
    getObjectDossier,
    saveObjectDossier,
    SaveObjectPayload
} from "@/src/lib/repositories/objectRepository";
import { revalidatePath } from "next/cache";

// app/actions.ts
export async function haalStatistiekenOp() {
    let lokaalData = {
        totaalObjecten: 0,
        vertrouwelijkObjecten: 0,
        publiekObjecten: 0,
        totaalParameters: 0,
        vertrouwelijkParameters: 0,
        totaalRelaties: 0,
    };

    // 1. Probeer Lokale DB te lezen (Werkt op localhost, faalt/ontbreekt op Vercel)
    try {
        const [totalObj] = await db.select({ count: sql<number>`count(*)` }).from(schema.objects);
        const [confObj] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.objects)
            .where(eq(schema.objects.isConfidential, true));

        const [totalParams] = await db.select({ count: sql<number>`count(*)` }).from(schema.parameterValues);
        const [confParams] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.parameterValues)
            .where(eq(schema.parameterValues.isConfidential, true));

        const [totalRel] = await db.select({ count: sql<number>`count(*)` }).from(schema.relationValues);

        lokaalData = {
            totaalObjecten: totalObj?.count || 0,
            vertrouwelijkObjecten: confObj?.count || 0,
            publiekObjecten: (totalObj?.count || 0) - (confObj?.count || 0),
            totaalParameters: totalParams?.count || 0,
            vertrouwelijkParameters: confParams?.count || 0,
            totaalRelaties: totalRel?.count || 0,
        };
    } catch (e) {
        console.warn("Lokale SQLite niet beschikbaar (waarschijnlijk Cloud-omgeving):", e);
    }

    // 2. Turso statistieken (voor Vercel / Cloud)
    let tursoObjCount = 0;
    if (dbRemote) {
        try {
            const [tRes] = await dbRemote.select({ count: sql<number>`count(*)` }).from(schema.objects);
            tursoObjCount = tRes?.count || 0;
        } catch (e) {
            console.error("Turso DB leesfout:", e);
            tursoObjCount = 0;
        }
    }

    return {
        lokaal: lokaalData,
        turso: {
            totaalObjecten: tursoObjCount,
        },
    };
}
export async function voerSyncUit() {
    try {
        const res = await syncPubliekeDataNaarTurso();
        return { success: true, data: res };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function haalObjectDossierOp(objectId: string) {
    try {
        const dossier = await getObjectDossier(objectId);
        return { success: true, dossier };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function zoekObjecten(zoekterm: string = "") {
    // 💡 Als op Vercel 'db' lokaal leeg/afwezig is, moet hij Turso ('dbRemote') bevragen!
    const client = dbRemote || db; 

    const resultaten = await client
        .select({
            id: schema.objects.id,
            label: schema.objects.label,
            isConfidential: schema.objects.isConfidential,
        })
        .from(schema.objects)
        .where(
            and(
                like(schema.objects.label, `%${zoekterm}%`),
                // 🔒 Publieke omgeving (Vercel) mag NIET vertrouwelijke objecten zoeken
                dbRemote ? eq(schema.objects.isConfidential, false) : undefined
            )
        )
        .limit(10);

    return resultaten;
}
// Server Action om een compleet object dossier op te slaan
export async function slaObjectDossierOp(payload: SaveObjectPayload) {
  try {
    const savedObjectId = await saveObjectDossier(payload);
    // Ververs de cache van Next.js zodat alle overzichten direct bijgewerkt zijn
    revalidatePath("/");
    return { success: true, objectId: savedObjectId };
  } catch (error: any) {
    console.error("Fout bij opslaan dossier:", error);
    return { success: false, error: error.message };
  }
}

// Server Action om de keuzelijsten voor parameters en relaties op te halen
export async function haalDefinitiesOp() {
  try {
    const parameters = await db.select().from(schema.parameters);
    const relations = await db.select().from(schema.relations);
    return { success: true, parameters, relations };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}