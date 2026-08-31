"use server";

import fs from "fs";
import path from "path";
import { activeDb as db } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { eq, inArray, like } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

// Bepaal het basispad voor DArchieven (controleer C-schijf en T-schijf)
function getDArchievenBasePath(): string {
    const primaryPath = "C:\\WAMP\\www\\DArchieven";
    const fallbackPath = "T:\\DArchieven";

    if (fs.existsSync(primaryPath)) return primaryPath;
    if (fs.existsSync(fallbackPath)) return fallbackPath;
    return primaryPath; // Default fallback
}

/**
 * 1. Haal de mappenstructuur op onder DArchieven
 */
// export async function haalDArchievenMappenOp(): Promise<{ success: boolean; mappen?: string[]; error?: string }> {
//     try {
//         const basePath = getDArchievenBasePath();
//         if (!fs.existsSync(basePath)) {
//             return { success: false, error: `Map niet gevonden op schijf: ${basePath}` };
//         }

//         const mappen: string[] = [];

//         function scanDir(currentPath: string, relativePath: string = "") {
//             const items = fs.readdirSync(currentPath, { withFileTypes: true });
//             for (const item of items) {
//                 if (item.isDirectory()) {
//                     const subRel = relativePath ? `${relativePath}/${item.name}` : item.name;
//                     mappen.push(subRel);
//                     scanDir(path.join(currentPath, item.name), subRel);
//                 }
//             }
//         }

//         scanDir(basePath);
//         mappen.sort();
//         return { success: true, mappen };
//     } catch (err: any) {
//         return { success: false, error: err.message || "Fout bij ophalen mappen." };
//     }
// }
/**
 * 1. Haal alle submappen op binnen een specifieke (relatieve) map.
 */
export async function haalSubmappenOp(relatiefPad: string = ""): Promise<{ success: boolean; mappen?: string[]; error?: string }> {
    try {
        const basePath = getDArchievenBasePath();
        const targetFolder = relatiefPad ? path.join(basePath, relatiefPad.replace(/\//g, "\\")) : basePath;

        if (!fs.existsSync(targetFolder)) {
            return { success: false, error: `Map niet gevonden: ${relatiefPad}` };
        }

        const items = fs.readdirSync(targetFolder, { withFileTypes: true });
        const submappen = items
            .filter((item) => item.isDirectory())
            .map((item) => item.name)
            .sort();

        return { success: true, mappen: submappen };
    } catch (err: any) {
        return { success: false, error: err.message || "Fout bij ophalen mappen." };
    }
}

/**
 * 2. Haal bestanden op in een specifieke submap + geef aan of ze al gekoppeld zijn in de DB
 */
export async function haalBestandenOpInSubmap(submap: string): Promise<{
  success: boolean;
  bestanden?: { fileName: string; fullUrl: string; isGekoppeld: boolean }[];
  error?: string;
}> {
  try {
    const basePath = getDArchievenBasePath();
    const targetFolder = submap ? path.join(basePath, submap.replace(/\//g, "\\")) : basePath;

    if (!fs.existsSync(targetFolder)) {
      return { success: false, error: "Geselecteerde map bestaat niet." };
    }

    const files = fs.readdirSync(targetFolder, { withFileTypes: true });
    const fileItems = files.filter((f) => f.isFile());

    const documentParamId = "01a01502-63bb-73a3-89bb-43ecc89c2201";

    // Haal alle al gekoppelde URL-waarden op voor de parameter 'Digitaal beschikbaar document'
    const bestaandeParameters = await db
      .select({ value: schema.parameterValues.value })
      .from(schema.parameterValues)
      .where(eq(schema.parameterValues.parameterId, documentParamId));

    // Expliciet type toegevoegd aan (p: { value: string }) om TS7006 op te lossen
    const gekoppeldeUrlsSet = new Set(
      bestaandeParameters.map((p: { value: string }) => p.value.toLowerCase())
    );

    const result = fileItems.map((f) => {
      const relPath = submap ? `${submap}/${f.name}` : f.name;
      const fullUrl = `http://localhost/DArchieven/${relPath}`;
      const isGekoppeld = gekoppeldeUrlsSet.has(fullUrl.toLowerCase());

      return {
        fileName: f.name,
        fullUrl,
        isGekoppeld,
      };
    });

    return { success: true, bestanden: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Fout bij ophalen bestanden." };
  }
}
export interface MaakDocumentObjectPayload {
    label: string;
    isConfidential: boolean;
    documentType: "boek" | "notitie";
    fileUrl: string;
    titel?: string;
    ondertitel?: string;
    toelichting?: string;
}

/**
 * 11. Sla het nieuwe document-object op met relatie en optionele parameters
 */
export async function maakDocumentObjectAan(payload: MaakDocumentObjectPayload) {
    try {
        const nu = new Date().toISOString();
        const newObjectId = uuidv7();

        // ID Constantificatie uit de specificatie
        const IS_OBJECTTYPE_RELATION_ID = "019fcdd3-721a-7512-b755-cddd67f43eb6";
        const BOEK_OBJECTTYPE_ID = "019fcd20-b1ae-703f-9f24-4ec5fb070853";
        const DOCUMENT_OBJECTTYPE_ID = "01a048b4-df70-74ef-a765-1a5e222e0e2a";

        const PARAM_DOCUMENT = "01a01502-63bb-73a3-89bb-43ecc89c2201";
        const PARAM_TITEL = "019fc8a4-acc9-70a9-942c-102b841e80a4";
        const PARAM_ONDERTITEL = "019fc8a4-e6ff-7426-a21c-ad228f031ad2";
        const PARAM_TOELICHTING = "019fc74c-cf8c-74ff-a3b6-b6d21c651a19";

        // 1. Maak Object aan
        await db.insert(schema.objects).values({
            id: newObjectId,
            label: payload.label,
            isConfidential: payload.isConfidential,
            validFrom: nu,
            updatedAt: nu,
        });

        // 2. Maak Ingaande Relatie aan (nieuwe object is target)
        const sourceTypeId = payload.documentType === "boek" ? BOEK_OBJECTTYPE_ID : DOCUMENT_OBJECTTYPE_ID;

        await db.insert(schema.relationValues).values({
            id: uuidv7(),
            relationId: IS_OBJECTTYPE_RELATION_ID,
            sourceId: sourceTypeId,
            targetId: newObjectId,
            isConfidential: payload.isConfidential,
            validFrom: nu,
            updatedAt: nu,
        });

        // 3. Voeg Parameter Digitaal beschikbaar document toe
        const paramInsertions = [
            {
                id: uuidv7(),
                parameterId: PARAM_DOCUMENT,
                targetId: newObjectId,
                targetType: "object",
                value: payload.fileUrl,
                isConfidential: payload.isConfidential,
                validFrom: nu,
                updatedAt: nu,
            },
        ];

        // 4. Optionele parameters toevoegen als ze ingevuld zijn
        if (payload.titel && payload.titel.trim() !== "") {
            paramInsertions.push({
                id: uuidv7(),
                parameterId: PARAM_TITEL,
                targetId: newObjectId,
                targetType: "object",
                value: payload.titel.trim(),
                isConfidential: payload.isConfidential,
                validFrom: nu,
                updatedAt: nu,
            });
        }

        if (payload.ondertitel && payload.ondertitel.trim() !== "") {
            paramInsertions.push({
                id: uuidv7(),
                parameterId: PARAM_ONDERTITEL,
                targetId: newObjectId,
                targetType: "object",
                value: payload.ondertitel.trim(),
                isConfidential: payload.isConfidential,
                validFrom: nu,
                updatedAt: nu,
            });
        }

        if (payload.toelichting && payload.toelichting.trim() !== "") {
            paramInsertions.push({
                id: uuidv7(),
                parameterId: PARAM_TOELICHTING,
                targetId: newObjectId,
                targetType: "object",
                value: payload.toelichting.trim(),
                isConfidential: payload.isConfidential,
                validFrom: nu,
                updatedAt: nu,
            });
        }

        await db.insert(schema.parameterValues).values(paramInsertions);

        return { success: true, objectId: newObjectId };
    } catch (err: any) {
        return { success: false, error: err.message || "Fout bij opslaan document-object." };
    }
}