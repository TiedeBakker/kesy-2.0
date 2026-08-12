// src/components/BatchAddObjectsModal.tsx
"use client";

import { useState, useEffect } from "react";
import { haalDefinitiesOp, batchMakenEnKoppelen } from "@/app/actions";

interface BatchAddObjectsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceObjectId: string;
    onSuccess: () => void;
}

export default function BatchAddObjectsModal({
    isOpen,
    onClose,
    sourceObjectId,
    onSuccess,
}: BatchAddObjectsModalProps) {
    const [relationTypes, setRelationTypes] = useState<any[]>([]);
    const [selectedRelationId, setSelectedRelationId] = useState("");

    // Generator instellingen
    const [prefixPattern, setPrefixPattern] = useState("Boek {n}");
    const [aantal, setAantal] = useState(5);
    const [startNummer, setStartNummer] = useState(1);

    // De bewerkbare lijst met gegenereerde namen
    const [generatedLabels, setGeneratedLabels] = useState<string[]>([]);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Relatietypen laden bij openen
    useEffect(() => {
        if (!isOpen) return;

        async function laadTypes() {
            const res = await haalDefinitiesOp();
            if (res.success && res.relations) {
                setRelationTypes(res.relations);
                if (res.relations.length > 0) {
                    setSelectedRelationId(res.relations[0].id);
                }
            }
        }
        laadTypes();
    }, [isOpen]);

    // Genereer de voorlopige lijst van labels op basis van pattern & aantal
    const genereerLijst = () => {
        const nieuw: string[] = [];
        for (let i = 0; i < aantal; i++) {
            const num = startNummer + i;
            // Vervang {n} door het nummer, of plak het nummer er achter als {n} er niet in staat
            const label = prefixPattern.includes("{n}")
                ? prefixPattern.replace("{n}", String(num))
                : `${prefixPattern} ${num}`;
            nieuw.push(label);
        }
        setGeneratedLabels(nieuw);
    };

    // Hergenereer automatisch als pattern, aantal of startnummer verandert
    useEffect(() => {
        if (isOpen) {
            genereerLijst();
        }
    }, [prefixPattern, aantal, startNummer, isOpen]);

    // Bewerk een individueel label in de preview-lijst
    const handleLabelChange = (index: number, newText: string) => {
        const bijgewerkt = [...generatedLabels];
        bijgewerkt[index] = newText;
        setGeneratedLabels(bijgewerkt);
    };

    const handleSubmit = async () => {
        if (!selectedRelationId) {
            setError("Selecteer een relatietype.");
            return;
        }
        if (generatedLabels.length === 0) {
            setError("Geen objecten om aan te maken.");
            return;
        }

        setSaving(true);
        setError(null);

        const res = await batchMakenEnKoppelen({
            sourceId: sourceObjectId,
            relationId: selectedRelationId,
            objectLabels: generatedLabels,
        });

        if (res.success) {
            setSaving(false);
            onSuccess();
            onClose();
        } else {
            setError(res.error || "Fout bij batch-toevoegen");
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
                
                {/* HEADER */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <span>📚</span>
                        <span>Batch Objecten Aanmaken & Koppelen</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
                </div>

                {error && (
                    <div className="p-2.5 bg-rose-950/80 border border-rose-700 text-rose-200 rounded text-xs">
                        ⚠️ {error}
                    </div>
                )}

                {/* RELATIETYPE STAP */}
                <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold block">1. Kies Relatietype</label>
                    <select
                        value={selectedRelationId}
                        onChange={(e) => setSelectedRelationId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    >
                        {relationTypes.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label} ({r.code || r.id})
                            </option>
                        ))}
                    </select>
                </div>

                {/* GENERATOR INSTELLINGEN */}
                <div className="grid grid-cols-3 gap-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                    <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 block">Naam-patroon ({'{n}'} = nr)</label>
                        <input
                            type="text"
                            value={prefixPattern}
                            onChange={(e) => setPrefixPattern(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-100 font-mono"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 block">Aantal items</label>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            value={aantal}
                            onChange={(e) => setAantal(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-100 font-mono"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 block">Startnummer</label>
                        <input
                            type="number"
                            value={startNummer}
                            onChange={(e) => setStartNummer(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-100 font-mono"
                        />
                    </div>
                </div>

                {/* EDITEERBARE PREVIEW LIJST */}
                <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-semibold block flex justify-between">
                        <span>2. Controleer & Fine-tune Objectnamen ({generatedLabels.length})</span>
                        <span className="text-[11px] text-slate-500 font-normal">Pas hier de namen aan voor opslaan</span>
                    </label>

                    <div className="max-h-52 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1.5">
                        {generatedLabels.map((label, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-500 w-6 text-right">
                                    #{idx + 1}
                                </span>
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => handleLabelChange(idx, e.target.value)}
                                    className="flex-1 bg-slate-900 border border-slate-800 focus:border-sky-500 rounded px-2 py-1 text-xs text-slate-200"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* FOOTER ACTIONS */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                    >
                        Annuleren
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || generatedLabels.length === 0}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-40"
                    >
                        {saving ? "Aanmaken & Koppelen..." : `Maak ${generatedLabels.length} Objecten Aan`}
                    </button>
                </div>

            </div>
        </div>
    );
}