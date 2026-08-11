// src/components/AddRelationModal.tsx
"use client";

import { useState, useEffect } from "react";
import { haalDefinitiesOp, zoekObjecten, voegRelatieToe } from "@/app/actions";

interface AddRelationModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentObjectId: string;
    direction: "outgoing" | "incoming";
    availableRelationTypes?: any[];
    onSuccess: () => void;
}

export default function AddRelationModal({
    isOpen,
    onClose,
    currentObjectId,
    direction,
    availableRelationTypes = [],
    onSuccess,
}: AddRelationModalProps) {
    const [relationTypes, setRelationTypes] = useState<any[]>(availableRelationTypes);
    const [selectedRelationId, setSelectedRelationId] = useState("");
    
    // Zoek & Filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedTargetId, setSelectedTargetId] = useState("");
    const [selectedTargetLabel, setSelectedTargetLabel] = useState("");
    
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync of ophalen van relatietypen bij openen
    useEffect(() => {
        if (!isOpen) return;

        // Reset velden bij openen
        setSearchQuery("");
        setSearchResults([]);
        setSelectedTargetId("");
        setSelectedTargetLabel("");
        setSelectedRelationId("");
        setError(null);

        if (availableRelationTypes && availableRelationTypes.length > 0) {
            setRelationTypes(availableRelationTypes);
        } else {
            async function laadTypes() {
                const res = await haalDefinitiesOp();
                if (res.success && res.relations) {
                    setRelationTypes(res.relations);
                }
            }
            laadTypes();
        }
    }, [isOpen, availableRelationTypes]);

    // Live zoeken/filteren van objecten op basis van zoekterm
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            const res = await zoekObjecten(searchQuery);
            if (res.success) {
                // Filter het huidige object uit de zoekresultaten
                const gefilterd = (res.objecten || []).filter((o: any) => o.id !== currentObjectId);
                setSearchResults(gefilterd);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [searchQuery, currentObjectId]);

    const handleSubmit = async () => {
        if (!selectedRelationId || !selectedTargetId) {
            setError("Selecteer een relatietype en een gerelateerd object.");
            return;
        }

        setSaving(true);
        setError(null);

        const sourceId = direction === "outgoing" ? currentObjectId : selectedTargetId;
        const targetId = direction === "outgoing" ? selectedTargetId : currentObjectId;

        const res = await voegRelatieToe({
            relationId: selectedRelationId,
            sourceId,
            targetId,
        });

        if (res.success) {
            setSaving(false);
            onSuccess();
            onClose();
        } else {
            setError(res.error || "Fout bij toevoegen van relatie");
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const isOutgoing = direction === "outgoing";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                
                {/* HEADER */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <span>{isOutgoing ? "🔗" : "🏷️"}</span>
                        <span>{isOutgoing ? "Uitgaande Relatie Toevoegen" : "Ingaande Relatie Toevoegen"}</span>
                    </h3>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                    >
                        ✕
                    </button>
                </div>

                {/* ERROR BANNER */}
                {error && (
                    <div className="p-2.5 bg-rose-950/80 border border-rose-700 text-rose-200 rounded text-xs flex justify-between items-center">
                        <span>⚠️ {error}</span>
                        <button onClick={() => setError(null)} className="text-rose-400 font-bold">✕</button>
                    </div>
                )}

                {/* STEP 1: RELATIE TYPE SELECTOR */}
                <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-semibold block">
                        1. Selecteer Relatietype
                    </label>
                    <select
                        value={selectedRelationId}
                        onChange={(e) => setSelectedRelationId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-sky-500 transition"
                    >
                        <option value="">-- Kies een relatietype uit de lijst --</option>
                        {relationTypes.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label} ({r.code || r.id})
                            </option>
                        ))}
                    </select>
                </div>

                {/* STEP 2: ZOEKEN & SELECTEREN BRON/DOEL OBJECT */}
                <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-semibold block">
                        2. Zoek {isOutgoing ? "Doel Object (uitgaand)" : "Bron Object (ingaand)"}
                    </label>
                    
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (selectedTargetId) {
                                    setSelectedTargetId("");
                                    setSelectedTargetLabel("");
                                }
                            }}
                            placeholder="Typ om te zoeken op naam of ID..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-sky-500 transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setSearchResults([]);
                                    setSelectedTargetId("");
                                    setSelectedTargetLabel("");
                                }}
                                className="absolute right-2.5 top-2.5 text-xs text-slate-500 hover:text-slate-300"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* SELECTIE INDICATOR */}
                    {selectedTargetId && (
                        <div className="p-2 bg-emerald-950/40 border border-emerald-800/80 rounded-lg text-xs flex justify-between items-center text-emerald-300">
                            <span>Geselecteerd: <strong>{selectedTargetLabel}</strong></span>
                            <span className="text-[10px] font-mono text-emerald-400/70">ID: {selectedTargetId}</span>
                        </div>
                    )}

                    {/* KEUZELIJST MET FILTERRESULTATEN */}
                    {searchResults.length > 0 && (
                        <div className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg divide-y divide-slate-800/60">
                            {searchResults.map((obj) => {
                                const isSelected = selectedTargetId === obj.id;
                                return (
                                    <button
                                        key={obj.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedTargetId(obj.id);
                                            setSelectedTargetLabel(obj.label);
                                        }}
                                        className={`w-full text-left p-2.5 text-xs transition flex justify-between items-center ${
                                            isSelected
                                                ? "bg-sky-950/80 text-sky-200 font-bold border-l-4 border-sky-400"
                                                : "text-slate-300 hover:bg-slate-800/70"
                                        }`}
                                    >
                                        <div>
                                            <span className="block">{obj.label}</span>
                                            {obj.type && <span className="text-[10px] text-slate-500 uppercase">{obj.type}</span>}
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-mono ml-2">{obj.id}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {searchQuery.trim() !== "" && searchResults.length === 0 && !selectedTargetId && (
                        <p className="text-xs text-slate-500 italic py-2 text-center">
                            Geen objecten gevonden voor "{searchQuery}".
                        </p>
                    )}
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
                        disabled={saving || !selectedRelationId || !selectedTargetId}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-40"
                    >
                        {saving ? "Koppelen..." : "Relatie Koppelen"}
                    </button>
                </div>

            </div>
        </div>
    );
}