// app/import/actions.ts
"use server";

import { activeDb as db } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { eq, max } from "drizzle-orm";
import { ImportConfigHeader } from "@/src/lib/csvParser";
import { revalidatePath } from "next/cache";
import { v7 as uuidv7 } from "uuid";

const IS_OBJECTTYPE_RELATION_ID = "019fcdd3-721a-7512-b755-cddd67f43eb6";

export async function voerCsvImportUit({
  config,
  rows,
}: {
  config: ImportConfigHeader;
  rows: string[][];
}) {
  try {
    let uniekeDozenAangemaakt = 0;
    let uniekeDozenGevonden = 0;
    let specimengroepenAangemaakt = 0;

    const importIsConfidential = Boolean(config.isConfidential);
    const contextCache: Record<string, { id: string; isConfidential: boolean }> = {};

    // Cache om volgnummers per sourceId in te bewaren gedurende de transactie
    const volgordeTracker: Record<string, number> = {};

    await db.transaction(async (tx: any) => {
      const nu = new Date().toISOString();

      // Hulpfunctie om volgend volgnummer op te halen en op te hogen
      const getVolgendVolgnummer = async (sourceId: string): Promise<number> => {
        if (volgordeTracker[sourceId] === undefined) {
          const [bestaandeRelatie] = await tx
            .select({ maxVolgorde: max(schema.relationValues.volgorde) })
            .from(schema.relationValues)
            .where(eq(schema.relationValues.sourceId, sourceId));

          volgordeTracker[sourceId] = bestaandeRelatie?.maxVolgorde ?? 0;
        }

        volgordeTracker[sourceId] += 1;
        return volgordeTracker[sourceId];
      };

      for (const row of rows) {
        const rowContext: Record<string, { id: string; isConfidential: boolean }> = {};

        for (const stepConfig of config.steps) {
          if (stepConfig.target === "parent_object") {
            const label = stepConfig.labelTemplate.replace(/\{(\d+)\}/g, (_, index) => row[parseInt(index)] || "");
            const cacheKey = `${stepConfig.contextKey}_${label}`;

            let parentInfo = contextCache[cacheKey];

            if (!parentInfo) {
              const [bestaand] = await tx
                .select()
                .from(schema.objects)
                .where(eq(schema.objects.label, label));

              if (bestaand) {
                parentInfo = { id: bestaand.id, isConfidential: bestaand.isConfidential };
                uniekeDozenGevonden++;
              } else {
                const newParentId = uuidv7();

                // 1. Parent Object
                await tx.insert(schema.objects).values({
                  id: newParentId,
                  label: label,
                  isConfidential: importIsConfidential,
                  validFrom: nu,
                  updatedAt: nu,
                });

                // 2. Relatie "is objecttype" (met automatisch volgnummer)
                if (stepConfig.objectTypeId) {
                  const volgorde = await getVolgendVolgnummer(stepConfig.objectTypeId);

                  await tx.insert(schema.relationValues).values({
                    id: uuidv7(),
                    relationId: IS_OBJECTTYPE_RELATION_ID,
                    sourceId: stepConfig.objectTypeId,
                    targetId: newParentId,
                    volgorde: volgorde,
                    isConfidential: importIsConfidential,
                    validFrom: nu,
                    updatedAt: nu,
                  });
                }

                // 3. Parameters
                if (stepConfig.parameters) {
                  for (const param of stepConfig.parameters) {
                    const paramVal = row[param.column];
                    if (paramVal) {
                      await tx.insert(schema.parameterValues).values({
                        id: uuidv7(),
                        parameterId: param.parameterId,
                        targetId: newParentId,
                        targetType: "object",
                        value: paramVal,
                        isConfidential: importIsConfidential,
                        validFrom: nu,
                        updatedAt: nu,
                      });
                    }
                  }
                }

                parentInfo = { id: newParentId, isConfidential: importIsConfidential };
                uniekeDozenAangemaakt++;
              }

              contextCache[cacheKey] = parentInfo;
            }

            if (stepConfig.contextKey) {
              rowContext[stepConfig.contextKey] = parentInfo;
            }
          } else if (stepConfig.target === "child_object") {
            const label = stepConfig.labelTemplate.replace(/\{(\d+)\}/g, (_, index) => row[parseInt(index)] || "");
            const childId = uuidv7();
            const childIsConfidential = importIsConfidential;

            // 1. Child Object
            await tx.insert(schema.objects).values({
              id: childId,
              label: label,
              isConfidential: childIsConfidential,
              validFrom: nu,
              updatedAt: nu,
            });

            // 2. Relatie "is objecttype" (met automatisch volgnummer)
            if (stepConfig.objectTypeId) {
              const volgorde = await getVolgendVolgnummer(stepConfig.objectTypeId);

              await tx.insert(schema.relationValues).values({
                id: uuidv7(),
                relationId: IS_OBJECTTYPE_RELATION_ID,
                sourceId: stepConfig.objectTypeId,
                targetId: childId,
                volgorde: volgorde,
                isConfidential: childIsConfidential,
                validFrom: nu,
                updatedAt: nu,
              });
            }

            // 3. Hiërarchische relatie (zit in doos - met automatisch volgnummer)
            if (stepConfig.relations) {
              for (const rel of stepConfig.relations) {
                const parentInfo = rowContext[rel.relatedContextKey] || contextCache[`${rel.relatedContextKey}_${rel.relatedContextKey}`];
                if (parentInfo) {
                  const sourceId = rel.direction === "outgoing" ? parentInfo.id : childId;
                  const targetId = rel.direction === "outgoing" ? childId : parentInfo.id;
                  const relationIsConfidential = parentInfo.isConfidential || childIsConfidential;

                  const volgorde = await getVolgendVolgnummer(sourceId);

                  await tx.insert(schema.relationValues).values({
                    id: uuidv7(),
                    relationId: rel.relationTypeId,
                    sourceId: sourceId,
                    targetId: targetId,
                    volgorde: volgorde,
                    isConfidential: relationIsConfidential,
                    validFrom: nu,
                    updatedAt: nu,
                  });
                }
              }
            }

            // 4. Parameters
            if (stepConfig.parameters) {
              for (const param of stepConfig.parameters) {
                const paramVal = row[param.column];
                if (paramVal) {
                  await tx.insert(schema.parameterValues).values({
                    id: uuidv7(),
                    parameterId: param.parameterId,
                    targetId: childId,
                    targetType: "object",
                    value: String(paramVal),
                    isConfidential: childIsConfidential,
                    validFrom: nu,
                    updatedAt: nu,
                  });
                }
              }
            }

            specimengroepenAangemaakt++;
          }
        }
      }
    });

    revalidatePath("/");
    return {
      success: true,
      stats: {
        uniekeDozenAangemaakt,
        uniekeDozenGevonden,
        specimengroepenAangemaakt,
        totaalVerwerkteRegels: rows.length,
        isConfidential: importIsConfidential,
      },
    };
  } catch (err: any) {
    console.error("Import execution failed:", err);
    return { success: false, error: err.message || "Fout tijdens import." };
  }
}