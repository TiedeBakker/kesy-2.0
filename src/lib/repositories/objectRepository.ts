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
            dataType: paramDef.dataType,
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
}
export async function saveObjectDossier(payload: SaveObjectPayload) {
    const nu = new Date().toISOString();
    const defaultValidFrom = payload.validFrom || nu;

    let objectId = payload.id;

    if (objectId) {
        // Alleen de stamgegevens van het object bijwerken
        await db
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
        // Nieuw object aanmaken met een unieke UUIDv7
        objectId = uuidv7();
        await db.insert(schema.objects).values({
            id: objectId,
            label: payload.label,
            isConfidential: Boolean(payload.isConfidential),
            validFrom: defaultValidFrom,
            validTo: payload.validTo || null,
            updatedAt: nu,
        });
    }

    return objectId;
}