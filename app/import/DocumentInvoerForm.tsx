"use client";

import { useState, useEffect } from "react";
import {
  haalDArchievenMappenOp,
  haalBestandenOpInSubmap,
  maakDocumentObjectAan,
} from "./documentActions";

export default function DocumentInvoerForm({ onSuccess }: { onSuccess?: (id: string) => void }) {
  const [mappen, setMappen] = useState<string[]>([]);
  const [geselecteerdeMap, setGeselecteerdeMap] = useState<string>("");
  const [bestanden, setBestanden] = useState<{ fileName: string; fullUrl: string; isGekoppeld: boolean }[]>([]);

  const [geselecteerdBestand, setGeselecteerdBestand] = useState<{ fileName: string; fullUrl: string } | null>(null);

  // Formulier state
  const [isConfidential, setIsConfidential] = useState<boolean>(true); // Stap 3: Default true
  const [documentType, setDocumentType] = useState<"boek" | "notitie">("boek"); // Stap 4: Default 'Is Boek'
  const [label, setLabel] = useState<string>(""); // Stap 5: Default bestandsnaam zonder ext
  const [titel, setTitel] = useState<string>(""); // Stap 8
  const [ondertitel, setOndertitel] = useState<string>(""); // Stap 9
  const [toelichting, setToelichting] = useState<string>(""); // Stap 10

  const [loadingMappen, setLoadingMappen] = useState(false);
  const [loadingBestanden, setLoadingBestanden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Mappen laden bij mount
  useEffect(() => {
    async function laadMappen() {
      setLoadingMappen(true);
      const res = await haalDArchievenMappenOp();
      if (res.success && res.mappen) {
        setMappen(res.mappen);
      } else {
        setError(res.error || "Kon mappen niet ophalen");
      }
      setLoadingMappen(false);
    }
    laadMappen();
  }, []);

  // 2. Bestanden laden wanneer map verandert
  const handleSelectMap = async (map: string) => {
    setGeselecteerdeMap(map);
    setGeselecteerdBestand(null);
    setLabel("");
    setLoadingBestanden(true);
    setError(null);

    const res = await haalBestandenOpInSubmap(map);
    if (res.success && res.bestanden) {
      setBestanden(res.bestanden);
    } else {
      setError(res.error || "Kon bestanden in map niet ophalen");
    }
    setLoadingBestanden(false);
  };

  // Selecteer een ongekoppeld bestand (Stap 2 & Stap 5)
  const handleSelectBestand = (b: { fileName: string; fullUrl: string }) => {
    setGeselecteerdBestand(b);
    // Bestandsnaam zonder extensie als default label
    const nameWithoutExt = b.fileName.substring(0, b.fileName.lastIndexOf(".")) || b.fileName;
    setLabel(nameWithoutExt);
    setTitel("");
    setOndertitel("");
    setToelichting("");
  };

  // 11. Opslaan
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geselecteerdBestand || !label.trim()) {
      setError("Selecteer een bestand en vul een label in.");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await maakDocumentObjectAan({
      label,
      isConfidential,
      documentType,
      fileUrl: geselecteerdBestand.fullUrl,
      titel,
      ondertitel,
      toelichting,
    });

    setSaving(false);

    if (res.success && res.objectId) {
      setSuccessMsg(`Document succesvol aangemaakt! (ID: ${res.objectId})`);
      // Refresh bestandenlijst om het zojuist gekoppelde bestand als gekoppeld te tonen
      handleSelectMap(geselecteerdeMap);
      if (onSuccess) onSuccess(res.objectId);
    } else {
      setError(res.error || "Fout bij aanmaken document.");
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      {error && (
        <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-200 rounded-lg text-xs">
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 rounded-lg text-xs">
          ✓ {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LINKERKOLOM: MAPPEN & BESTANDENSELECTIE (Stap 1 & 2) */}
        <div className="lg:col-span-5 space-y-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-bold text-sky-400 uppercase mb-1">
              1. Kies Submap in DArchieven
            </label>
            {loadingMappen ? (
              <p className="text-xs text-slate-400">Mappen laden...</p>
            ) : (
              <select
                value={geselecteerdeMap}
                onChange={(e) => handleSelectMap(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-sky-500 outline-none"
              >
                <option value="">-- Selecteer een submap --</option>
                {mappen.map((m) => (
                  <option key={m} value={m}>
                    📁 {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-sky-400 uppercase mb-1">
              2. Selecteer Ongekoppeld Bestand
            </label>
            {!geselecteerdeMap ? (
              <p className="text-xs text-slate-500 italic py-4">Kies eerst een submap hierboven.</p>
            ) : loadingBestanden ? (
              <p className="text-xs text-slate-400">Bestanden scannen...</p>
            ) : bestanden.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Geen bestanden gevonden in deze map.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-1 pr-1 border border-slate-800 rounded-lg p-2 bg-slate-950">
                {bestanden.map((b) => (
                  <div
                    key={b.fileName}
                    className={`flex items-center justify-between p-2 rounded text-xs transition ${
                      b.isGekoppeld
                        ? "bg-slate-900/40 text-slate-500 cursor-not-allowed"
                        : geselecteerdBestand?.fileName === b.fileName
                        ? "bg-sky-950 border border-sky-600 text-sky-200"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800 cursor-pointer"
                    }`}
                    onClick={() => !b.isGekoppeld && handleSelectBestand(b)}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <input
                        type="radio"
                        name="selectedFile"
                        disabled={b.isGekoppeld}
                        checked={geselecteerdBestand?.fileName === b.fileName}
                        onChange={() => handleSelectBestand(b)}
                        className="text-sky-500"
                      />
                      <span className="truncate" title={b.fileName}>
                        📄 {b.fileName}
                      </span>
                    </div>

                    {b.isGekoppeld ? (
                      <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded shrink-0">
                        🔗 Al gekoppeld
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                        Beschikbaar
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECHTERKOLOM: INVULFORMULIER (Stap 3 t/m 11) */}
        <div className="lg:col-span-7 bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
            <span>📝</span> Document Gegevens Invoeren
          </h3>

          {!geselecteerdBestand ? (
            <div className="py-12 text-center text-slate-500 text-xs italic">
              Selecteer links een ongekoppeld bestand om het formulier vrij te geven.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Stap 3 & 4: Opties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
                {/* Stap 3 */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Vertrouwelijkheid</label>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={isConfidential}
                      onChange={(e) => setIsConfidential(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-sky-500"
                    />
                    <span>{isConfidential ? "🔒 IsConfidential (Ja)" : "🔓 Publiek (Nee)"}</span>
                  </label>
                </div>

                {/* Stap 4 */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Document Type</label>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="docType"
                        value="boek"
                        checked={documentType === "boek"}
                        onChange={() => setDocumentType("boek")}
                        className="text-sky-500"
                      />
                      <span>Is Boek</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="docType"
                        value="notitie"
                        checked={documentType === "notitie"}
                        onChange={() => setDocumentType("notitie")}
                        className="text-sky-500"
                      />
                      <span>Is Notitie</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Stap 5: Label */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Object Label <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:border-sky-500 outline-none"
                />
              </div>

              {/* Stap 7: Unalterable URL-weergave */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Digitaal beschikbaar document (URL)
                </label>
                <input
                  type="text"
                  readOnly
                  value={geselecteerdBestand.fullUrl}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[11px] rounded-lg p-2 cursor-not-allowed"
                />
              </div>

              {/* Stap 8: Titel */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Titel <span className="text-slate-500 font-normal">(Optioneel)</span>
                </label>
                <input
                  type="text"
                  value={titel}
                  onChange={(e) => setTitel(e.target.value)}
                  placeholder="Voer titel in..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:border-sky-500 outline-none"
                />
              </div>

              {/* Stap 9: Ondertitel */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ondertitel <span className="text-slate-500 font-normal">(Optioneel)</span>
                </label>
                <input
                  type="text"
                  value={ondertitel}
                  onChange={(e) => setOndertitel(e.target.value)}
                  placeholder="Voer ondertitel in..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:border-sky-500 outline-none"
                />
              </div>

              {/* Stap 10: Toelichting */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Toelichting <span className="text-slate-500 font-normal">(Optioneel)</span>
                </label>
                <textarea
                  rows={2}
                  value={toelichting}
                  onChange={(e) => setToelichting(e.target.value)}
                  placeholder="Voer toelichting in..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:border-sky-500 outline-none"
                />
              </div>

              {/* Stap 11: Opslaan Knop */}
              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition disabled:opacity-50 shadow"
                >
                  {saving ? "Opslaan..." : "💾 Opslaan als nieuw object"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}