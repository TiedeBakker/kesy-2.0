// app/actions.ts
"use server";

import { activeDb, db, dbRemote, syncPubliekeDataNaarTurso } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { sql, eq, like, and } from "drizzle-orm";
import {
    getObjectDossier,
    saveObjectDossier,
    SaveObjectPayload
} from "@/src/lib/repositories/objectRepository";
import { revalidatePath } from "next/cache";
import { voerVolledigeSyncUit } from "@/src/lib/syncEngine";

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

  // Lokale statistieken alleen ophalen als lokale DB actief is op pc
  if (db) {
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
      console.warn("Lokale DB kon niet gelezen worden:", e);
    }
  }

  // Turso (Remote) Statistieken
  let tursoObjCount = 0;
  const remoteTarget = dbRemote || activeDb;
  
  if (remoteTarget) {
    try {
      const [tRes] = await remoteTarget.select({ count: sql<number>`count(*)` }).from(schema.objects);
      tursoObjCount = tRes?.count || 0;
    } catch (e) {
      console.error("Turso leesfout:", e);
    }
  }

  // Op Vercel tonen we de Turso-tellingen als hoofdweergave
  if (!db) {
    lokaalData.totaalObjecten = tursoObjCount;
    lokaalData.publiekObjecten = tursoObjCount;
  }

  return {
    lokaal: lokaalData,
    turso: {
      totaalObjecten: tursoObjCount,
    },
  };
}
// app/actions.ts
//import { voerVolledigeSyncUit } from "@/src/lib/syncEngine";

export async function voerSyncUit() {
  try {
    const resultaat = await voerVolledigeSyncUit();
    return { success: true, resultaat };
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
    // 💡 Gebruik activeDb (is op je laptop de lokale SQLite DB met vertrouwelijke data)
    const client = activeDb || db;

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
                // 🔒 Alleen op Vercel (wanneer client === dbRemote) filteren we op publieke data!
                client === dbRemote ? eq(schema.objects.isConfidential, false) : undefined
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
        const client = activeDb || db;
        const parameters = await client.select().from(schema.parameters);
        const relations = await client.select().from(schema.relations);
        return { success: true, parameters, relations };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


// export async function startSynchronisatieAction() {
//   try {
//     const resultaat = await voerVolledigeSyncUit();
//     return { success: true, resultaat };
//   } catch (error: any) {
//     return { success: false, error: error.message };
//   }
// }