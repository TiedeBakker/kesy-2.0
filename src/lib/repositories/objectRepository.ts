// src/lib/repositories/objectRepository.ts
import { activeDb as db } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";

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

    // 2. Parameters
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

    // 3. Uitgaande relaties
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

    // 4. Inkomende relaties
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
            asc(relationDef.label),
            asc(sourceObject.label)
        );

    return {
        object,
        parameterValues,
        uitgaandeRelaties,
        inkomendeRelaties,
    };
}

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
            // Unieke UUIDv7 voor nieuw object
            objectId = uuidv7();
            await tx.insert(schema.objects).values({
                id: objectId,
                label: payload.label,
                isConfidential: Boolean(payload.isConfidential),
                validFrom: defaultValidFrom,
                validTo: payload.validTo || null,
                updatedAt: nu,
            });
        }

        // 2. SOFT-DELETES VOOR VERWIJDERDE ITEMS (Sync-engine voert later de hard-delete uit)
        if (payload.verwijderdeParameterValueIds && payload.verwijderdeParameterValueIds.length > 0) {
            await tx
                .update(schema.parameterValues)
                .set({
                    deletedAt: nu,
                    updatedAt: nu,
                })
                .where(inArray(schema.parameterValues.id, payload.verwijderdeParameterValueIds));
        }

        if (payload.verwijderdeRelationValueIds && payload.verwijderdeRelationValueIds.length > 0) {
            await tx
                .update(schema.relationValues)
                .set({
                    deletedAt: nu,
                    updatedAt: nu,
                })
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
                        id: uuidv7(),
                        targetId: objectId,
                        targetType: "object",
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

        // 4. UITGAANDE RELATIES UPSERTEN
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
                        id: rel.id || uuidv7(),
                        relationId: rel.relationId,
                        sourceId: objectId,
                        targetId: rel.targetId,
                        volgorde: volgorde,
                        isConfidential: Boolean(rel.isConfidential),
                        validFrom: itemValidFrom,
                        validTo: rel.validTo || null,
                        updatedAt: nu,
                    });
                }
            }
        }

        // 5. INGAANDE RELATIES UPSERTEN
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
                        id: uuidv7(),
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
