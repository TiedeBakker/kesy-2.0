"use client";

import { useState, useEffect } from "react";
import {
  haalSubmappenOp,
  haalBestandenOpInSubmap,
  maakDocumentObjectAan,
} from "./documentActions";

// Reformat subcomponent voor mappenstructuur met in-/uitklappen
function FolderTreeItem({
  folderName,
  relativePath,
  selectedMap,
  onSelectMap,
}: {
  folderName: string;
  relativePath: string;
  selectedMap: string;
  onSelectMap: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSelected = selectedMap === relativePath;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && !loaded) {
      setLoading(true);
      const res = await haalSubmappenOp(relativePath);
      if (res.success && res.mappen) {
        setChildren(res.mappen);
        setLoaded(true);
      }
      setLoading(false);
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="text-xs select-none">
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition ${
          isSelected
            ? "bg-sky-950 border border-sky-600 text-sky-200 font-bold"
            : "hover:bg-slate-800 text-slate-300"
        }`}
        onClick={() => onSelectMap(relativePath)}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-white"
        >
          {loading ? "⌛" : isOpen ? "▼" : "▶"}
        </button>
        <span>📁 {folderName}</span>
      </div>

      {isOpen && (
        <div className="pl-4 border-l border-slate-800 ml-2 space-y-0.5 mt-0.5">
          {children.length === 0 && loaded ? (
            <div className="text-[11px] text-slate-500 italic py-0.5 pl-2">Geen submappen</div>
          ) : (
            children.map((child) => {
              const childPath = `${relativePath}/${child}`;
              return (
                <FolderTreeItem
                  key={childPath}
                  folderName={child}
                  relativePath={childPath}
                  selectedMap={selectedMap}
                  onSelectMap={onSelectMap}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentInvoerForm({ onSuccess }: { onSuccess?: (id: string) => void }) {
  const [hoofdMappen, setHoofdMappen] = useState<string[]>([]);
  const [geselecteerdeMap, setGeselecteerdeMap] = useState<string>("");
  const [bestanden, setBestanden] = useState<{ fileName: string; fullUrl: string; isGekoppeld: boolean }[]>([]);
  const [geselecteerdBestand, setGeselecteerdBestand] = useState<{ fileName: string; fullUrl: string } | null>(null);

  // Formulier state
  const [isConfidential, setIsConfidential] = useState<boolean>(true);
  const [documentType, setDocumentType] = useState<"boek" | "notitie">("boek");
  const [label, setLabel] = useState<string>("");
  const [titel, setTitel] = useState<string>("");
  const [ondertitel, setOndertitel] = useState<string>("");
  const [toelichting, setToelichting] = useState<string>("");

  const [loadingMappen, setLoadingMappen] = useState(false);
  const [loadingBestanden, setLoadingBestanden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Hoofdmappen laden bij start
  useEffect(() => {
    async function laadHoofdMappen() {
      setLoadingMappen(true);
      const res = await haalSubmappenOp("");
      if (res.success && res.mappen) {
        setHoofdMappen(res.mappen);
      } else {
        setError(res.error || "Kon hoofdmappen niet ophalen");
      }
      setLoadingMappen(false);
    }
    laadHoofdMappen();
  }, []);

  // 2. Bestanden ophalen voor de gekozen map
  const handleSelectMap = async (mapPath: string) => {
    setGeselecteerdeMap(mapPath);
    setGeselecteerdBestand(null);
    setLabel("");
    setLoadingBestanden(true);
    setError(null);

    const res = await haalBestandenOpInSubmap(mapPath);
    if (res.success && res.bestanden) {
      setBestanden(res.bestanden);
    } else {
      setError(res.error || "Kon bestanden in map niet ophalen");
    }
    setLoadingBestanden(false);
  };

  const handleSelectBestand = (b: { fileName: string; fullUrl: string }) => {
    setGeselecteerdBestand(b);
    const nameWithoutExt = b.fileName.substring(0, b.fileName.lastIndexOf(".")) || b.fileName;
    setLabel(nameWithoutExt);
    setTitel("");
    setOndertitel("");
    setToelichting("");
  };

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
        {/* LINKERKOLOM: MAPPEN & BESTANDENSELECTIE */}
        <div className="lg:col-span-5 space-y-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-bold text-sky-400 uppercase mb-2">
              1. Kies Map in DArchieven
            </label>
            {loadingMappen ? (
              <p className="text-xs text-slate-400">Hoofdmappen laden...</p>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-lg p-2 bg-slate-950 space-y-1">
                {hoofdMappen.map((map) => (
                  <FolderTreeItem
                    key={map}
                    folderName={map}
                    relativePath={map}
                    selectedMap={geselecteerdeMap}
                    onSelectMap={handleSelectMap}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-sky-400 uppercase mb-1">
              2. Selecteer Ongekoppeld Bestand
            </label>
            {!geselecteerdeMap ? (
              <p className="text-xs text-slate-500 italic py-4">Kies eerst een map hierboven.</p>
            ) : loadingBestanden ? (
              <p className="text-xs text-slate-400">Bestanden scannen...</p>
            ) : bestanden.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Geen bestanden gevonden in deze map.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border border-slate-800 rounded-lg p-2 bg-slate-950">
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

        {/* RECHTERKOLOM: FORMULIER */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
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