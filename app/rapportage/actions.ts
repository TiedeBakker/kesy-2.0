"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { activeDb as db } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { eq, asc, and, isNull } from "drizzle-orm";

export interface ReportConfigLevel {
    level: number;
    relaties: "*" | string[];
    parameters: "*" | string[];
    headingTag?: "h1" | "h2" | "h3" | "h4" | "h5";
    weergaveType?: "lijst" | "tabel" | "template";
    titelTemplate?: string;
    tekstTemplate?: string;
}

export interface ReportConfig {
    id: string;
    naam: string;
    beschrijving?: string;
    levels: ReportConfigLevel[];
}

// Hulptype voor relaties
interface RelationItem {
    targetId: string;
    relationId: string;
    label: string;
}

// Hulptype voor parameters
interface ParameterItem {
    code: string;
    label: string;
    value: string;
    unit: string | null;
    parameterId: string;
}

export async function haalStuurbestandenOp(): Promise<ReportConfig[]> {
    try {
        const reportsDir = path.join(process.cwd(), "reports");
        const filenames = await fs.readdir(reportsDir);

        const configs: ReportConfig[] = [];
        for (const filename of filenames) {
            if (filename.endsWith(".json")) {
                const filePath = path.join(reportsDir, filename);
                const content = await fs.readFile(filePath, "utf-8");
                const parsed = JSON.parse(content) as ReportConfig;
                configs.push(parsed);
            }
        }
        return configs;
    } catch (error) {
        console.error("Fout bij ophalen stuurbestanden:", error);
        return [];
    }
}

export async function genereerRapport(
    startObjectId: string,
    config: ReportConfig
): Promise<{ success: boolean; html?: string; error?: string }> {
    try {
        const maxDepth = config.levels.length;

        // FASE 1: PRE-SCAN (Bepaal per object het MINIMALE/HOOGSTE niveau)
        const objectNiveauMap = new Map<string, number>();

        async function preScan(objectIds: string[], levelIndex: number) {
            if (objectIds.length === 0 || levelIndex >= maxDepth) return;

            const levelConfig = config.levels[levelIndex];
            const volgendeNiveauObjectIds: string[] = [];

            for (const id of objectIds) {
                if (!objectNiveauMap.has(id)) {
                    objectNiveauMap.set(id, levelIndex);
                }

                if (levelIndex + 1 < maxDepth) {
                    const uitgaandeRelaties = await db
                        .select({
                            targetId: schema.relationValues.targetId,
                            relationId: schema.relationValues.relationId,
                            label: schema.relations.label,
                        })
                        .from(schema.relationValues)
                        .innerJoin(schema.relations, eq(schema.relationValues.relationId, schema.relations.id))
                        .where(and(eq(schema.relationValues.sourceId, id), isNull(schema.relationValues.deletedAt)));

                    const isWildcard = levelConfig.relaties === "*" || (Array.isArray(levelConfig.relaties) && levelConfig.relaties.includes("*"));
                    let gefilterd = uitgaandeRelaties;

                    if (!isWildcard) {
                        const filters = Array.isArray(levelConfig.relaties)
                            ? levelConfig.relaties.map((r) => String(r).toLowerCase().trim())
                            : [String(levelConfig.relaties).toLowerCase().trim()];

                        gefilterd = uitgaandeRelaties.filter((rel: RelationItem) => {
                            const idMatch = rel.relationId ? filters.includes(String(rel.relationId).toLowerCase()) : false;
                            const labelMatch = rel.label ? filters.includes(rel.label.toLowerCase()) : false;
                            return idMatch || labelMatch;
                        });
                    }

                    for (const rel of gefilterd) {
                        volgendeNiveauObjectIds.push(rel.targetId);
                    }
                }
            }

            await preScan(volgendeNiveauObjectIds, levelIndex + 1);
        }

        await preScan([startObjectId], 0);

        // FASE 2: RENDEREN
        const renderedObjectIds = new Set<string>();

        async function verwerkNode(objectId: string, currentLevelIndex: number): Promise<string> {
            if (renderedObjectIds.has(objectId) || currentLevelIndex >= maxDepth) {
                return "";
            }

            const toegestaanNiveau = objectNiveauMap.get(objectId);
            if (toegestaanNiveau !== undefined && toegestaanNiveau < currentLevelIndex) {
                return "";
            }

            renderedObjectIds.add(objectId);
            const levelConfig = config.levels[currentLevelIndex];

            // 1. Fetch Object
            const [obj] = await db
                .select()
                .from(schema.objects)
                .where(and(eq(schema.objects.id, objectId), isNull(schema.objects.deletedAt)));

            if (!obj) return "";

            // 2. Fetch Parameters
            const paramsData = await db
                .select({
                    code: schema.parameters.code,
                    label: schema.parameters.label,
                    value: schema.parameterValues.value,
                    unit: schema.parameters.unit,
                    parameterId: schema.parameters.id,
                })
                .from(schema.parameterValues)
                .innerJoin(schema.parameters, eq(schema.parameterValues.parameterId, schema.parameters.id))
                .where(
                    and(
                        eq(schema.parameterValues.targetId, objectId),
                        eq(schema.parameterValues.targetType, "object"),
                        isNull(schema.parameterValues.validTo),
                        isNull(schema.parameterValues.deletedAt)
                    )
                );

            let gefilterdeParams = paramsData;
            if (Array.isArray(levelConfig.parameters)) {
                const filters = levelConfig.parameters.map((f) => String(f).toLowerCase().trim());
                gefilterdeParams = paramsData.filter((p: ParameterItem) => {
                    const codeMatch = p.code ? filters.includes(p.code.toLowerCase()) : false;
                    const labelMatch = p.label ? filters.includes(p.label.toLowerCase()) : false;
                    const idMatch = p.parameterId ? filters.includes(String(p.parameterId)) : false;
                    return codeMatch || labelMatch || idMatch;
                });
            }

            // 3. HTML Opbouw
            const headingTag = levelConfig.headingTag || "h2";
            let html = `<${headingTag}>${obj.label}</${headingTag}>\n`;

            if (gefilterdeParams.length > 0) {
                const weergave = levelConfig.weergaveType || "lijst";
                if (weergave === "tabel") {
                    html += `<table style="width:100%; border-collapse: collapse; margin-bottom: 1rem;">\n`;
                    html += `  <thead><tr style="border-bottom: 2px solid #475569; text-align: left;"><th style="padding: 6px;">Parameter</th><th style="padding: 6px;">Waarde</th><th style="padding: 6px;">Eenheid</th></tr></thead>\n`;
                    html += `  <tbody>\n`;
                    for (const p of gefilterdeParams) {
                        html += `    <tr style="border-bottom: 1px solid #334155;"><td style="padding: 6px;">${p.label}</td><td style="padding: 6px; font-weight: bold;">${p.value}</td><td style="padding: 6px; color: #94a3b8;">${p.unit || "-"}</td></tr>\n`;
                    }
                    html += `  </tbody></table>\n`;
                } else {
                    html += `<ul>\n`;
                    for (const p of gefilterdeParams) {
                        const unitText = p.unit ? ` ${p.unit}` : "";
                        html += `  <li><strong>${p.label}:</strong> ${p.value}${unitText}</li>\n`;
                    }
                    html += `</ul>\n`;
                }
            }

            // 4. Vervolgniveaus
            if (currentLevelIndex + 1 < maxDepth) {
                const uitgaandeRelaties = await db
                    .select({
                        targetId: schema.relationValues.targetId,
                        relationId: schema.relationValues.relationId,
                        label: schema.relations.label,
                    })
                    .from(schema.relationValues)
                    .innerJoin(schema.relations, eq(schema.relationValues.relationId, schema.relations.id))
                    .where(and(eq(schema.relationValues.sourceId, objectId), isNull(schema.relationValues.deletedAt)))
                    .orderBy(asc(schema.relationValues.volgorde));

                const isWildcard = levelConfig.relaties === "*" || (Array.isArray(levelConfig.relaties) && levelConfig.relaties.includes("*"));
                let gefilterd = uitgaandeRelaties;

                if (!isWildcard) {
                    const filters = Array.isArray(levelConfig.relaties)
                        ? levelConfig.relaties.map((r) => String(r).toLowerCase().trim())
                        : [String(levelConfig.relaties).toLowerCase().trim()];

                    gefilterd = uitgaandeRelaties.filter((rel: RelationItem) => {
                        const idMatch = rel.relationId ? filters.includes(String(rel.relationId).toLowerCase()) : false;
                        const labelMatch = rel.label ? filters.includes(rel.label.toLowerCase()) : false;
                        return idMatch || labelMatch;
                    });
                }

                let subHtml = "";
                for (const rel of gefilterd) {
                    subHtml += await verwerkNode(rel.targetId, currentLevelIndex + 1);
                }

                if (subHtml.trim().length > 0) {
                    html += `<blockquote style="margin-left: 1.5rem; padding-left: 0.5rem; border-left: 2px solid #475569;">\n`;
                    html += subHtml;
                    html += `</blockquote>\n`;
                }
            }

            return html;
        }

        const gegenereerdeHtml = await verwerkNode(startObjectId, 0);

        return {
            success: true,
            html: gegenereerdeHtml || `<p class="text-slate-400">Geen gegevens gevonden voor het geselecteerde object.</p>`,
        };
    } catch (error: any) {
        console.error("Fout bij verwerken rapportage:", error);
        return {
            success: false,
            error: error?.message || "Er is een fout opgetreden bij het genereren.",
        };
    }
}