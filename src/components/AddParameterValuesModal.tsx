// src/components/AddParameterValuesModal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  haalParameterFormInformatieOp,
  haalLaatsteParameterWaardenOp,
  slaParameterWaardenBatchOp,
} from "@/app/actions";
import { toLocalDatetimeInput, toUtcIsoString } from "@/src/lib/dateUtils";
import { RichTextEditorModal } from "@/src/components/RichTextEditorModal";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: "object" | "relation_value";
  targetLabel?: string;
  onSuccess: () => void;
}

interface FormRow {
  parameterId: string;
  label: string;
  code: string;
  dataType: string;
  unit?: string | null;
  value: string;
  validFrom: string; // Opgeslagen als 'YYYY-MM-DDTHH:mm' voor lokale HTML input
  isMeetwaarde: boolean;
  historieBewaren: boolean;
  laatsteWaarde?: string;
}

export default function AddParameterValuesModal({
  isOpen,
  onClose,
  targetId,
  targetType,
  targetLabel,
  onSuccess,
}: ModalProps) {
  const [catalogus, setCatalogus] = useState<any[]>([]);
  const [parameterSets, setParameterSets] = useState<any[]>([]);
  const [setKoppelingen, setSetKoppelingen] = useState<any[]>([]);
  const [laatsteWaardenMap, setLaatsteWaardenMap] = useState<Record<string, any>>({});

  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [selectedAddParamId, setSelectedAddParamId] = useState<string>("");

  // Master datum/tijd voor batch-aanpassing
  const [masterValidFrom, setMasterValidFrom] = useState<string>(toLocalDatetimeInput());

  const [formRows, setFormRows] = useState<FormRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State voor de WYSIWYG RichTextEditor Modal
  const [activeRichTextIndex, setActiveRichTextIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function laadData() {
      setError(null);
      setFormRows([]);
      setSelectedSetId("");
      
      const nu = toLocalDatetimeInput();
      setMasterValidFrom(nu);

      const resDef = await haalParameterFormInformatieOp();
      if (resDef.success) {
        setCatalogus(resDef.parameters || []);
        setParameterSets(resDef.parameterSets || []);
        setSetKoppelingen(resDef.setKoppelingen || []);
      }

      const resLaatste = await haalLaatsteParameterWaardenOp(targetId);
      if (resLaatste.success) {
        setLaatsteWaardenMap(resLaatste.laatsteWaarden || {});
      }
    }

    laadData();
  }, [isOpen, targetId]);

  const handleMasterDateChange = (nieuweDatum: string) => {
    setMasterValidFrom(nieuweDatum);
    setFormRows((prev) =>
      prev.map((row) => ({
        ...row,
        validFrom: nieuweDatum,
      }))
    );
  };

  const handleSetChange = (setId: string) => {
    setSelectedSetId(setId);
    if (!setId) return;

    const gekoppeldeParamIds = setKoppelingen
      .filter((k) => k.parameterSetId === setId)
      .map((k) => ({
        paramId: k.parameterId,
        isMeetwaarde: Boolean(k.isMeetwaarde),
      }));

    const nieuweRegels: FormRow[] = [];

    gekoppeldeParamIds.forEach(({ paramId, isMeetwaarde }) => {
      const paramDef = catalogus.find((p) => p.id === paramId);
      if (paramDef && !formRows.some((r) => r.parameterId === paramId)) {
        nieuweRegels.push({
          parameterId: paramDef.id,
          label: paramDef.label,
          code: paramDef.code,
          dataType: paramDef.dataType || "string",
          unit: paramDef.unit,
          value: "",
          validFrom: masterValidFrom,
          isMeetwaarde: isMeetwaarde,
          historieBewaren: true,
          laatsteWaarde: laatsteWaardenMap[paramDef.id]?.value,
        });
      }
    });

    setFormRows((prev) => [...prev, ...nieuweRegels]);
  };

  const handleAddSingleParameter = (paramId: string) => {
    if (!paramId) return;
    if (formRows.some((r) => r.parameterId === paramId)) return;

    const paramDef = catalogus.find((p) => p.id === paramId);
    if (!paramDef) return;

    setFormRows((prev) => [
      ...prev,
      {
        parameterId: paramDef.id,
        label: paramDef.label,
        code: paramDef.code,
        dataType: paramDef.dataType || "string",
        unit: paramDef.unit,
        value: "",
        validFrom: masterValidFrom,
        isMeetwaarde: false,
        historieBewaren: true,
        laatsteWaarde: laatsteWaardenMap[paramDef.id]?.value,
      },
    ]);
    setSelectedAddParamId("");
  };

  const updateRow = (index: number, field: keyof FormRow, val: any) => {
    setFormRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const removeRow = (index: number) => {
    setFormRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const ingevuldeRegels = formRows.filter((r) => r.value.trim() !== "");
    if (ingevuldeRegels.length === 0) {
      setError("Vul voor minstens één parameter een waarde in.");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await slaParameterWaardenBatchOp({
      targetId,
      targetType,
      items: ingevuldeRegels.map((r) => ({
        parameterId: r.parameterId,
        value: r.value,
        validFrom: toUtcIsoString(r.validFrom),
        isMeetwaarde: r.isMeetwaarde,
        historieBewaren: r.historieBewaren,
      })),
    });

    if (res.success) {
      setSaving(false);
      onSuccess();
      onClose();
    } else {
      setError(res.error || "Fout bij opslaan van parameterwaarden");
      setSaving(false);
    }
  };

  // Helper om schone HTML tags te strippen voor de preview in de knop
  const stripHtml = (html: string) => {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, "").trim();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">

          {/* HEADER */}
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>📊</span>
                <span>Parameterwaarden Invoeren</span>
              </h3>
              {targetLabel && (
                <p className="text-xs text-sky-400 font-mono mt-0.5">
                  Target: {targetLabel} ({targetType})
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/80 border border-rose-700 text-rose-200 rounded text-xs">
              ⚠️ {error}
            </div>
          )}

          {/* SELECTIE BALK */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800 items-end">
            <div className="md:col-span-4 space-y-1">
              <label className="text-[11px] text-sky-400 font-bold flex items-center gap-1">
                <span>📅</span> Datum/tijd voor alle regels
              </label>
              <input
                type="datetime-local"
                value={masterValidFrom}
                onChange={(e) => handleMasterDateChange(e.target.value)}
                className="w-full bg-slate-900 border border-sky-500/50 rounded p-2 text-xs text-slate-100 outline-none focus:border-sky-400 font-mono shadow-sm"
              />
            </div>

            <div className="md:col-span-4 space-y-1">
              <label className="text-[11px] text-slate-400 font-semibold block">Kies Parameterset</label>
              <select
                value={selectedSetId}
                onChange={(e) => handleSetChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              >
                <option value="">-- Voeg parameters van set toe... --</option>
                {parameterSets.map((s) => (
                  <option key={s.id} value={s.id}>📦 {s.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4 space-y-1">
              <label className="text-[11px] text-slate-400 font-semibold block">Voeg Losse Parameter Toe</label>
              <select
                value={selectedAddParamId}
                onChange={(e) => {
                  setSelectedAddParamId(e.target.value);
                  handleAddSingleParameter(e.target.value);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              >
                <option value="">-- Zoek / Kies extra parameter... --</option>
                {catalogus.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.code}) {p.unit ? `[${p.unit}]` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* FORMULIER TABEL */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {formRows.length === 0 ? (
              <div className="text-center py-12 text-slate-500 italic text-xs border border-dashed border-slate-800 rounded-lg">
                Geen parameters geselecteerd. Kies hierboven een set of voeg een losse parameter toe.
              </div>
            ) : (
              <div className="space-y-2">
                {formRows.map((row, idx) => (
                  <div
                    key={row.parameterId}
                    className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 text-xs space-y-2"
                  >
                    {/* REGEL KOP */}
                    <div className="flex justify-between items-center border-b border-slate-700/50 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{row.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({row.code})</span>
                        {row.unit && (
                          <span className="bg-slate-700 text-sky-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                            {row.unit}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-slate-500 hover:text-rose-400 text-xs px-1"
                        title="Verwijder uit lijst"
                      >
                        ✕
                      </button>
                    </div>

                    {/* REGEL INVOER & EIGENSCHAPPEN */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">

                      {/* INVOERVELD */}
                      <div className="md:col-span-5 space-y-1">
                        {row.dataType === "markdown" ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveRichTextIndex(idx)}
                              className="w-full text-left bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-sky-500 rounded p-2 text-xs text-slate-200 flex justify-between items-center transition"
                            >
                              <span className="truncate flex-1 font-mono text-[11px] text-slate-300">
                                {stripHtml(row.value) || <span className="italic text-slate-500">Geen opgemaakte tekst...</span>}
                              </span>
                              <span className="ml-2 bg-sky-950 text-sky-400 border border-sky-800/60 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                                📝 Bewerken
                              </span>
                            </button>
                          </div>
                        ) : (
                          <input
                            type={row.dataType === "number" ? "number" : "text"}
                            step="any"
                            value={row.value}
                            onChange={(e) => updateRow(idx, "value", e.target.value)}
                            placeholder={`Voer ${row.dataType === "number" ? "getal" : "waarde"} in...`}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-100"
                          />
                        )}
                      </div>

                      {/* VALID FROM DATUM/TIJD */}
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] text-slate-400 block md:hidden">Datum & Tijd</label>
                        <input
                          type="datetime-local"
                          value={row.validFrom}
                          onChange={(e) => updateRow(idx, "validFrom", e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200 font-mono"
                        />
                      </div>

                      {/* VINKJES */}
                      <div className="md:col-span-4 flex items-center justify-between gap-2 bg-slate-900/60 p-1.5 rounded border border-slate-800">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                          <input
                            type="checkbox"
                            checked={row.isMeetwaarde}
                            onChange={(e) => updateRow(idx, "isMeetwaarde", e.target.checked)}
                            className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0"
                          />
                          <span>Meting</span>
                        </label>

                        <label
                          className={`flex items-center gap-1.5 cursor-pointer text-[11px] ${
                            row.isMeetwaarde ? "opacity-30 pointer-events-none" : "text-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={row.isMeetwaarde}
                            checked={row.historieBewaren}
                            onChange={(e) => updateRow(idx, "historieBewaren", e.target.checked)}
                            className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0"
                          />
                          <span>Historie</span>
                        </label>
                      </div>
                    </div>

                    {/* LAATSTE BEKENDE WAARDE */}
                    {row.laatsteWaarde !== undefined && (
                      <div className="text-[10px] text-slate-400 italic pt-0.5 truncate">
                        💡 Laatste bekende waarde:{" "}
                        <span className="font-semibold text-sky-300">
                          {stripHtml(row.laatsteWaarde)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-800">
            <span className="text-[11px] text-slate-500">
              Alleen ingevulde regels worden opgeslagen.
            </span>
            <div className="flex gap-2">
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
                disabled={saving || formRows.length === 0}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-40"
              >
                {saving ? "Opslaan..." : "Parameterwaarden Opslaan"}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* RICH TEXT EDITOR MODAL VOOR MARKDOWN PARAMETERS */}
      {activeRichTextIndex !== null && (
        <RichTextEditorModal
          isOpen={activeRichTextIndex !== null}
          onClose={() => setActiveRichTextIndex(null)}
          title={`Bewerken: ${formRows[activeRichTextIndex].label}`}
          initialValue={formRows[activeRichTextIndex].value}
          onSave={(htmlContent) => {
            updateRow(activeRichTextIndex, "value", htmlContent);
            setActiveRichTextIndex(null);
          }}
        />
      )}
    </>
  );
}