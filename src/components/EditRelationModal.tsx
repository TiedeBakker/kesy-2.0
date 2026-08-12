// src/components/EditRelationModal.tsx
"use client";

import { useState, useEffect } from "react";
import { bewerkRelatie } from "@/app/actions";

interface EditRelationModalProps {
    isOpen: boolean;
    onClose: () => void;
    relationValue: any; // De te bewerken relatie
    availableRelationTypes: any[];
    onSuccess: () => void;
}

export default function EditRelationModal({
    isOpen,
    onClose,
    relationValue,
    availableRelationTypes,
    onSuccess,
}: EditRelationModalProps) {
    const [selectedRelationId, setSelectedRelationId] = useState("");
    const [wisselRichting, setWisselRichting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (relationValue) {
            setSelectedRelationId(relationValue.relationId || "");
            setWisselRichting(false);
        }
    }, [relationValue]);

    if (!isOpen || !relationValue) return null;

    const handleSave = async () => {
        setSaving(true);
        setError(null);

        const relId = relationValue.relationValueId || relationValue.id;

        const res = await bewerkRelatie({
            relationValueId: relId,
            nieuwRelationId: selectedRelationId !== relationValue.relationId ? selectedRelationId : undefined,
            wisselRichting,
        });

        if (res.success) {
            setSaving(false);
            onSuccess();
            onClose();
        } else {
            setError(res.error || "Fout bij bewerken relatie");
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        <span>✏️</span> Relatie Aanpassen
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                </div>

                {error && (
                    <div className="p-2.5 bg-rose-950/80 border border-rose-700 text-rose-200 rounded text-xs">
                        ⚠️ {error}
                    </div>
                )}

                {/* RELATIETYPE SELECTOR */}
                <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold block">Relatietype</label>
                    <select
                        value={selectedRelationId}
                        onChange={(e) => setSelectedRelationId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    >
                        {availableRelationTypes.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label} ({r.code || r.id})
                            </option>
                        ))}
                    </select>
                </div>

                {/* RICHTING WISSELEN CHECKBOX */}
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 font-semibold">
                        <input
                            type="checkbox"
                            checked={wisselRichting}
                            onChange={(e) => setWisselRichting(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-800 text-sky-500"
                        />
                        <span>🔄 Richting Omdraaien (Ingaand ↔ Uitgaand)</span>
                    </label>
                    <p className="text-[11px] text-slate-400 pl-6">
                        Het gerelateerde object wordt het bron-object. De relatie sluit achteraan aan in de volgorde van het nieuwe bron-object.
                    </p>
                </div>

                {/* FOOTER */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                    >
                        Annuleren
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs disabled:opacity-40"
                    >
                        {saving ? "Opslaan..." : "Relatie Bijwerken"}
                    </button>
                </div>
            </div>
        </div>
    );
}