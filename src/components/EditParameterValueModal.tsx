// src/components/EditParameterValueModal.tsx
"use client";

import { useState, useEffect } from "react";
import { slaParameterWaardebewerkingOp } from "@/app/actions";
import { toLocalDatetimeInput, toUtcIsoString } from "@/src/lib/dateUtils";
import { RichTextEditorModal } from "@/src/components/RichTextEditorModal";
import LocalhostFileBrowserModal from "@/src/components/LocalhostFileBrowserModal";

interface EditParameterValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  parameterValue: {
    id: string;
    parameterId: string;
    label: string;
    code?: string;
    dataType?: string;
    unit?: string | null;
    value: string;
    validFrom?: string;
    isMeetwaarde?: boolean;
    isConfidential?: boolean;
  } | null;
  onSuccess: () => void;
}

export default function EditParameterValueModal({
  isOpen,
  onClose,
  parameterValue,
  onSuccess,
}: EditParameterValueModalProps) {
  const [value, setValue] = useState("");
  const [validFrom, setValidFrom] = useState(toLocalDatetimeInput());
  const [opslaanAlsHistorie, setOpslaanAlsHistorie] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State voor Rich Text Editor
  const [isRichTextOpen, setIsRichTextOpen] = useState(false);
  const [forceRichText, setForceRichText] = useState(false);

  useEffect(() => {
    if (parameterValue && isOpen) {
      setValue(parameterValue.value || "");
      setValidFrom(
        parameterValue.validFrom
          ? toLocalDatetimeInput(parameterValue.validFrom)
          : toLocalDatetimeInput()
      );
      setOpslaanAlsHistorie(false);
      setForceRichText(false);
      setError(null);
    }
  }, [parameterValue?.id, isOpen]); // ✅ Veiliger dan [parameterValue]
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  if (!isOpen || !parameterValue) return null;

  // Checks voor het type veld
  const isFileType = parameterValue.dataType?.toLowerCase() === "file";
  const isHtmlContent = Boolean(
    value &&
    (value.includes("<p>") ||
      value.includes("<h") ||
      value.includes("<ul>") ||
      value.includes("<br"))
  );
  const isMarkdownType =
    parameterValue.dataType?.toLowerCase() === "markdown" ||
    parameterValue.dataType?.toLowerCase() === "html" ||
    parameterValue.dataType?.toLowerCase() === "richtext";

  const showRichTextUI = !isFileType && (isMarkdownType || isHtmlContent || forceRichText);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const res = await slaParameterWaardebewerkingOp({
      id: parameterValue.id,
      parameterId: parameterValue.parameterId,
      value,
      validFrom: toUtcIsoString(validFrom),
      opslaanAlsHistorie,
    });

    if (res.success) {
      setSaving(false);
      onSuccess();
      onClose();
    } else {
      setError(res.error || "Fout bij opslaan van bewerking.");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>✏️</span>
                <span>Parameterwaarde Bewerken</span>
              </h3>
              <p className="text-xs text-sky-400 font-semibold mt-0.5">
                {parameterValue.label} {parameterValue.unit ? `[${parameterValue.unit}]` : ""}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
              ✕
            </button>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/80 border border-rose-700 text-rose-200 rounded text-xs">
              ⚠️ {error}
            </div>
          )}

          <div className="space-y-4 text-xs">
            {/* Waarde invoer (File / RichText / Standaard) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-400 font-semibold">
                  {isFileType ? "Bestandspad of URL" : "Waarde"}
                </label>
                {!showRichTextUI && !isFileType && (
                  <button
                    type="button"
                    onClick={() => {
                      setForceRichText(true);
                      setIsRichTextOpen(true);
                    }}
                    className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
                  >
                    📝 Open als Rich Text Editor
                  </button>
                )}
              </div>

              {/* OPTIE 1: BESTAND / FILE */}
              {isFileType ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs outline-none focus:border-sky-500"
                      placeholder="http://localhost/..."
                    />
                    <button
                      type="button"
                      onClick={() => setIsBrowserOpen(true)}
                      className="px-3 py-2 bg-sky-900 hover:bg-sky-800 border border-sky-700 text-sky-200 rounded text-xs font-semibold transition flex items-center gap-1"
                    >
                      <span>📂</span>
                      <span>Bladeren</span>
                    </button>
                  </div>

                  {value && (
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-xs font-medium transition"
                    >
                      <span>🔗</span>
                      <span>Link Controleren / Openen</span>
                    </a>
                  )}

                  {/* Bestandsbrowser Modal */}
                  <LocalhostFileBrowserModal
                    isOpen={isBrowserOpen}
                    onClose={() => setIsBrowserOpen(false)}
                    onSelectFile={(selectedUrl) => setValue(selectedUrl)}
                  />
                </div>
              )  : showRichTextUI ? (
              /* OPTIE 2: RICH TEXT / WYSIWYG */
              <div className="space-y-2">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg max-h-36 overflow-y-auto text-slate-300 text-xs font-sans">
                  {value ? (
                    <div
                      className="prose prose-invert max-w-none text-xs"
                      dangerouslySetInnerHTML={{ __html: value }}
                    />
                  ) : (
                    <span className="italic text-slate-500">Geen opgemaakte tekst aanwezig...</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsRichTextOpen(true)}
                  className="w-full bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-700/60 rounded-lg py-2 px-3 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <span>📝 Rich Text / WYSIWYG Editor Openen</span>
                </button>
              </div>
              ) : (
              /* OPTIE 3: STANDAARD INVOER (Tekst / Getal) */
              <input
                type={parameterValue.dataType === "number" ? "number" : "text"}
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 outline-none focus:border-sky-500 font-medium"
                placeholder="Voer waarde in..."
              />
              )}
            </div>

            {/* Datum / tijd van wijziging */}
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">
                Geldig vanaf (Datum/Tijd)
              </label>
              <input
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 font-mono outline-none focus:border-sky-500"
              />
            </div>

            {/* Keuze: Typo herstel vs Historie bewaren */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <span className="text-[11px] font-bold text-slate-300 block">
                Hoe wil je deze wijziging verwerken?
              </span>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="editMode"
                  checked={!opslaanAlsHistorie}
                  onChange={() => setOpslaanAlsHistorie(false)}
                  className="mt-0.5 text-sky-500 bg-slate-900 border-slate-700"
                />
                <div>
                  <span className="text-slate-200 font-semibold block">
                    Overschrijven (Typo herstellen)
                  </span>
                  <span className="text-slate-400 text-[10px] block">
                    De huidige record in de database wordt direct bijgewerkt. Er wordt geen historie opgebouwd.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-800">
                <input
                  type="radio"
                  name="editMode"
                  checked={opslaanAlsHistorie}
                  onChange={() => setOpslaanAlsHistorie(true)}
                  className="mt-0.5 text-sky-500 bg-slate-900 border-slate-700"
                />
                <div>
                  <span className="text-amber-400 font-semibold block">
                    Nieuwe waarde toevoegen (Historie bewaren)
                  </span>
                  <span className="text-slate-400 text-[10px] block">
                    Slaat de huidige waarde op met een einddatum en maakt een nieuw actueel record aan vanaf de gekozen datum.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              Annuleren
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-50"
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </div>
      </div>

      {/* RICH TEXT EDITOR MODAL */}
      {isRichTextOpen && (
        <RichTextEditorModal
          isOpen={isRichTextOpen}
          onClose={() => setIsRichTextOpen(false)}
          title={`Opmaak bewerken: ${parameterValue.label}`}
          initialValue={value}
          onSave={(htmlContent) => {
            setValue(htmlContent);
            setIsRichTextOpen(false);
          }}
        />
      )}
    </>
  );
}