// src/lib/repositories/objectRepository.ts
import { db } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";


const sourceObject = alias(schema.objects, "sourceObject");
const targetObject = alias(schema.objects, "targetObject");
const relationDef = alias(schema.relations, "relationDef");
const paramDef = alias(schema.parameters, "paramDef");

export async function getObjectDossier(objectId: string) {
    // 1. Object stamgegevens
    const [object] = await db
        .select()
        .from(schema.objects)
        .where(eq(schema.objects.id, objectId));

    if (!object) return null;

    // 2. Parameters (gesorteerd op parameter label)
    const parameterValues = await db
        .select({
            id: schema.parameterValues.id,
            parameterId: schema.parameterValues.parameterId,
            label: paramDef.label,
            code: paramDef.code,
            unit: paramDef.unit,
            value: schema.parameterValues.value,
            isConfidential: schema.parameterValues.isConfidential,
            validFrom: schema.parameterValues.validFrom,
            validTo: schema.parameterValues.validTo,
        })
        .from(schema.parameterValues)
        .innerJoin(paramDef, eq(schema.parameterValues.parameterId, paramDef.id))
        .where(eq(schema.parameterValues.targetId, objectId))
        .orderBy(asc(paramDef.label));

    // 3. Uitgaande relaties (EERST op volgorde, DAARNA op label van target)
    const uitgaandeRelaties = await db
        .select({
            relationValueId: schema.relationValues.id,
            relationId: schema.relationValues.relationId,
            relationLabel: relationDef.label,
            relatedObjectId: targetObject.id,
            relatedObjectLabel: targetObject.label,
            volgorde: schema.relationValues.volgorde,
            isConfidential: schema.relationValues.isConfidential,
            validFrom: schema.relationValues.validFrom,
            validTo: schema.relationValues.validTo,
        })
        .from(schema.relationValues)
        .innerJoin(relationDef, eq(schema.relationValues.relationId, relationDef.id))
        .innerJoin(targetObject, eq(schema.relationValues.targetId, targetObject.id))
        .where(eq(schema.relationValues.sourceId, objectId))
        .orderBy(asc(schema.relationValues.volgorde), asc(targetObject.label));

    // 4. Inkomende relaties (EERST op Relatie Type, DAARNA op Object Label)
    const inkomendeRelaties = await db
        .select({
            relationValueId: schema.relationValues.id,
            relationId: schema.relationValues.relationId,
            relationLabel: relationDef.label,
            relatedObjectId: sourceObject.id,
            relatedObjectLabel: sourceObject.label,
            isConfidential: schema.relationValues.isConfidential,
            validFrom: schema.relationValues.validFrom,
            validTo: schema.relationValues.validTo,
        })
        .from(schema.relationValues)
        .innerJoin(relationDef, eq(schema.relationValues.relationId, relationDef.id))
        .innerJoin(sourceObject, eq(schema.relationValues.sourceId, sourceObject.id))
        .where(eq(schema.relationValues.targetId, objectId))
        .orderBy(
            asc(relationDef.label),   // 1. Groepeer/sorteer op Relatie Type (bijv. "is kind van", "vervult rol")
            asc(sourceObject.label)   // 2. Sorteer binnen die groep op Objectnaam (A-Z)
        );

    return {
        object,
        parameterValues,
        uitgaandeRelaties,
        inkomendeRelaties,
    };
}

// Datatypes voor het opslaan/bijwerken van een dossier

export interface SaveObjectPayload {
    id?: string;
    label: string;
    isConfidential: boolean;
    validFrom?: string | null;
    validTo?: string | null;

    parameterValues?: {
        id?: string;
        parameterId: string;
        value: string;
        isConfidential?: boolean;
        validFrom?: string | null;
        validTo?: string | null;
    }[];

    uitgaandeRelaties?: {
        id?: string;
        relationId: string;
        targetId: string;
        volgorde?: number;
        isConfidential?: boolean;
        validFrom?: string | null;
        validTo?: string | null;
    }[];

    inkomendeRelaties?: {
        id?: string;
        relationId: string;
        sourceId: string;
        isConfidential?: boolean;
        validFrom?: string | null;
        validTo?: string | null;
    }[];

    verwijderdeParameterValueIds?: string[];
    verwijderdeRelationValueIds?: string[];
}

export async function saveObjectDossier(payload: SaveObjectPayload) {
    const nu = new Date().toISOString();
    // Zorg dat validFrom nooit undefined/null is i.v.m. .notNull() in schema
    const defaultValidFrom = payload.validFrom || nu;

    return await db.transaction(async (tx: any) => {
        let objectId = payload.id;

        // 1. OBJECT STAMGEGEVENS OPSLAAN OF BIJWERKEN
        if (objectId) {
            await tx
                .update(schema.objects)
                .set({
                    label: payload.label,
                    isConfidential: Boolean(payload.isConfidential),
                    validFrom: defaultValidFrom,
                    validTo: payload.validTo || null,
                    updatedAt: nu,
                })
                .where(eq(schema.objects.id, objectId));
        } else {
            objectId = crypto.randomUUID();
            await tx.insert(schema.objects).values({
                id: objectId,
                label: payload.label,
                isConfidential: Boolean(payload.isConfidential),
                validFrom: defaultValidFrom,
                validTo: payload.validTo || null,
                updatedAt: nu,
            });
        }

        // 2. VERWIJDERINGEN VERWERKEN
        if (payload.verwijderdeParameterValueIds && payload.verwijderdeParameterValueIds.length > 0) {
            await tx
                .delete(schema.parameterValues)
                .where(inArray(schema.parameterValues.id, payload.verwijderdeParameterValueIds));
        }

        if (payload.verwijderdeRelationValueIds && payload.verwijderdeRelationValueIds.length > 0) {
            await tx
                .delete(schema.relationValues)
                .where(inArray(schema.relationValues.id, payload.verwijderdeRelationValueIds));
        }

        // 3. PARAMETER WAARDEN UPSERTEN
        if (payload.parameterValues) {
            for (const p of payload.parameterValues) {
                const itemValidFrom = p.validFrom || defaultValidFrom;

                if (p.id) {
                    await tx
                        .update(schema.parameterValues)
                        .set({
                            parameterId: p.parameterId,
                            value: p.value,
                            isConfidential: Boolean(p.isConfidential),
                            validFrom: itemValidFrom,
                            validTo: p.validTo || null,
                            updatedAt: nu,
                        })
                        .where(eq(schema.parameterValues.id, p.id));
                } else {
                    await tx.insert(schema.parameterValues).values({
                        id: crypto.randomUUID(),
                        targetId: objectId,
                        targetType: "object", // Verplicht veld volgens schema
                        parameterId: p.parameterId,
                        value: p.value,
                        isConfidential: Boolean(p.isConfidential),
                        validFrom: itemValidFrom,
                        validTo: p.validTo || null,
                        updatedAt: nu,
                    });
                }
            }
        }

        // 4. UITGAANDE RELATIES UPSERTEN (Source = objectId)
        if (payload.uitgaandeRelaties) {
            for (let index = 0; index < payload.uitgaandeRelaties.length; index++) {
                const rel = payload.uitgaandeRelaties[index];
                const volgorde = rel.volgorde !== undefined ? rel.volgorde : index + 1;
                const itemValidFrom = rel.validFrom || defaultValidFrom;

                if (rel.id) {
                    await tx
                        .update(schema.relationValues)
                        .set({
                            relationId: rel.relationId,
                            targetId: rel.targetId,
                            volgorde: volgorde,
                            isConfidential: Boolean(rel.isConfidential),
                            validFrom: itemValidFrom,
                            validTo: rel.validTo || null,
                            updatedAt: nu,
                        })
                        .where(eq(schema.relationValues.id, rel.id));
                } else {
                    await tx.insert(schema.relationValues).values({
                        id: rel.id || crypto.randomUUID(),
                        relationId: rel.relationId,
                        sourceId: objectId,
                        targetId: rel.targetId, // <--- Gewoon direct rel.targetId gebruiken!
                        volgorde: rel.volgorde ?? 0,
                        isConfidential: Boolean(rel.isConfidential),
                        validFrom: rel.validFrom || new Date().toISOString(),
                        validTo: rel.validTo || null,
                        updatedAt: new Date().toISOString(),
                    });
                }
            }
        }

        // 5. INGAANDE RELATIES UPSERTEN (Target = objectId)
        if (payload.inkomendeRelaties) {
            for (const rel of payload.inkomendeRelaties) {
                const itemValidFrom = rel.validFrom || defaultValidFrom;

                if (rel.id) {
                    await tx
                        .update(schema.relationValues)
                        .set({
                            relationId: rel.relationId,
                            sourceId: rel.sourceId,
                            isConfidential: Boolean(rel.isConfidential),
                            validFrom: itemValidFrom,
                            validTo: rel.validTo || null,
                            updatedAt: nu,
                        })
                        .where(eq(schema.relationValues.id, rel.id));
                } else {
                    await tx.insert(schema.relationValues).values({
                        id: crypto.randomUUID(),
                        relationId: rel.relationId,
                        sourceId: rel.sourceId,
                        targetId: objectId,
                        isConfidential: Boolean(rel.isConfidential),
                        validFrom: itemValidFrom,
                        validTo: rel.validTo || null,
                        updatedAt: nu,
                    });
                }
            }
        }

        return objectId;
    });
}