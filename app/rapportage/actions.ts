"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { activeDb as db } from "@/src/lib/db";
import * as schema from "@/src/db/schema";
import { eq, asc, and, isNull, sql } from "drizzle-orm";
import puppeteer from "puppeteer";

export interface ReportConfigLevel {
    level: number;
    relaties?: "*" | string[];
    parameters?: "*" | string[];
    queryTemplate?: string;
    headingTag?: "h1" | "h2" | "h3" | "h4" | "h5" | "p";
    weergaveType?: "lijst" | "tabel" | "template";
    titelTemplate?: string;
    tekstTemplate?: string;
    pageBreakBefore?: boolean;
    toonNummering?: boolean;
}

export interface ReportConfigInhoudsopgave {
    tonen: boolean;
    maxDiepte?: number; // 0 = alleen level 0, 1 = level 0 + 1, etc.
    titel?: string;
    pageBreakAfter?: boolean;
}

export interface ReportConfig {
    id: string;
    naam: string;
    beschrijving?: string;
    toonNummering?: boolean;
    weergaveStijl?: "boek" | "boom";
    inhoudsopgave?: ReportConfigInhoudsopgave;
    levels: ReportConfigLevel[];
}

interface TocItem {
    id: string;
    label: string;
    nummering: string;
    levelIndex: number;
    headingTag: string;
}
interface RelationItem {
    targetId: string;
    relationId: string;
    label: string;
}

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

        // Controleer of de map bestaat, zo niet: maak hem aan
        try {
            await fs.access(reportsDir);
        } catch {
            await fs.mkdir(reportsDir, { recursive: true });
            return [];
        }

        const filenames = await fs.readdir(reportsDir);
        const configs: ReportConfig[] = [];

        for (const filename of filenames) {
            if (filename.endsWith(".json")) {
                const filePath = path.join(reportsDir, filename);
                const content = await fs.readFile(filePath, "utf-8");
                try {
                    const parsed = JSON.parse(content) as ReportConfig;
                    configs.push(parsed);
                } catch (jsonErr) {
                    console.error(`Fout bij het parsen van JSON-bestand ${filename}:`, jsonErr);
                }
            }
        }
        return configs;
    } catch (error) {
        console.error("Fout bij ophalen stuurbestanden:", error);
        return [];
    }
}
/**
 * GENERATOR STRATEGIE 1: SQL-driven verwerking
 */
async function genereerRapportViaSql(
    startObjectId: string,
    config: ReportConfig
): Promise<string> {
    const maxDepth = config.levels.length;
    const tocItems: TocItem[] = [];

    function vulQueryIn(query: string, contextParams: Record<string, any>): string {
        let opgebouwdeQuery = query;
        for (const [sleutel, waarde] of Object.entries(contextParams)) {
            const regex = new RegExp(`:${sleutel}\\b`, "g");
            const veiligeWaarde = typeof waarde === "string" ? `'${waarde.replace(/'/g, "''")}'` : waarde;
            opgebouwdeQuery = opgebouwdeQuery.replace(regex, veiligeWaarde);
        }
        return opgebouwdeQuery;
    }

    function vulTemplateIn(template: string, row: Record<string, any>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => row[key] ?? "");
    }

    async function verwerkSqlNiveau(
        currentLevelIndex: number,
        parentRowContext: Record<string, any>,
        nummeringPad: number[] = []
    ): Promise<string> {
        if (currentLevelIndex >= maxDepth) return "";

        const levelConfig = config.levels[currentLevelIndex];
        if (!levelConfig.queryTemplate) return "";

        const context = { startId: startObjectId, ...parentRowContext };
        const gevuldeSql = vulQueryIn(levelConfig.queryTemplate, context);

        const resultaat = await db.run(sql.raw(gevuldeSql));
        const rows: Record<string, any>[] = (resultaat as any).rows || resultaat || [];

        if (rows.length === 0) return "";

        let niveauHtml = "";
        let childIndex = 1;

        const levelToonNummering = levelConfig.toonNummering ?? config.toonNummering ?? true;

        for (const row of rows) {
            const huidigeRijContext = { ...parentRowContext, ...row };

            const subNummering = levelToonNummering ? [...nummeringPad, childIndex] : nummeringPad;
            const nummerStr = levelToonNummering ? `${subNummering.join(".")}. ` : "";

            const headingTag = levelConfig.headingTag || "h2";
            const pageBreakStyle = levelConfig.pageBreakBefore ? "style='page-break-before: always;'" : "";

            const titelTekst = levelConfig.titelTemplate
                ? vulTemplateIn(levelConfig.titelTemplate, huidigeRijContext)
                : row.Header1 || row.Header2 || row.Header3 || row.label || row.title || "";

            // Unieke Anker ID maken voor TOC / Hyperlink
            const anchorId = `toc-sec-${currentLevelIndex}-${subNummering.join("-") || childIndex}`;

            // Voeg toe aan TOC als niveau binnen maxDiepte valt
            const maxDiepte = config.inhoudsopgave?.maxDiepte ?? maxDepth;
            if (config.inhoudsopgave?.tonen && currentLevelIndex <= maxDiepte && titelTekst) {
                tocItems.push({
                    id: anchorId,
                    label: titelTekst,
                    nummering: nummerStr,
                    levelIndex: currentLevelIndex,
                    headingTag: headingTag,
                });
            }

            niveauHtml += `<div class="rapport-sectie" ${pageBreakStyle}>\n`;
            if (titelTekst) {
                niveauHtml += `  <${headingTag} id="${anchorId}">${nummerStr}${titelTekst}</${headingTag}>\n`;
            }

            if (levelConfig.tekstTemplate) {
                const tekst = vulTemplateIn(levelConfig.tekstTemplate, huidigeRijContext);
                niveauHtml += `  <p>${tekst}</p>\n`;
            }

            if (levelConfig.weergaveType === "tabel") {
                const kolommen = Object.keys(row).filter((k) => !k.startsWith("Id") && !k.startsWith("Header"));
                if (kolommen.length > 0) {
                    niveauHtml += `<table style="width:100%; border-collapse: collapse; margin-bottom: 1rem;"><thead><tr>`;
                    for (const k of kolommen) niveauHtml += `<th style="text-align:left; padding:6px; border-bottom: 2px solid #475569;">${k}</th>`;
                    niveauHtml += `</tr></thead><tbody><tr>`;
                    for (const k of kolommen) niveauHtml += `<td style="padding:6px; border-bottom: 1px solid #334155;">${row[k] ?? "-"}</td>`;
                    niveauHtml += `</tr></tbody></table>`;
                }
            }

            if (currentLevelIndex + 1 < maxDepth) {
                const subHtml = await verwerkSqlNiveau(currentLevelIndex + 1, huidigeRijContext, subNummering);
                if (subHtml.trim().length > 0) {
                    if (config.weergaveStijl === "boek") {
                        niveauHtml += subHtml;
                    } else {
                        niveauHtml += `<blockquote style="margin-left: 1.5rem; padding-left: 0.75rem; border-left: 2px solid #cbd5e1;">\n`;
                        niveauHtml += subHtml;
                        niveauHtml += `</blockquote>\n`;
                    }
                }
            }

            niveauHtml += `</div>\n`;
            if (levelToonNummering) {
                childIndex++;
            }
        }

        return niveauHtml;
    }

    const startNummering = config.levels[0]?.toonNummering === false ? [] : [1];
    const hoofdInhoud = await verwerkSqlNiveau(0, {}, startNummering);

    // Bouw Inhoudsopgave-HTML op indien gewenst
    let tocHtml = "";
    if (config.inhoudsopgave?.tonen && tocItems.length > 0) {
        const tocTitel = config.inhoudsopgave.titel || "Inhoudsopgave";
        const pageBreakToc = config.inhoudsopgave.pageBreakAfter ? "style='page-break-after: always; margin-bottom: 2rem;'" : "style='margin-bottom: 2rem;'";

        tocHtml += `<div class="inhoudsopgave-container" ${pageBreakToc}>\n`;
        tocHtml += `  <h1 class="toc-hoofdtitel" style="border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 16px;">${tocTitel}</h1>\n`;
        tocHtml += `  <ul style="list-style: none; padding-left: 0; margin: 0;">\n`;

        for (const item of tocItems) {
            const inspringing = item.levelIndex * 1.25; // inspringing in rem per niveau
            tocHtml += `    <li style="margin-bottom: 6px; padding-left: ${inspringing}rem;">\n`;
            tocHtml += `      <a href="#${item.id}" style="text-decoration: none; color: #0284c7; display: flex; justify-content: space-between; align-items: baseline;" class="toc-link">\n`;
            tocHtml += `        <span style="font-weight: ${item.levelIndex === 0 ? 'bold' : 'normal'};">\n`;
            tocHtml += `          ${item.nummering}${item.label}\n`;
            tocHtml += `        </span>\n`;
            tocHtml += `        <span class="toc-dots" style="flex-grow: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 8px;"></span>\n`;
            tocHtml += `      </a>\n`;
            tocHtml += `    </li>\n`;
        }

        tocHtml += `  </ul>\n`;
        tocHtml += `</div>\n`;
    }

    return tocHtml + hoofdInhoud;
}
/**
 * GENERATOR STRATEGIE 2: Relationele ORM verwerking (Oude stuurbestanden)
 */
async function genereerRapportViaRelaties(
    startObjectId: string,
    config: ReportConfig
): Promise<string> {
    const maxDepth = config.levels.length;

    // FASE 1: PRE-SCAN
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

                const isWildcard = !levelConfig.relaties || levelConfig.relaties === "*" || (Array.isArray(levelConfig.relaties) && levelConfig.relaties.includes("*"));
                let gefilterd = uitgaandeRelaties;

                if (!isWildcard && levelConfig.relaties) {
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

    async function verwerkNode(
        objectId: string,
        currentLevelIndex: number,
        nummeringPad: number[] = []
    ): Promise<string> {
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
        const nummerStr = config.toonNummering ? `${nummeringPad.join(".")}. ` : "";
        const headingTag = levelConfig.headingTag || "h2";
        const pageBreakStyle = levelConfig.pageBreakBefore ? "style='page-break-before: always;'" : "";

        let html = `<div class="rapport-sectie" ${pageBreakStyle}>\n`;
        html += `  <${headingTag}>${nummerStr}${obj.label}</${headingTag}>\n`;

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

            const isWildcard = !levelConfig.relaties || levelConfig.relaties === "*" || (Array.isArray(levelConfig.relaties) && levelConfig.relaties.includes("*"));
            let gefilterd = uitgaandeRelaties;

            if (!isWildcard && levelConfig.relaties) {
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
            let childIndex = 1;
            for (const rel of gefilterd) {
                const subNummering = [...nummeringPad, childIndex];
                const childContent = await verwerkNode(rel.targetId, currentLevelIndex + 1, subNummering);
                if (childContent.trim().length > 0) {
                    subHtml += childContent;
                    childIndex++;
                }
            }

            if (subHtml.trim().length > 0) {
                if (config.weergaveStijl === "boek") {
                    // Geen extra marge of blockquote: strak onder elkaar
                    html += subHtml;
                } else {
                    // Standaard inspringen voor boomstructuur/dossier
                    html += `<blockquote style="margin-left: 1.5rem; padding-left: 0.5rem; border-left: 2px solid #475569;">\n`;
                    html += subHtml;
                    html += `</blockquote>\n`;
                }
            }
        }

        html += `</div>\n`;
        return html;
    }

    return await verwerkNode(startObjectId, 0, [1]);
}

/**
 * HOOFDFUNCTIE MET AUTOMATISCHE DETECTIE
 */
export async function genereerRapport(
    startObjectId: string,
    config: ReportConfig
): Promise<{ success: boolean; html?: string; error?: string }> {
    try {
        // Detecteer of minimaal één niveau een queryTemplate bevat
        const isSqlDriven = config.levels.some((level) => Boolean(level.queryTemplate));

        let html = "";
        if (isSqlDriven) {
            html = await genereerRapportViaSql(startObjectId, config);
        } else {
            html = await genereerRapportViaRelaties(startObjectId, config);
        }

        return {
            success: true,
            html: html || `<p class="text-slate-400">Geen gegevens gevonden voor het geselecteerde object.</p>`,
        };
    } catch (error: any) {
        console.error("Fout bij verwerken rapportage:", error);
        return {
            success: false,
            error: error?.message || "Er is een fout opgetreden bij het genereren van het rapport.",
        };
    }
}

export async function genereerPdfRapport(
    startObjectId: string,
    config: ReportConfig
): Promise<{ success: boolean; pdfBase64?: string; error?: string }> {
    try {
        const resultaat = await genereerRapport(startObjectId, config);
        if (!resultaat.success || !resultaat.html) {
            return { success: false, error: resultaat.error || "Geen HTML gegenereerd." };
        }

        const volledigeHtml = `
            <!DOCTYPE html>
            <html lang="nl">
            <head>
                <meta charset="UTF-8">
                <title>${config.naam}</title>
                <style>
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        padding: 10px;
                        color: #0f172a;
                        background-color: #ffffff;
                        line-height: 1.5;
                    }
                    header {
                        margin-bottom: 20px;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 10px;
                    }
                    header h1 {
                        margin: 0;
                        font-size: 24px;
                        color: #0f172a;
                    }
                    header p {
                        color: #64748b;
                        margin: 4px 0 0 0;
                        font-size: 14px;
                    }
                    .inhoudsopgave-container {
                        margin-bottom: 2rem;
                    }
                    .toc-hoofdtitel {
                        font-size: 20px;
                        font-weight: bold;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 6px;
                        margin-bottom: 16px;
                    }
                    .toc-link {
                        color: #0284c7 !important;
                        text-decoration: none !important;
                        display: flex;
                        justify-content: space-between;
                        align-items: baseline;
                    }
                    .toc-dots {
                        flex-grow: 1;
                        border-bottom: 1px dotted #cbd5e1;
                        margin: 0 8px;
                    }
                    .rapport-sectie {
                        margin-bottom: 1rem;
                    }
                    blockquote {
                        margin-left: 1.5rem;
                        padding-left: 0.75rem;
                        border-left: 2px solid #cbd5e1;
                        margin-top: 0.5rem;
                        margin-bottom: 0.5rem;
                    }
                    h1 { font-size: 22px; font-weight: bold; margin-top: 1.25rem; margin-bottom: 0.5rem; color: #0f172a; }
                    h2 { font-size: 18px; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: #1e293b; }
                    h3 { font-size: 15px; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.5rem; color: #334155; }
                    h4 { font-size: 14px; font-weight: 500; margin-top: 0.5rem; color: #475569; }
                    p { font-size: 13px; color: #334155; margin-top: 0; margin-bottom: 0.5rem; }
                    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; margin-bottom: 1rem; font-size: 13px; }
                    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
                    th { background-color: #f8fafc; font-weight: 600; color: #334155; }
                    @page { margin: 15mm; }
                </style>
            </head>
            <body>
                <header>
                    <h1>${config.naam}</h1>
                    ${config.beschrijving ? `<p>${config.beschrijving}</p>` : ""}
                </header>
                <main>
                    ${resultaat.html}
                </main>
            </body>
            </html>
        `;

        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        
       await page.setContent(volledigeHtml, { waitUntil: "domcontentloaded" });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `<div></div>`,
            footerTemplate: `
                <div style="font-size: 9px; color: #94a3b8; width: 100%; text-align: right; padding-right: 15mm;">
                    Pagina <span class="pageNumber"></span> van <span class="totalPages"></span>
                </div>
            `,
            margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
        });

        await browser.close();

        return {
            success: true,
            pdfBase64: Buffer.from(pdfBuffer).toString("base64"),
        };
    } catch (error: any) {
        console.error("Fout bij genereren PDF:", error);
        return {
            success: false,
            error: error?.message || "Er is een fout opgetreden bij het genereren van de PDF.",
        };
    }
}