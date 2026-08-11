// app/actions.ts
"use server";

import { activeDb, db, dbRemote, syncPubliekeDataNaarTurso } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { sql, eq, like, and, max, or } from "drizzle-orm";
import {
  getObjectDossier,
  saveObjectDossier,
  SaveObjectPayload
} from "@/src/lib/repositories/objectRepository";
import { revalidatePath } from "next/cache";
import { voerVolledigeSyncUit } from "@/src/lib/syncEngine";

import { objects, relationValues, relations } from "@/src/db/schema";
import { v7 as uuidv7 } from "uuid";

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
  try {
    // 💡 Gebruik activeDb (is op je laptop de lokale SQLite DB met vertrouwelijke data)
    const client = activeDb || db;

    if (!client) {
      return { success: true, objecten: [] };
    }

    const schoneZoekterm = zoekterm.trim().toLowerCase();
    if (!schoneZoekterm) {
      return { success: true, objecten: [] };
    }

    const resultaten = await client
      .select({
        id: schema.objects.id,
        label: schema.objects.label,
        isConfidential: schema.objects.isConfidential,
      })
      .from(schema.objects)
      .where(
        and(
          // 🔤 Case-insensitive zoeken op label en id
          or(
            like(sql`LOWER(${schema.objects.label})`, `%${schoneZoekterm}%`),
            like(sql`LOWER(${schema.objects.id})`, `%${schoneZoekterm}%`)
          ),
          // 🔒 Alleen op Vercel (wanneer client === dbRemote) filteren we op publieke data!
          client === dbRemote ? eq(schema.objects.isConfidential, false) : undefined
        )
      )
      .limit(10);

    // 🎯 BELANGRIJK: Retourneer een object met `success` en `objecten`
    return { success: true, objecten: resultaten };
  } catch (error: any) {
    console.error("Fout bij zoeken objecten:", error);
    return { success: false, error: error.message, objecten: [] };
  }
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

export async function voegRelatieToe(data: {
  sourceId: string;
  targetId: string;
  relationId: string;
}) {
  try {
    const { sourceId, targetId, relationId } = data;

    // 1. Haal vertrouwelijkheid van beide objecten op
    const sourceObj = await db.query.objects.findFirst({
      where: eq(objects.id, sourceId),
    });
    const targetObj = await db.query.objects.findFirst({
      where: eq(objects.id, targetId),
    });

    if (!sourceObj || !targetObj) {
      return { success: false, error: "Source of Target object niet gevonden." };
    }

    // Regels: Alleen publiek (false) als BEIDE publiek zijn
    const isConfidential = Boolean(sourceObj.isConfidential || targetObj.isConfidential);

    // 2. Bepaal volgorde op basis van de uitgaande relaties van het source-object
    const bestaandeRelaties = await db
      .select({ maxVolgorde: max(relationValues.volgorde) })
      .from(relationValues)
      .where(eq(relationValues.sourceId, sourceId));

    const hoogsteVolgorde = bestaandeRelaties[0]?.maxVolgorde ?? 0;
    const nieuweVolgorde = hoogsteVolgorde + 1;

    // 3. Voeg relation_value toe
    const nieuwId = uuidv7();
    const nu = new Date().toISOString();

    await db.insert(relationValues).values({
      id: nieuwId,
      relationId,
      sourceId,
      targetId,
      volgorde: nieuweVolgorde,
      isConfidential,
      validFrom: nu, // 👈 DIT MISTE: Vul de verplichte NOT NULL valid_from kolom in
      createdAt: nu,
      updatedAt: nu,
    });

    return { success: true, id: nieuwId };
  } catch (error: any) {
    console.error("Fout bij toevoegen relatie:", error);
    return { success: false, error: error.message };
  }
}
// app/actions.ts

export async function verplaatsRelatieVolgorde(data: {
  relationValueId: string;
  richting: "omhoog" | "omlaag";
}) {
  try {
    const client = activeDb || db;
    if (!client) return { success: false, error: "Geen actieve database" };

    // 1. Haal de huidige relatie op
    const [huidigeRelatie] = await client
      .select({
        id: schema.relationValues.id,
        sourceId: schema.relationValues.sourceId,
        volgorde: schema.relationValues.volgorde,
      })
      .from(schema.relationValues)
      .where(eq(schema.relationValues.id, data.relationValueId));

    if (!huidigeRelatie) {
      return { success: false, error: "Relatie niet gevonden" };
    }

    // 2. Haal alle uitgaande relaties van dit bron-object op, gesorteerd op volgorde
    const alleRelaties = await client
      .select({
        id: schema.relationValues.id,
        volgorde: schema.relationValues.volgorde,
      })
      .from(schema.relationValues)
      .where(eq(schema.relationValues.sourceId, huidigeRelatie.sourceId))
      .orderBy(schema.relationValues.volgorde);

    // 3. Zoek de index van het huidige item
    const currentIndex = alleRelaties.findIndex(
      (r: { id: string; volgorde: number }) => r.id === huidigeRelatie.id
    );
    if (currentIndex === -1) return { success: false, error: "Relatie-index niet gevonden" };

    // Bepaal de buur-index
    const targetIndex = data.richting === "omhoog" ? currentIndex - 1 : currentIndex + 1;

    // Controleer of verplaatsen mogelijk is (niet voorbij de grenzen van de lijst)
    if (targetIndex < 0 || targetIndex >= alleRelaties.length) {
      return { success: true }; // Al op de uiterste positie, niks doen
    }

    const buurRelatie = alleRelaties[targetIndex];

    // 4. Wissel de volgorde-waarden om
    const nu = new Date().toISOString();

    await client
      .update(schema.relationValues)
      .set({ volgorde: buurRelatie.volgorde, updatedAt: nu })
      .where(eq(schema.relationValues.id, huidigeRelatie.id));

    await client
      .update(schema.relationValues)
      .set({ volgorde: huidigeRelatie.volgorde, updatedAt: nu })
      .where(eq(schema.relationValues.id, buurRelatie.id));

    return { success: true };
  } catch (error: any) {
    console.error("Fout bij verplaatsen relatievolgorde:", error);
    return { success: false, error: error.message };
  }
}