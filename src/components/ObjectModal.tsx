// src/components/ObjectModal.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { haalObjectDossierOp, slaObjectDossierOp, haalDefinitiesOp, verplaatsRelatieVolgorde } from "@/app/actions";
import AddRelationModal from "./AddRelationModal";
import BatchAddObjectsModal from "@/src/components/BatchAddObjectsModal";
import EditRelationModal from "@/src/components/EditRelationModal";
import AddParameterValuesModal from "@/src/components/AddParameterValuesModal";
import EditParameterValueModal from "./EditParameterValueModal";

interface ObjectModalProps {
    objectId: string | null;
    isOpen: boolean;
    initialMode?: "view" | "edit";
    onClose: () => void;
    onSelectObject?: (newObjectId: string) => void;
    onSaveSuccess?: () => void;
}

function groepeerRelaties(relaties: any[]) {
    return relaties.reduce((acc: Record<string, any[]>, rel) => {
        const key = rel.relationLabel || "Overig";
        if (!acc[key]) acc[key] = [];
        acc[key].push(rel);
        return acc;
    }, {});
}



export default function ObjectModal({
    objectId,
    isOpen,
    initialMode = "view",
    onClose,
    onSelectObject,
    onSaveSuccess,
}: ObjectModalProps) {
    const isVercel = process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined || process.env.VERCEL !== undefined;
    // 1. ALLE HOOKS WORDEN VERPLICHT BOVENAAN GEDECLAREERD
    const [mode, setMode] = useState<"view" | "edit">("view");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);


    // Stamgegevens State
    const [label, setLabel] = useState("");
    const [isConfidential, setIsConfidential] = useState(false);
    const [validFrom, setValidFrom] = useState("");
    const [validTo, setValidTo] = useState("");

    // Items State
    const [parameterValues, setParameterValues] = useState<any[]>([]);
    const [uitgaandeRelaties, setUitgaandeRelaties] = useState<any[]>([]);
    const [inkomendeRelaties, setInkomendeRelaties] = useState<any[]>([]);

    // Verwijder-trackers
    const [verwijderdeParameterValueIds, setVerwijderdeParameterValueIds] = useState<string[]>([]);
    const [verwijderdeRelationValueIds, setVerwijderdeRelationValueIds] = useState<string[]>([]);

    // Catalogus-data
    const [defParameters, setDefParameters] = useState<any[]>([]);
    const [defRelations, setDefRelations] = useState<any[]>([]);

    // Nieuwe item selectors state
    const [nieuwParamId, setNieuwParamId] = useState("");

    // Modals state
    const [isAddRelModalOpen, setIsAddRelModalOpen] = useState(false);
    const [addRelDirection, setAddRelDirection] = useState<"incoming" | "outgoing">("outgoing");
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [editingRelation, setEditingRelation] = useState<any | null>(null);

    // 📊 Nieuwe Parameter Modal State
    const [isParamModalOpen, setIsParamModalOpen] = useState(false);

    // Functie voor het ophalen/verversen van het dossier
    const laadDossier = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        const res = await haalObjectDossierOp(id);

        if (res.success && res.dossier) {
            const d = res.dossier;
            setLabel(d.object.label || "");
            setIsConfidential(Boolean(d.object.isConfidential));
            setValidFrom(d.object.validFrom ? d.object.validFrom.split("T")[0] : "");
            setValidTo(d.object.validTo ? d.object.validTo.split("T")[0] : "");

            setParameterValues(d.parameterValues || []);
            setUitgaandeRelaties(d.uitgaandeRelaties || []);
            setInkomendeRelaties(d.inkomendeRelaties || []);
        } else {
            setError(res.error || "Fout bij ophalen dossier");
        }
        setLoading(false);
    }, []);

    // Reset/Instellen van modus zodra modal opent of object veranderd
    useEffect(() => {
        if (isOpen) {
            setMode(objectId ? initialMode : "edit");
        }
    }, [isOpen, objectId, initialMode]);

    // Dossier Laden bij openen/wijzigen van objectId
    useEffect(() => {
        if (!isOpen) return;

        if (!objectId) {
            // Leeg formulier instellen voor NIEUW object
            setLabel("");
            // 🎯 Lokaal standaard op TRUE, op Vercel gegarandeerd op FALSE
            setIsConfidential(isVercel ? false : true);
            setValidFrom(new Date().toISOString().split("T")[0]);
            setValidTo("");
            setParameterValues([]);
            setUitgaandeRelaties([]);
            setInkomendeRelaties([]);
            return;
        }

        laadDossier(objectId);
    }, [objectId, isOpen, laadDossier, isVercel]);
    // Haal catalogus definities op zodra de modal OPEN is
    useEffect(() => {
        if (isOpen && defRelations.length === 0) {
            let isMounted = true;
            async function laadCatalogi() {
                const res = await haalDefinitiesOp();
                if (res.success && isMounted) {
                    setDefParameters(res.parameters || []);
                    setDefRelations(res.relations || []);
                }
            }
            laadCatalogi();
            return () => {
                isMounted = false;
            };
        }
    }, [isOpen, defRelations.length]);

    // Gegroepeerde data voor View-stand
    const ingaandGegroepeerd = useMemo(() => groepeerRelaties(inkomendeRelaties), [inkomendeRelaties]);

    // 📊 TWEEDELING PARAMETERS: Geldige eigenschappen vs Meetwaarden/Historie
    const { geldigeEigenschappen, meetwaarden } = useMemo(() => {
        const geldige: any[] = [];
        const metingen: any[] = [];

        parameterValues.forEach((param) => {
            const isMeting = param.isMeetwaarde || (param.validFrom && param.validTo && param.validFrom === param.validTo);
            const isInactief = Boolean(param.validTo);

            if (isMeting || isInactief) {
                metingen.push(param);
            } else {
                geldige.push(param);
            }
        });

        return { geldigeEigenschappen: geldige, meetwaarden: metingen };
    }, [parameterValues]);

    // --- ACTIES VOOR EDITING ---
    const voegParameterToe = () => {
        if (!nieuwParamId) return;
        const def = defParameters.find((p) => p.id === nieuwParamId);
        if (!def) return;

        setParameterValues((prev) => [
            ...prev,
            {
                parameterId: def.id,
                label: def.label,
                unit: def.unit,
                value: "",
                isConfidential: false,
            },
        ]);
        setNieuwParamId("");
    };

    const verwijderParameter = (paramIdToRemove: string, originalIndex?: number) => {
        if (originalIndex !== undefined) {
            const item = parameterValues[originalIndex];
            if (item && item.id) {
                setVerwijderdeParameterValueIds((prev) => [...prev, item.id]);
            }
            setParameterValues((prev) => prev.filter((_, i) => i !== originalIndex));
        }
    };

    const verwijderUitgaandeRelatie = (index: number) => {
        const item = uitgaandeRelaties[index];
        if (item.relationValueId || item.id) {
            setVerwijderdeRelationValueIds((prev) => [
                ...prev,
                item.relationValueId || item.id,
            ]);
        }
        setUitgaandeRelaties((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!label.trim()) {
            setError("Label is verplicht.");
            return;
        }

        setSaving(true);
        setError(null);

        const genormaliseerdeUitgaandeRelaties = uitgaandeRelaties.map((rel) => ({
            ...rel,
            targetId: rel.targetId || rel.relatedObjectId,
        }));

        const payload = {
            id: objectId || undefined,
            label,
            isConfidential,
            validFrom: validFrom || null,
            validTo: validTo || null,
            parameterValues,
            uitgaandeRelaties: genormaliseerdeUitgaandeRelaties,
            inkomendeRelaties,
            verwijderdeParameterValueIds,
            verwijderdeRelationValueIds,
        };

        const res = await slaObjectDossierOp(payload);
        if (res.success) {
            setSaving(false);

            if (onSaveSuccess) onSaveSuccess();

            if (objectId) {
                await laadDossier(objectId);
                setMode("view");
            } else {
                onClose();
            }
        } else {
            setError(res.error || "Fout bij opslaan van het dossier");
            setSaving(false);
        }
    };

    const handleVerplaatsRelatie = async (relationValueId: string, richting: "omhoog" | "omlaag") => {
        const res = await verplaatsRelatieVolgorde({ relationValueId, richting });
        if (res.success && objectId) {
            laadDossier(objectId);
        } else if (res.error) {
            setError(res.error);
        }
    };

    const renderParameterCard = (param: any, originalIndex: number) => (
        <div key={param.id || originalIndex} className="p-2 bg-slate-800 rounded border border-slate-700/60 text-xs space-y-1">

            {/* HEADER: LABEL & BEWERK/VERWIJDER KNOPPEN */}
            <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-sky-400">{param.label}</span>
                <div className="flex items-center gap-1">
                    {param.id && (
                        <button
                            type="button"
                            onClick={() => setEditingParameterValue(param)}
                            className="text-slate-400 hover:text-sky-400 text-xs px-1"
                            title="Parameterwaarde bewerken"
                        >
                            ✏️
                        </button>
                    )}
                    {mode === "edit" && (
                        <button
                            type="button"
                            onClick={() => verwijderParameter(param.id, originalIndex)}
                            className="text-slate-500 hover:text-rose-400 text-xs px-1"
                            title="Verwijderen"
                        >
                            🗑️
                        </button>
                    )}
                </div>
            </div>

            {/* CONTENT: EDIT MODUS VS VIEW MODUS */}
            {mode === "edit" ? (
                <div className="flex gap-1 items-center">
                    <input
                        type="text"
                        value={param.value || ""}
                        onChange={(e) => {
                            const val = e.target.value;
                            setParameterValues((prev) => {
                                const copy = [...prev];
                                copy[originalIndex] = { ...copy[originalIndex], value: val };
                                return copy;
                            });
                        }}
                        placeholder="Waarde invoeren..."
                        className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-sky-500 outline-none"
                    />
                    {param.unit && <span className="text-[10px] text-slate-400">{param.unit}</span>}
                </div>
            ) : (
                <div className="flex justify-between items-baseline">
    {/* WEERGAVE WANNEER HET EEN BESTAND/FILE IS */}
    {param.dataType === "file" ? (
        <div className="flex flex-col gap-2 w-full pt-1">
            {(() => {
                const rawValue = param.value || "";

                // 1. VOORBEREIDING & SCHOONMAAK VAN PADEN
                const isFullUrl = rawValue.startsWith("http://") || rawValue.startsWith("https://");

                let cleanPath = rawValue;
                if (isFullUrl && rawValue.includes("localhost/")) {
                    cleanPath = rawValue.split("localhost/")[1];
                }

                // Controleer of het een DArchieven (document) of Media bestand betreft
                const isDArchief = /^DArchieven[\\/]/i.test(cleanPath) || rawValue.includes("/DArchieven/");

                // Strip schijfletters, voorliggende slashes en mapnamen om een zuiver relatief pad te krijgen
                const relPad = cleanPath
                    .replace(/^[a-zA-Z]:[\\/]/, "")
                    .replace(/^DArchieven[\\/]/i, "")
                    .replace(/^Media[\\/]/i, "")
                    .replace(/\\/g, "/")
                    .replace(/^\//, "");

                // 2. DUBBELE URLS OPBOUWEN (PRIMARY = C-SCHIJF VIA WAMP, FALLBACK = T-SCHIJF VIA WAMP ALIAS)
                let primaryUrl = rawValue;
                let fallbackUrl = rawValue;

                if (!isFullUrl || rawValue.includes("localhost")) {
                    if (isDArchief) {
                        primaryUrl = `http://localhost/DArchieven/${relPad}`;
                        fallbackUrl = `http://localhost/darchieven-archive/${relPad}`;
                    } else {
                        primaryUrl = `http://localhost/media/${relPad}`;
                        fallbackUrl = `http://localhost/media-archive/${relPad}`;
                    }
                }

                // Type checks voor rendering
                const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(rawValue);
                const isVideo = /\.(mp4|webm|mkv|mov)$/i.test(rawValue);
                const isPdf = /\.pdf$/i.test(rawValue);

                // Fallback voor afbeeldingen/video's op C-schijf
                const handleMediaError = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
                    const target = e.currentTarget;
                    if (target.src !== fallbackUrl) {
                        target.src = fallbackUrl;
                    }
                };

                // Slimme open-functie voor de actieknop en documenten
                const openBestand = async () => {
                    if (isFullUrl && !rawValue.includes("localhost")) {
                        window.open(rawValue, "_blank");
                        return;
                    }

                    try {
                        // Snelle HEAD check of het bestand lokaal op C-schijf staat
                        const res = await fetch(primaryUrl, { method: "HEAD" });
                        if (res.ok) {
                            window.open(primaryUrl, "_blank");
                            return;
                        }
                    } catch {
                        // PC/WAMP niet bereikbaar of 404
                    }

                    // Val terug op T-schijf alias
                    window.open(fallbackUrl, "_blank");
                };

                return (
                    <>
                        {/* MEDIA / PDF PREVIEW */}
                        {rawValue && (
                            <div className="relative rounded-lg overflow-hidden bg-slate-950 border border-slate-700 max-h-56 flex items-center justify-center p-1">
                                {isImage && (
                                    <img
                                        src={primaryUrl}
                                        alt={param.label}
                                        onError={handleMediaError}
                                        className="object-contain max-h-52 w-full hover:scale-105 transition-transform duration-200"
                                        loading="lazy"
                                    />
                                )}

                                {isVideo && (
                                    <video
                                        controls
                                        preload="metadata"
                                        onError={handleMediaError}
                                        className="max-h-52 w-full rounded"
                                    >
                                        <source src={primaryUrl} />
                                        <source src={fallbackUrl} />
                                        Je browser ondersteunt deze videospeler niet.
                                    </video>
                                )}

                                {isPdf && (
                                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                                        <span className="text-3xl">📄</span>
                                        <span className="text-xs text-slate-300 font-medium">PDF Document</span>
                                        <button
                                            type="button"
                                            onClick={openBestand}
                                            className="text-[10px] text-sky-400 hover:underline font-mono"
                                        >
                                            Bekijk PDF in nieuw tabblad ↗
                                        </button>
                                    </div>
                                )}

                                {!isImage && !isVideo && !isPdf && (
                                    <div className="p-4 text-center text-slate-500 font-mono text-[11px]">
                                        📎 Bestand: {rawValue.split("/").pop()}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* BESTANDSINFO & SLIMME ACTIEKNOP */}
                        <div className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded border border-slate-700/60">
                            <span className="font-mono text-[10px] text-slate-300 truncate flex-1" title={rawValue}>
                                {rawValue}
                            </span>

                            <button
                                type="button"
                                onClick={openBestand}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-semibold transition shrink-0 shadow"
                            >
                                🌐 Openen
                            </button>
                        </div>
                    </>
                );
            })()}
        </div>
    ) : (
        /* WEERGAVE VOOR STANDAARD DATATYPES */
        <span className="font-semibold text-slate-100 truncate pr-2">
            {param.value} {param.unit ? <span className="text-[10px] text-slate-400">{param.unit}</span> : ""}
        </span>
    )}

    {/* GELDIGHEIDSDATUM (INDIEN AANWEZIG) */}
    {param.validFrom && (
        <span className="text-[9px] text-slate-500 font-mono">
            {param.validFrom.split("T")[0]}
        </span>
    )}
</div>
            )}
        </div>
    );
    const [editingParameterValue, setEditingParameterValue] = useState<any | null>(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

                {/* HEADER */}
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-75">
                        <span className="text-2xl">{mode === "edit" ? "✏️" : "📦"}</span>
                        <div className="flex-1">
                            {mode === "edit" ? (
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="Objectnaam / Label..."
                                    className="w-full px-3 py-1.5 bg-slate-950 border border-sky-500/50 focus:border-sky-400 rounded-lg text-slate-100 text-lg font-bold outline-none"
                                />
                            ) : (
                                <h2 className="text-xl font-bold text-slate-100">
                                    {loading ? "Laden..." : label || "Object Dossier"}
                                </h2>
                            )}
                            {objectId && (
                                <p className="text-xs font-mono text-slate-400 mt-0.5">ID: {objectId}</p>
                            )}
                        </div>
                    </div>

                    {/* DATUMS & VERTROUWELIJK */}
                    <div className="flex items-center gap-3 text-xs">
                        {mode === "edit" ? (
                            <>
                                <label className={`flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700 ${isVercel ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
                                    <input
                                        type="checkbox"
                                        checked={isConfidential}
                                        disabled={isVercel} // 🎯 Voorkom dat vertrouwelijk gekozen kan worden op Vercel
                                        onChange={(e) => setIsConfidential(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-800 text-sky-500 disabled:cursor-not-allowed"
                                    />
                                    <span className={isConfidential ? "text-rose-400 font-bold" : "text-slate-300"}>
                                        {isConfidential ? "🔒 Vertrouwelijk" : "🔓 Publiek"}
                                    </span>
                                </label>
                                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-700">
                                    <input
                                        type="date"
                                        value={validFrom}
                                        onChange={(e) => setValidFrom(e.target.value)}
                                        className="bg-transparent text-slate-200 outline-none"
                                    />
                                    <span className="text-slate-500">t/m</span>
                                    <input
                                        type="date"
                                        value={validTo}
                                        onChange={(e) => setValidTo(e.target.value)}
                                        className="bg-transparent text-slate-200 outline-none"
                                    />
                                </div>
                            </>
                        ) : (
                            !loading && (
                                <>
                                    <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                                        <span className="text-slate-400 block text-[10px]">Vertrouwelijkheid</span>
                                        <span className={isConfidential ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                                            {isConfidential ? "🔒 Vertrouwelijk" : "🔓 Publiek"}
                                        </span>
                                    </div>
                                    <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                                        <span className="text-slate-400 block text-[10px]">Geldigheid</span>
                                        <span className="font-mono text-slate-200">
                                            {validFrom || "-"} t/m {validTo || "heden"}
                                        </span>
                                    </div>
                                </>
                            )
                        )}

                        {/* ACTION BUTTONS */}
                        {mode === "view" ? (
                            <button
                                onClick={() => setMode("edit")}
                                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-xs transition flex items-center gap-1"
                            >
                                ✏️ Bewerken
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition flex items-center gap-1 disabled:opacity-50"
                            >
                                {saving ? "Opslaan..." : "💾 Opslaan"}
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition text-lg"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* ERROR BANNER */}
                {error && (
                    <div className="mx-6 mt-4 p-3 bg-rose-950/80 border border-rose-700 text-rose-200 rounded-lg text-xs flex justify-between items-center">
                        <span>⚠️ {error}</span>
                        <button onClick={() => setError(null)} className="text-rose-400 font-bold">✕</button>
                    </div>
                )}

                {/* BODY - 3 KOLOMMEN LAYOUT */}
                <div className="p-6 flex-1 overflow-hidden">
                    {loading ? (
                        <div className="py-20 text-center text-slate-400">
                            Dossier-gegevens ophalen uit SQLite...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">

                            {/* KOLOM 1: INGAAND */}
                            <div className="flex flex-col bg-slate-800/40 border border-slate-800 rounded-xl p-4 min-h-0">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                                        <span>🏷️</span> Ingaand (Typen & Context)
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setAddRelDirection("incoming");
                                                setIsAddRelModalOpen(true);
                                            }}
                                            className="text-[11px] bg-slate-700 hover:bg-emerald-600 text-slate-200 hover:text-white px-2 py-0.5 rounded transition"
                                        >
                                            + Relatie
                                        </button>
                                        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                                            {inkomendeRelaties.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[55vh]">
                                    {mode === "view" ? (
                                        Object.keys(ingaandGegroepeerd).length === 0 ? (
                                            <p className="text-xs text-slate-500 italic py-4 text-center">Geen ingaande relaties.</p>
                                        ) : (
                                            Object.entries(ingaandGegroepeerd).map(([relType, rels]) => (
                                                <div key={relType} className="space-y-1.5">
                                                    <div className="flex items-center gap-2 border-b border-slate-700/60 pb-1">
                                                        <span className="text-[11px] font-bold uppercase text-sky-400">{relType}</span>
                                                        <span className="text-[10px] text-slate-500 font-mono">({rels.length})</span>
                                                    </div>

                                                    <div className="space-y-1 pl-1">
                                                        {rels.map((rel: any) => (
                                                            <div
                                                                key={rel.relationValueId || rel.id}
                                                                className="p-2 bg-slate-800 rounded border border-slate-700/50 flex justify-between items-center text-xs gap-2 hover:border-slate-600 transition"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onSelectObject && onSelectObject(rel.relatedObjectId)}
                                                                    className="font-medium text-slate-200 hover:text-sky-300 hover:underline text-left truncate flex-1 min-w-0"
                                                                >
                                                                    ➔ {rel.relatedObjectLabel}
                                                                </button>

                                                                {rel.isConfidential && <span className="text-[10px]" title="Vertrouwelijk">🔒</span>}

                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingRelation(rel)}
                                                                    className="text-slate-400 hover:text-sky-400 p-1 rounded transition"
                                                                    title="Relatie bewerken"
                                                                >
                                                                    ✏️
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        inkomendeRelaties.length === 0 ? (
                                            <p className="text-xs text-slate-500 italic py-4 text-center">Geen ingaande relaties.</p>
                                        ) : (
                                            inkomendeRelaties.map((rel, idx) => (
                                                <div
                                                    key={rel.relationValueId || rel.id || idx}
                                                    className="p-2 bg-slate-800/80 rounded border border-slate-700 text-xs flex justify-between items-center gap-2"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sky-400 font-semibold block truncate">
                                                            {rel.relationLabel}
                                                        </span>
                                                        <span className="text-slate-200 truncate block">
                                                            ➔ {rel.relatedObjectLabel}
                                                        </span>
                                                    </div>

                                                    {rel.isConfidential && <span className="text-[10px]">🔒</span>}

                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingRelation(rel)}
                                                        className="text-slate-400 hover:text-sky-400 p-1 rounded transition"
                                                        title="Relatie bewerken"
                                                    >
                                                        ✏️
                                                    </button>
                                                </div>
                                            ))
                                        )
                                    )}
                                </div>
                            </div>

                            {/* KOLOM 2: PARAMETERS (GESPLITST IN EIGENSCHAPPEN & MEETWAARDEN) */}
                            <div className="flex flex-col bg-slate-800/40 border border-slate-800 rounded-xl p-4 min-h-0 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                                        <span>📊</span> Eigenschappen & Parameters
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {objectId && (
                                            <button
                                                type="button"
                                                onClick={() => setIsParamModalOpen(true)}
                                                className="text-[11px] bg-slate-700 hover:bg-emerald-600 text-slate-200 hover:text-white px-2 py-0.5 rounded transition"
                                                title="Invoeren via Sets of Losse Parameters"
                                            >
                                                + Parameters
                                            </button>
                                        )}
                                        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                                            {parameterValues.length}
                                        </span>
                                    </div>
                                </div>

                                {mode === "edit" && (
                                    <div className="flex gap-1.5">
                                        <select
                                            value={nieuwParamId}
                                            onChange={(e) => setNieuwParamId(e.target.value)}
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                                        >
                                            <option value="">+ Kies losse parameter...</option>
                                            {defParameters.map((p) => (
                                                <option key={p.id} value={p.id}>{p.label} ({p.code})</option>
                                            ))}
                                        </select>
                                        <button onClick={voegParameterToe} disabled={!nieuwParamId} className="px-2.5 py-1 bg-sky-600 disabled:opacity-40 text-white rounded text-xs font-semibold">
                                            Toevoegen
                                        </button>
                                    </div>
                                )}

                                {/* SECTIE 1: GELDIGE EIGENSCHAPPEN */}
                                <div className="flex flex-col flex-1 min-h-0">
                                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-1 mb-1.5">
                                        <span className="text-[11px] font-bold uppercase text-sky-400">Geldige Eigenschappen</span>
                                        <span className="text-[10px] text-slate-400 font-mono">({geldigeEigenschappen.length})</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[22vh]">
                                        {geldigeEigenschappen.length === 0 ? (
                                            <p className="text-xs text-slate-500 italic py-2 text-center">Geen actieve eigenschappen.</p>
                                        ) : (
                                            geldigeEigenschappen.map((param) => {
                                                const originalIdx = parameterValues.findIndex((p) => p === param);
                                                return renderParameterCard(param, originalIdx);
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* SECTIE 2: MEETWAARDEN & HISTORIE */}
                                <div className="flex flex-col flex-1 min-h-0 border-t border-slate-800 pt-2">
                                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-1 mb-1.5">
                                        <span className="text-[11px] font-bold uppercase text-amber-400">Meetwaarden & Historie</span>
                                        <span className="text-[10px] text-slate-400 font-mono">({meetwaarden.length})</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[22vh]">
                                        {meetwaarden.length === 0 ? (
                                            <p className="text-xs text-slate-500 italic py-2 text-center">Geen meetwaarden vastgelegd.</p>
                                        ) : (
                                            meetwaarden.map((param) => {
                                                const originalIdx = parameterValues.findIndex((p) => p === param);
                                                return renderParameterCard(param, originalIdx);
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* KOLOM 3: UITGAAND */}
                            <div className="flex flex-col bg-slate-800/40 border border-slate-800 rounded-xl p-4 min-h-0">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                                        <span>🔗</span> Uitgaand (Netwerk & Relaties)
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setAddRelDirection("outgoing");
                                                setIsAddRelModalOpen(true);
                                            }}
                                            className="text-[11px] bg-slate-700 hover:bg-emerald-600 text-slate-200 hover:text-white px-2 py-0.5 rounded transition"
                                        >
                                            + Relatie
                                        </button>
                                        {objectId && (
                                            <button
                                                type="button"
                                                onClick={() => setIsBatchModalOpen(true)}
                                                className="text-[11px] bg-sky-950 border border-sky-700/80 hover:bg-sky-800 text-sky-200 px-2 py-0.5 rounded transition"
                                                title="Batch nieuwe objecten maken en koppelen"
                                            >
                                                📚 + Batch
                                            </button>
                                        )}
                                        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                                            {uitgaandeRelaties.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[55vh]">
                                    {uitgaandeRelaties.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic py-4 text-center">Geen uitgaande relaties.</p>
                                    ) : (
                                        uitgaandeRelaties.map((rel, index) => {
                                            const isEerste = index === 0;
                                            const isLaatste = index === uitgaandeRelaties.length - 1;
                                            const relId = rel.relationValueId || rel.id;

                                            return (
                                                <div
                                                    key={relId || index}
                                                    className="p-2 bg-slate-800 rounded border border-slate-700/60 text-xs flex justify-between items-center gap-2 group hover:border-slate-600 transition"
                                                >
                                                    <div className="flex flex-col gap-0.5 border-r border-slate-700/80 pr-1.5">
                                                        <button
                                                            type="button"
                                                            disabled={isEerste}
                                                            onClick={() => relId && handleVerplaatsRelatie(relId, "omhoog")}
                                                            className="text-[9px] leading-none text-slate-400 hover:text-emerald-400 disabled:opacity-20 disabled:hover:text-slate-400 px-1 py-0.5 rounded hover:bg-slate-700 transition"
                                                            title="Eén plek naar boven"
                                                        >
                                                            ▲
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isLaatste}
                                                            onClick={() => relId && handleVerplaatsRelatie(relId, "omlaag")}
                                                            className="text-[9px] leading-none text-slate-400 hover:text-emerald-400 disabled:opacity-20 disabled:hover:text-slate-400 px-1 py-0.5 rounded hover:bg-slate-700 transition"
                                                            title="Eén plek naar beneden"
                                                        >
                                                            ▼
                                                        </button>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-emerald-400 font-semibold block truncate">
                                                            {rel.relationLabel}
                                                        </span>
                                                        {mode === "view" ? (
                                                            <button
                                                                onClick={() => onSelectObject && onSelectObject(rel.relatedObjectId)}
                                                                className="text-slate-200 hover:text-emerald-300 hover:underline truncate block text-left"
                                                            >
                                                                ➔ {rel.relatedObjectLabel || rel.targetId}
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-300 truncate block">
                                                                ➔ {rel.relatedObjectLabel || rel.targetId}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingRelation(rel)}
                                                        className="text-slate-400 hover:text-sky-400 p-1 rounded"
                                                        title="Relatie bewerken"
                                                    >
                                                        ✏️
                                                    </button>
                                                    {mode === "edit" && (
                                                        <button
                                                            onClick={() => verwijderUitgaandeRelatie(index)}
                                                            className="text-slate-500 hover:text-rose-400 p-1 rounded"
                                                            title="Relatie verwijderen"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                        </div>
                    )}

                    {/* MODAL COMPONENTEN */}
                    <AddRelationModal
                        isOpen={isAddRelModalOpen}
                        onClose={() => setIsAddRelModalOpen(false)}
                        currentObjectId={objectId!}
                        direction={addRelDirection}
                        availableRelationTypes={defRelations}
                        onSuccess={() => {
                            if (objectId) laadDossier(objectId);
                        }}
                    />

                    {objectId && (
                        <BatchAddObjectsModal
                            isOpen={isBatchModalOpen}
                            onClose={() => setIsBatchModalOpen(false)}
                            sourceObjectId={objectId!}
                            onSuccess={() => laadDossier(objectId!)}
                        />
                    )}

                    <EditRelationModal
                        isOpen={Boolean(editingRelation)}
                        onClose={() => setEditingRelation(null)}
                        relationValue={editingRelation}
                        availableRelationTypes={defRelations}
                        onSuccess={() => {
                            if (objectId) laadDossier(objectId);
                        }}
                    />

                    {/* 📊 BATCH PARAMETER WAARDEN MODAL */}
                    {objectId && (
                        <AddParameterValuesModal
                            isOpen={isParamModalOpen}
                            onClose={() => setIsParamModalOpen(false)}
                            targetId={objectId}
                            targetType="object"
                            targetLabel={label}
                            onSuccess={() => laadDossier(objectId)}
                        />
                    )}
                </div>

                {/* FOOTER */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-800/30 flex justify-between items-center text-xs text-slate-500">
                    <span>
                        {mode === "edit"
                            ? "Pas de velden aan en klik op Opslaan om het dossier bij te werken."
                            : "Klik op een gerelateerd object om direct door te navigeren."}
                    </span>
                    <div className="flex gap-2">
                        {mode === "edit" && objectId && (
                            <button onClick={() => setMode("view")} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg">
                                Annuleren
                            </button>
                        )}
                        <button onClick={onClose} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg">
                            Sluiten
                        </button>
                    </div>
                </div>

            </div>
            <EditParameterValueModal
                isOpen={Boolean(editingParameterValue)}
                onClose={() => setEditingParameterValue(null)}
                parameterValue={editingParameterValue}
                onSuccess={() => {
                    if (objectId) laadDossier(objectId);
                }}
            />
        </div>

    );
}