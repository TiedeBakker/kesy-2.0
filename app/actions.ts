// app/actions.ts
"use server";

import { activeDb, db, dbRemote, syncPubliekeDataNaarTurso } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { sql, eq, like, and, max, or, isNull, desc, asc } from "drizzle-orm";
import {
  getObjectDossier,
  saveObjectDossier,
  SaveObjectPayload
} from "@/src/lib/repositories/objectRepository";
import { revalidatePath } from "next/cache";
import { voerVolledigeSyncUit } from "@/src/lib/syncEngine";

import { objects, relationValues, relations } from "@/src/db/schema";
import { v7 as uuidv7 } from "uuid";
import {
  parameterSets, parameterSetParameters, parameters, parameterValues, units,
  valueTypes,
  objectTypes,
} from "@/src/db/schema";


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


// app/actions.ts

export async function zoekObjecten(zoekterm: string = "") {
  try {
    // 1. Gebruik activeDb (wijst op Vercel naar Turso, en lokaal naar de desktop SQLite DB)
    const client = activeDb || db;

    if (!client) {
      return { success: true, objecten: [] };
    }

    const schoneZoekterm = zoekterm.trim().toLowerCase();
    if (!schoneZoekterm || schoneZoekterm.length < 2) {
      return { success: true, objecten: [] };
    }

    // 2. Zoekopdracht met filter op vertrouwelijkheid (op Vercel) en slimme sortering
    const resultaten = await client
      .select({
        id: schema.objects.id,
        label: schema.objects.label,
        isConfidential: schema.objects.isConfidential,
      })
      .from(schema.objects)
      .where(
        and(
          or(
            like(sql`LOWER(${schema.objects.label})`, `%${schoneZoekterm}%`),
            like(sql`LOWER(${schema.objects.id})`, `%${schoneZoekterm}%`)
          ),
          // Alleen op Vercel/Turso (wanneer client === dbRemote) filteren op publieke data
          client === dbRemote ? eq(schema.objects.isConfidential, false) : undefined
        )
      )
      // 🎯 Slimme sortering: Exacte matches eerst, daarna 'begint met', daarna de rest
      .orderBy(
        sql`CASE 
          WHEN LOWER(${schema.objects.label}) = LOWER(${schoneZoekterm}) THEN 1
          WHEN LOWER(${schema.objects.label}) LIKE LOWER(${schoneZoekterm + '%'}) THEN 2
          ELSE 3
        END`,
        schema.objects.label
      )
      .limit(50); // 🎯 Verhoogde limiet

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

    // 1. Bepaal de actieve DB client (werkt zowel lokaal als op Vercel/Turso)
    const client = activeDb || db;
    if (!client) {
      return { success: false, error: "Geen actieve database-verbinding." };
    }

    // 2. Haal vertrouwelijkheid van beide objecten op
    const [sourceObj] = await client
      .select({ isConfidential: schema.objects.isConfidential })
      .from(schema.objects)
      .where(eq(schema.objects.id, sourceId));

    const [targetObj] = await client
      .select({ isConfidential: schema.objects.isConfidential })
      .from(schema.objects)
      .where(eq(schema.objects.id, targetId));

    if (!sourceObj || !targetObj) {
      return { success: false, error: "Source of Target object niet gevonden." };
    }

    // Regels: Alleen publiek (false) als BEIDE publiek zijn
    const isConfidential = Boolean(sourceObj.isConfidential || targetObj.isConfidential);

    // 3. Bepaal volgorde op basis van de uitgaande relaties van het source-object
    const bestaandeRelaties = await client
      .select({ maxVolgorde: max(schema.relationValues.volgorde) })
      .from(schema.relationValues)
      .where(eq(schema.relationValues.sourceId, sourceId));

    const hoogsteVolgorde = bestaandeRelaties[0]?.maxVolgorde ?? 0;
    const nieuweVolgorde = hoogsteVolgorde + 1;

    // 4. Voeg relation_value toe
    const nieuwId = uuidv7();
    const nu = new Date().toISOString();

    await client.insert(schema.relationValues).values({
      id: nieuwId,
      relationId,
      sourceId,
      targetId,
      volgorde: nieuweVolgorde,
      isConfidential,
      validFrom: nu,
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
// app/actions.ts

export async function batchMakenEnKoppelen(data: {
  sourceId: string;
  relationId: string;
  objectLabels: string[]; // De gefine-tunede namen uit de modal
}) {
  try {
    const { sourceId, relationId, objectLabels } = data;
    const client = activeDb || db;
    if (!client) return { success: false, error: "Geen actieve database." };

    // 1. Controleer of het bron-object bestaat en wat zijn vertrouwelijkheid is
    const sourceObj = await client.query.objects.findFirst({
      where: eq(schema.objects.id, sourceId),
    });

    if (!sourceObj) {
      return { success: false, error: "Bron-object niet gevonden." };
    }

    // 2. Bepaal het hoogste volgnummer voor uitgaande relaties vanaf dit sourceId
    const bestaandeRelaties = await client
      .select({ maxVolgorde: max(schema.relationValues.volgorde) })
      .from(schema.relationValues)
      .where(eq(schema.relationValues.sourceId, sourceId));

    let startVolgorde = (bestaandeRelaties[0]?.maxVolgorde ?? 0) + 1;
    const nu = new Date().toISOString();
    const aangemaakteIds: string[] = [];

    // 3. Lus door de objectlabels en maak object + relatie aan
    for (const label of objectLabels) {
      if (!label.trim()) continue;

      const nieuwObjectId = uuidv7();
      const nieuwRelationValueId = uuidv7();

      // A. Maak het nieuwe target-object aan
      await client.insert(schema.objects).values({
        id: nieuwObjectId,
        label: label.trim(),
        isConfidential: sourceObj.isConfidential, // Neemt vertrouwelijkheid over van bron
        validFrom: nu,
        createdAt: nu,
        updatedAt: nu,
      });

      // B. Maak de relatie-waarde aan
      await client.insert(schema.relationValues).values({
        id: nieuwRelationValueId,
        relationId,
        sourceId,
        targetId: nieuwObjectId,
        volgorde: startVolgorde,
        isConfidential: sourceObj.isConfidential,
        validFrom: nu,
        createdAt: nu,
        updatedAt: nu,
      });

      startVolgorde++;
      aangemaakteIds.push(nieuwObjectId);
    }

    return { success: true, count: aangemaakteIds.length };
  } catch (error: any) {
    console.error("Fout bij batch aanmaken:", error);
    return { success: false, error: error.message };
  }
}
// app/actions.ts

// Hulpfunctie: Hernummer de uitgaande relaties van een sourceId strak vanaf 1
async function hernummerVolgordeVoorSource(client: any, sourceId: string) {
  const relaties = await client
    .select({ id: schema.relationValues.id })
    .from(schema.relationValues)
    .where(eq(schema.relationValues.sourceId, sourceId))
    .orderBy(schema.relationValues.volgorde);

  const nu = new Date().toISOString();
  for (let i = 0; i < relaties.length; i++) {
    await client
      .update(schema.relationValues)
      .set({ volgorde: i + 1, updatedAt: nu })
      .where(eq(schema.relationValues.id, relaties[i].id));
  }
}

// 1 & 2. Server Action om relatietype of richting aan te passen
// app/actions.ts (of waar bewerkRelatie gedefinieerd staat)

// app/actions.ts

export async function bewerkRelatie({
  relationValueId,
  nieuwRelationId,
  wisselRichting,
  validFrom,
  validTo,
}: {
  relationValueId: string;
  nieuwRelationId?: string;
  wisselRichting?: boolean;
  validFrom?: string | null;
  validTo?: string | null;
}) {
  try {
    const client = activeDb || db;
    if (!client) return { success: false, error: "Geen actieve database." };

    // 1. Ophalen van de huidige relatie
    const currentRel = await client
      .select()
      .from(schema.relationValues)
      .where(eq(schema.relationValues.id, relationValueId))
      .get();

    if (!currentRel) {
      return { success: false, error: "Relatie niet gevonden." };
    }

    // 2. Bepaal de nieuwe waarden
    const targetRelationId = nieuwRelationId || currentRel.relationId;
    
    // Gebruik de correcte schemanamen: sourceId en targetId
    let newSourceId = currentRel.sourceId;
    let newTargetId = currentRel.targetId;
    let newVolgorde = currentRel.volgorde;

    // Als de richting omgewisseld wordt
    if (wisselRichting) {
      newSourceId = currentRel.targetId;
      newTargetId = currentRel.sourceId;

      // Bepaal de hoogste volgorde bij het nieuwe bron-object
      const bestaandeRelaties = await client
        .select({ maxVolgorde: max(schema.relationValues.volgorde) })
        .from(schema.relationValues)
        .where(eq(schema.relationValues.sourceId, newSourceId));

      const hoogsteVolgorde = bestaandeRelaties[0]?.maxVolgorde ?? 0;
      newVolgorde = hoogsteVolgorde + 1;
    }

    // 3. Database Update uitvoeren
    await client
      .update(schema.relationValues)
      .set({
        relationId: targetRelationId,
        sourceId: newSourceId,
        targetId: newTargetId,
        volgorde: newVolgorde,
        validFrom: validFrom !== undefined ? validFrom : currentRel.validFrom,
        validTo: validTo !== undefined ? validTo : currentRel.validTo,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.relationValues.id, relationValueId));

    // Herbereken de volgorde van het oude bron-object bij richting-wissel
    if (wisselRichting) {
      await hernummerVolgordeVoorSource(client, currentRel.sourceId);
    }

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Fout bij bewerken relatie:", error);
    return { success: false, error: error.message || "Fout bij opslaan." };
  }
}
// app/actions.ts

// 1. Ophalen van alle definities + parameter sets met hun gekoppelde parameters
export async function haalParameterFormInformatieOp() {
  try {
    const client = activeDb || db;
    if (!client) return { success: false, error: "Geen actieve DB" };

    const alleParameters = await client.select().from(schema.parameters);
    const alleSets = await client.select().from(schema.parameterSets);
    const setKoppelingen = await client.select().from(schema.parameterSetParameters);

    return {
      success: true,
      parameters: alleParameters,
      parameterSets: alleSets,
      setKoppelingen,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 2. Haal de meest recente parameter-waarden op voor een Target (Object of Relatie)
export async function haalLaatsteParameterWaardenOp(targetId: string) {
  try {
    const client = activeDb || db;
    if (!client) return { success: false, error: "Geen actieve DB" };

    const resultaten = await client
      .select({
        parameterId: schema.parameterValues.parameterId,
        value: schema.parameterValues.value,
        validFrom: schema.parameterValues.validFrom,
        validTo: schema.parameterValues.validTo,
      })
      .from(schema.parameterValues)
      .where(eq(schema.parameterValues.targetId, targetId))
      .orderBy(desc(schema.parameterValues.validFrom));

    // Groepeer per parameterId om enkel de allerlaatste te pakken
    const laatstePerParam: Record<string, { value: string; validFrom: string }> = {};
    for (const item of resultaten) {
      if (!laatstePerParam[item.parameterId]) {
        laatstePerParam[item.parameterId] = {
          value: item.value,
          validFrom: item.validFrom,
        };
      }
    }

    return { success: true, laatsteWaarden: laatstePerParam };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export interface ParameterInvoerItem {
  parameterId: string;
  value: string;
  validFrom: string;
  isMeetwaarde: boolean;
  historieBewaren: boolean;
}

// 3. Batch opslaan van ingevulde parameterwaarden
export async function slaParameterWaardenBatchOp(payload: {
  targetId: string;
  targetType: "object" | "relation_value";
  items: ParameterInvoerItem[];
}) {
  try {
    const client = activeDb || db;
    if (!client) return { success: false, error: "Geen actieve DB" };

    const { targetId, targetType, items } = payload;
    const nu = new Date().toISOString();

    // Filter alleen items met een ingevulde waarde
    const ingevuldeItems = items.filter((item) => item.value && item.value.trim() !== "");

    if (ingevuldeItems.length === 0) {
      return { success: true, count: 0 };
    }

    for (const item of ingevuldeItems) {
      const validFromISO = new Date(item.validFrom).toISOString();
      // Bepaal validTo op basis van isMeetwaarde
      const validToISO = item.isMeetwaarde ? validFromISO : null;

      // Als historie bewaard moet worden bij een NON-meetwaarde:
      // Sluit lopende eerdere eigenschap-waarden af (validTo = nieuwe validFrom)
      if (!item.isMeetwaarde && item.historieBewaren) {
        await client
          .update(schema.parameterValues)
          .set({ validTo: validFromISO, updatedAt: nu })
          .where(
            and(
              eq(schema.parameterValues.targetId, targetId),
              eq(schema.parameterValues.parameterId, item.parameterId),
              isNull(schema.parameterValues.validTo)
            )
          );
      }



      // Nieuwe parameter value inserten
      // 1. Haal de vertrouwelijkheid van de target op (indien object)
      let targetIsConfidential = false;
      if (targetType === "object") {
        const [targetObj] = await client
          .select({ isConfidential: schema.objects.isConfidential })
          .from(schema.objects)
          .where(eq(schema.objects.id, targetId));

        if (targetObj) {
          targetIsConfidential = Boolean(targetObj.isConfidential);
        }
      }

      // 2. Gebruik targetIsConfidential bij de Insert:
      await client.insert(schema.parameterValues).values({
        id: uuidv7(),
        parameterId: item.parameterId,
        targetId,
        targetType,
        value: item.value.trim(),
        isConfidential: targetIsConfidential, // 🟢 Gebruikt nu de vlag van het Parent Object
        validFrom: validFromISO,
        validTo: validToISO,
        createdAt: nu,
        updatedAt: nu,
      });
    }

    revalidatePath("/");
    return { success: true, count: ingevuldeItems.length };
  } catch (error: any) {
    console.error("Fout bij opslaan parameterwaarden:", error);
    return { success: false, error: error.message };
  }
}

// --- OPHALEN ALLE STAMGEGEVENS ---
export async function haalCatalogiOp() {
  try {
    const [
      paramsList,
      relsList,
      unitsList,
      valTypesList,
      setsList,
      setParamsList
    ] = await Promise.all([
      db.select().from(parameters).where(isNull(parameters.deletedAt)).orderBy(asc(parameters.label)),
      db.select().from(relations).where(isNull(relations.deletedAt)).orderBy(asc(relations.label)),
      db.select().from(units).where(isNull(units.deletedAt)).orderBy(asc(units.label)),
      db.select().from(valueTypes).where(isNull(valueTypes.deletedAt)).orderBy(asc(valueTypes.label)),
      db.select().from(parameterSets).where(isNull(parameterSets.deletedAt)).orderBy(asc(parameterSets.label)),
      db.select().from(parameterSetParameters).where(isNull(parameterSetParameters.deletedAt)).orderBy(asc(parameterSetParameters.volgnr)),
    ]);

    return {
      success: true,
      data: {
        parameters: paramsList,
        relations: relsList,
        units: unitsList,
        valueTypes: valTypesList,
        parameterSets: setsList.map((s: any) => ({
          ...s,
          items: setParamsList.filter((sp: any) => sp.parameterSetId === s.id)
        }))
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
// --- GENERIEKE OPSLAAN / BIJWERKEN ACTIES ---
const nowIso = () => new Date().toISOString();

export async function slaParameterOp(data: { id?: string; code: string; label: string; dataType: string; unit?: string }) {
  try {
    const id = data.id || uuidv7();
    await db.insert(parameters).values({
      id,
      code: data.code,
      label: data.label,
      dataType: data.dataType,
      unit: data.unit || null,
      updatedAt: nowIso(),
    }).onConflictDoUpdate({
      target: parameters.id,
      set: {
        code: data.code,
        label: data.label,
        dataType: data.dataType,
        unit: data.unit || null,
        updatedAt: nowIso(),
      }
    });
    revalidatePath("/admin/catalogus");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function slaRelatieTypeOp(data: { id?: string; label: string }) {
  try {
    const id = data.id || uuidv7();
    await db.insert(relations).values({
      id,
      label: data.label,
      updatedAt: nowIso(),
    }).onConflictDoUpdate({
      target: relations.id,
      set: { label: data.label, updatedAt: nowIso() }
    });
    revalidatePath("/admin/catalogus");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function slaUnitOp(data: { id?: string; label: string; symbol: string }) {
  try {
    const id = data.id || `unit_${Date.now()}`;
    await db.insert(units).values({
      id,
      label: data.label,
      symbol: data.symbol,
      updatedAt: nowIso(),
    }).onConflictDoUpdate({
      target: units.id,
      set: { label: data.label, symbol: data.symbol, updatedAt: nowIso() }
    });
    revalidatePath("/admin/catalogus");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function slaParameterSetOp(set: { id?: string; label: string; items: { parameterId: string; isMeetwaarde: boolean; volgnr: number }[] }) {
  try {
    const setId = set.id || `pset_${Date.now()}`;

    // 1. Parameter Set (hoofd) opslaan
    await db.insert(parameterSets).values({
      id: setId,
      label: set.label,
      updatedAt: nowIso(),
    }).onConflictDoUpdate({
      target: parameterSets.id,
      set: { label: set.label, updatedAt: nowIso() }
    });

    // 2. Oude relaties opruimen (soft delete of hard delete voor de koppeltabel)
    await db.delete(parameterSetParameters).where(eq(parameterSetParameters.parameterSetId, setId));

    // 3. Nieuwe items invoegen
    if (set.items.length > 0) {
      await db.insert(parameterSetParameters).values(
        set.items.map((item, idx) => ({
          id: `psp_${setId}_${idx}_${Date.now()}`,
          parameterSetId: setId,
          parameterId: item.parameterId,
          volgnr: item.volgnr || idx + 1,
          isMeetwaarde: item.isMeetwaarde,
          updatedAt: nowIso(),
        }))
      );
    }

    revalidatePath("/admin/catalogus");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// --- SOFT DELETE HELPER ---
export async function verwijderCatalogusItem(tabel: "parameters" | "relations" | "units" | "parameter_sets", id: string) {
  try {
    const payload = { deletedAt: nowIso(), updatedAt: nowIso() };
    if (tabel === "parameters") await db.update(parameters).set(payload).where(eq(parameters.id, id));
    if (tabel === "relations") await db.update(relations).set(payload).where(eq(relations.id, id));
    if (tabel === "units") await db.update(units).set(payload).where(eq(units.id, id));
    if (tabel === "parameter_sets") await db.update(parameterSets).set(payload).where(eq(parameterSets.id, id));

    revalidatePath("/admin/catalogus");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
export async function slaParameterWaardebewerkingOp(payload: {
  id: string;
  parameterId: string;
  value: string;
  validFrom: string;
  opslaanAlsHistorie: boolean;
}) {
  try {
    if (payload.opslaanAlsHistorie) {
      // 1. Haal huidige record op om targetId te kennen
      const [huidigeRecord] = await db
        .select()
        .from(schema.parameterValues)
        .where(eq(schema.parameterValues.id, payload.id));

      if (!huidigeRecord) return { success: false, error: "Record niet gevonden." };

      // 2. Sluit de oude waarde af per de nieuwe validFrom datum
      await db
        .update(schema.parameterValues)
        .set({ validTo: payload.validFrom, updatedAt: new Date().toISOString() })
        .where(eq(schema.parameterValues.id, payload.id));

      // 3. Voeg de nieuwe waarde toe als nieuwste actuele record
      await db.insert(schema.parameterValues).values({
        id: uuidv7(),
        targetId: huidigeRecord.targetId,
        parameterId: payload.parameterId,
        value: payload.value,
        validFrom: payload.validFrom,
        validTo: null,
        isMeetwaarde: huidigeRecord.isMeetwaarde,
        isConfidential: huidigeRecord.isConfidential,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Direct overschrijven (typo herstel)
      await db
        .update(schema.parameterValues)
        .set({
          value: payload.value,
          validFrom: payload.validFrom,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.parameterValues.id, payload.id));
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij bijwerken parameterwaarde." };
  }
}

// app/actions.ts

export interface MediaSetDto {
  Id: string;
  Label: string;
  IsConfidential: boolean;
  ValidFrom: string;
}

export interface MediaItemDto {
  Id: string;
  Type: "foto" | "video";
  OorspronkelijkBestand: string;
  Label: string;
  RelatiefPad: string;
  ValidFrom: string;
  IsConfidential: boolean;
  Metadata: Record<string, unknown>;
  Sets: string[];
}

export interface StuurbestandPayload {
  BatchId: string;
  GegenereerdOp: string;
  Sets: MediaSetDto[];
  Media: MediaItemDto[];
}

// app/actions.ts

export async function importeerStuurbestandAction(payload: StuurbestandPayload) {
  try {
    const client = activeDb || db;
    if (!client) return { success: false, error: "Geen actieve database-verbinding." };

    // Bepaal de vereiste relatietype (bijv. 'media_in_set' of een generiek relatietype)
    // Pas 'rel_media_set' aan naar de ID van jouw gewenste relatietype in de catalogus
    const MEDIA_RELATION_ID = "rel_media_set"; 

    // Parameters voor metadata/paden (ID's zoals gedefinieerd in jouw 'parameters' tabel)
    const PARAM_PAD = "param_relatief_pad";
    const PARAM_TYPE = "param_media_type";
    const PARAM_OORSPRONKELIJK = "param_oorspronkelijk_bestand";
    const PARAM_METADATA = "param_json_metadata";

    const nu = new Date().toISOString();

    // 1. SETS Opslaan als 'objects'
    for (const setItem of payload.Sets) {
      await client
        .insert(schema.objects)
        .values({
          id: setItem.Id,
          label: setItem.Label,
          isConfidential: setItem.IsConfidential,
          validFrom: setItem.ValidFrom || nu,
          createdAt: nu,
          updatedAt: nu,
        })
        .onConflictDoUpdate({
          target: schema.objects.id,
          set: {
            label: setItem.Label,
            isConfidential: setItem.IsConfidential,
            validFrom: setItem.ValidFrom || nu,
            updatedAt: nu,
          },
        });
    }

    // 2. MEDIA Items opslaan als 'objects' + PARAMETERS + RELATIES
    for (const mediaItem of payload.Media) {
      // A. Het Media-item opslaan als Object
      await client
        .insert(schema.objects)
        .values({
          id: mediaItem.Id,
          label: mediaItem.Label,
          isConfidential: mediaItem.IsConfidential,
          validFrom: mediaItem.ValidFrom || nu,
          createdAt: nu,
          updatedAt: nu,
        })
        .onConflictDoUpdate({
          target: schema.objects.id,
          set: {
            label: mediaItem.Label,
            isConfidential: mediaItem.IsConfidential,
            validFrom: mediaItem.ValidFrom || nu,
            updatedAt: nu,
          },
        });

      // B. Specifieke eigenschappen opslaan als 'parameterValues'
      const paramWaarden = [
        { paramId: PARAM_PAD, val: mediaItem.RelatiefPad },
        { paramId: PARAM_TYPE, val: mediaItem.Type },
        { paramId: PARAM_OORSPRONKELIJK, val: mediaItem.OorspronkelijkBestand },
        { paramId: PARAM_METADATA, val: JSON.stringify(mediaItem.Metadata) },
      ];

      for (const p of paramWaarden) {
        if (!p.val) continue;
        await client
          .insert(schema.parameterValues)
          .values({
            id: uuidv7(),
            parameterId: p.paramId,
            targetId: mediaItem.Id,
            targetType: "object",
            value: p.val,
            isConfidential: mediaItem.IsConfidential,
            validFrom: mediaItem.ValidFrom || nu,
            updatedAt: nu,
          });
      }

      // C. Koppeling leggen via 'relationValues' (Media -> Set)
      for (const setId of mediaItem.Sets) {
        await client
          .insert(schema.relationValues)
          .values({
            id: uuidv7(),
            relationId: MEDIA_RELATION_ID,
            sourceId: mediaItem.Id, // Media is bron
            targetId: setId,        // Set is doel
            isConfidential: mediaItem.IsConfidential,
            validFrom: mediaItem.ValidFrom || nu,
            updatedAt: nu,
          });
      }
    }

    revalidatePath("/");
    return { success: true, count: payload.Media.length };
  } catch (error: any) {
    console.error("Fout bij importeren stuurbestand:", error);
    return { success: false, error: error.message || "Fout bij verwerken van het stuurbestand." };
  }
}