// src/components/ObjectModal.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { haalObjectDossierOp, slaObjectDossierOp, haalDefinitiesOp } from "@/app/actions";

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
    const [nieuwUitgaandRelId, setNieuwUitgaandRelId] = useState("");
    const [nieuwUitgaandTargetId, setNieuwUitgaandTargetId] = useState("");

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
            setIsConfidential(false);
            setValidFrom(new Date().toISOString().split("T")[0]);
            setValidTo("");
            setParameterValues([]);
            setUitgaandeRelaties([]);
            setInkomendeRelaties([]);
            return;
        }

        let isMounted = true;
        async function laadDossier() {
            setLoading(true);
            setError(null);
            const res = await haalObjectDossierOp(objectId!);

            if (!isMounted) return;

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
        }

        laadDossier();

        return () => {
            isMounted = false;
        };
    }, [objectId, isOpen]);

    // Catalogus definities laden zodra we in 'edit' stand gaan
    useEffect(() => {
        if (isOpen && mode === "edit" && defParameters.length === 0) {
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
    }, [isOpen, mode, defParameters.length]);

    // Gegroepeerde data voor View-stand
    const ingaandGegroepeerd = useMemo(() => groepeerRelaties(inkomendeRelaties), [inkomendeRelaties]);
    const uitgaandGegroepeerd = useMemo(() => groepeerRelaties(uitgaandeRelaties), [uitgaandeRelaties]);

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

    const verwijderParameter = (index: number) => {
        const item = parameterValues[index];
        if (item.id) {
            setVerwijderdeParameterValueIds((prev) => [...prev, item.id]);
        }
        setParameterValues((prev) => prev.filter((_, i) => i !== index));
    };

    const voegUitgaandeRelatieToe = () => {
        if (!nieuwUitgaandRelId || !nieuwUitgaandTargetId) return;
        const relDef = defRelations.find((r) => r.id === nieuwUitgaandRelId);

        setUitgaandeRelaties((prev) => [
            ...prev,
            {
                relationId: nieuwUitgaandRelId,
                relationLabel: relDef?.label || "Relatie",
                targetId: nieuwUitgaandTargetId,         // <--- Zorgt dat repository exact targetId krijgt
                relatedObjectId: nieuwUitgaandTargetId,  // Voor UI navigatie
                relatedObjectLabel: nieuwUitgaandTargetId,
                isConfidential: false,
            },
        ]);
        setNieuwUitgaandRelId("");
        setNieuwUitgaandTargetId("");
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

        // Mappen zodat targetId ALTIJD gevuld is voor TypeScript/Database
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
            onClose();
        } else {
            setError(res.error || "Fout bij opslaan van het dossier");
            setSaving(false);
        }
    };


    // 2. PAS PASSIEVE RETURN ALS ER NIET GERENDERD HOEFT TE WORDEN (NA ALLES HOOKS!)
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

                {/* HEADER */}
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-[300px]">
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
                                <label className="flex items-center gap-1.5 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={isConfidential}
                                        onChange={(e) => setIsConfidential(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-800 text-sky-500"
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
                                    <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                                        {inkomendeRelaties.length}
                                    </span>
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
                                                            <div key={rel.relationValueId} className="p-2 bg-slate-800 rounded border border-slate-700/50 flex justify-between items-center text-xs">
                                                                <button onClick={() => onSelectObject && onSelectObject(rel.relatedObjectId)} className="font-medium text-slate-200 hover:text-sky-300 hover:underline text-left">
                                                                    {rel.relatedObjectLabel}
                                                                </button>
                                                                {rel.isConfidential && <span className="text-[10px]">🔒</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        inkomendeRelaties.map((rel, idx) => (
                                            <div key={idx} className="p-2 bg-slate-800/80 rounded border border-slate-700 text-xs flex justify-between items-center">
                                                <div>
                                                    <span className="text-sky-400 font-semibold block">{rel.relationLabel}</span>
                                                    <span className="text-slate-200">{rel.relatedObjectLabel}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* KOLOM 2: PARAMETERS */}
                            <div className="flex flex-col bg-slate-800/40 border border-slate-800 rounded-xl p-4 min-h-0">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                                        <span>📊</span> Eigenschappen & Parameters
                                    </h3>
                                    <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                                        {parameterValues.length}
                                    </span>
                                </div>

                                {mode === "edit" && (
                                    <div className="flex gap-1.5 mb-3">
                                        <select
                                            value={nieuwParamId}
                                            onChange={(e) => setNieuwParamId(e.target.value)}
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                                        >
                                            <option value="">+ Kies parameter...</option>
                                            {defParameters.map((p) => (
                                                <option key={p.id} value={p.id}>{p.label} ({p.code})</option>
                                            ))}
                                        </select>
                                        <button onClick={voegParameterToe} disabled={!nieuwParamId} className="px-2.5 py-1 bg-sky-600 disabled:opacity-40 text-white rounded text-xs font-semibold">
                                            Toevoegen
                                        </button>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[55vh]">
                                    {parameterValues.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic py-4 text-center">Geen parameters vastgelegd.</p>
                                    ) : (
                                        parameterValues.map((param, index) => (
                                            <div key={index} className="p-2 bg-slate-800 rounded border border-slate-700/60 text-xs space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[11px] font-semibold text-sky-400">{param.label}</span>
                                                    {mode === "edit" && (
                                                        <button onClick={() => verwijderParameter(index)} className="text-slate-500 hover:text-rose-400 text-xs">
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                                {mode === "edit" ? (
                                                    <div className="flex gap-1 items-center">
                                                        <input
                                                            type="text"
                                                            value={param.value || ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setParameterValues((prev) => {
                                                                    const copy = [...prev];
                                                                    copy[index] = { ...copy[index], value: val };
                                                                    return copy;
                                                                });
                                                            }}
                                                            placeholder="Waarde invoeren..."
                                                            className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-sky-500 outline-none"
                                                        />
                                                        {param.unit && <span className="text-[10px] text-slate-400">{param.unit}</span>}
                                                    </div>
                                                ) : (
                                                    <span className="font-semibold text-slate-100 block">
                                                        {param.value} {param.unit ? <span className="text-[10px] text-slate-400">{param.unit}</span> : ""}
                                                    </span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* KOLOM 3: UITGAAND */}
                            <div className="flex flex-col bg-slate-800/40 border border-slate-800 rounded-xl p-4 min-h-0">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                                        <span>🔗</span> Uitgaand (Netwerk & Relaties)
                                    </h3>
                                    <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full font-mono">
                                        {uitgaandeRelaties.length}
                                    </span>
                                </div>

                                {mode === "edit" && (
                                    <div className="space-y-1.5 mb-3 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                        <select
                                            value={nieuwUitgaandRelId}
                                            onChange={(e) => setNieuwUitgaandRelId(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                                        >
                                            <option value="">1. Kies relatietype...</option>
                                            {defRelations.map((r) => (
                                                <option key={r.id} value={r.id}>{r.label}</option>
                                            ))}
                                        </select>

                                        <input
                                            type="text"
                                            value={nieuwUitgaandTargetId}
                                            onChange={(e) => setNieuwUitgaandTargetId(e.target.value)}
                                            placeholder="2. Target Object ID..."
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                                        />

                                        <button
                                            onClick={voegUitgaandeRelatieToe}
                                            disabled={!nieuwUitgaandRelId || !nieuwUitgaandTargetId}
                                            className="w-full py-1 bg-emerald-600 disabled:opacity-40 text-white rounded text-xs font-semibold"
                                        >
                                            + Relatie Toevoegen
                                        </button>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[55vh]">
                                    {mode === "view" ? (
                                        Object.keys(uitgaandGegroepeerd).length === 0 ? (
                                            <p className="text-xs text-slate-500 italic py-4 text-center">Geen uitgaande relaties.</p>
                                        ) : (
                                            Object.entries(uitgaandGegroepeerd).map(([relType, rels]) => (
                                                <div key={relType} className="space-y-1.5">
                                                    <div className="flex items-center gap-2 border-b border-slate-700/60 pb-1">
                                                        <span className="text-[11px] font-bold uppercase text-emerald-400">{relType}</span>
                                                        <span className="text-[10px] text-slate-500 font-mono">({rels.length})</span>
                                                    </div>
                                                    <div className="space-y-1 pl-1">
                                                        {rels.map((rel: any) => (
                                                            <div key={rel.relationValueId} className="p-2 bg-slate-800 rounded border border-slate-700/50 flex justify-between items-center text-xs">
                                                                <button onClick={() => onSelectObject && onSelectObject(rel.relatedObjectId)} className="font-medium text-slate-200 hover:text-emerald-300 hover:underline text-left">
                                                                    ➔ {rel.relatedObjectLabel}
                                                                </button>
                                                                {rel.isConfidential && <span className="text-[10px]">🔒</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        uitgaandeRelaties.map((rel, index) => (
                                            <div key={index} className="p-2 bg-slate-800 rounded border border-slate-700/60 text-xs flex justify-between items-center">
                                                <div>
                                                    <span className="text-emerald-400 font-semibold block">{rel.relationLabel}</span>
                                                    <span className="text-slate-200">➔ {rel.relatedObjectLabel || rel.targetId}</span>
                                                </div>
                                                <button onClick={() => verwijderUitgaandeRelatie(index)} className="text-slate-500 hover:text-rose-400">
                                                    🗑️
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                        </div>
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
        </div>
    );
}
