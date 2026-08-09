// app/actions.ts
"use server";

import { db, syncPubliekeDataNaarTurso, dbRemote } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { sql, eq, like } from "drizzle-orm";
import {
    getObjectDossier,
    saveObjectDossier,
    SaveObjectPayload
} from "@/src/lib/repositories/objectRepository";
import { revalidatePath } from "next/cache";

export async function haalStatistiekenOp() {
    // Lokale statistieken
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

    // Turso statistieken (indien verbonden)
    let tursoObjCount = 0;
    if (dbRemote) {
        try {
            const [tRes] = await dbRemote.select({ count: sql<number>`count(*)` }).from(schema.objects);
            tursoObjCount = tRes?.count || 0;
        } catch {
            tursoObjCount = 0;
        }
    }

    return {
        lokaal: {
            totaalObjecten: totalObj.count,
            vertrouwelijkObjecten: confObj.count,
            publiekObjecten: totalObj.count - confObj.count,
            totaalParameters: totalParams.count,
            vertrouwelijkParameters: confParams.count,
            totaalRelaties: totalRel.count,
        },
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
    const resultaten = await db
        .select({
            id: schema.objects.id,
            label: schema.objects.label,
            isConfidential: schema.objects.isConfidential,
        })
        .from(schema.objects)
        .where(like(schema.objects.label, `%${zoekterm}%`))
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