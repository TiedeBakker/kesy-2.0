"use client";

import { useState, useEffect } from "react";
import { zoekObjecten } from "@/app/actions";
import {
  haalStuurbestandenOp,
  genereerRapport,
  genereerPdfRapport,
  ReportConfig,
} from "./actions";

export default function RapportagePagina() {
  const [actieveTab, setActieveTab] = useState<"basis" | "custom">("basis");
  const [isGemonteerd, setIsGemonteerd] = useState(false);

  // Zoeker state
  const [zoekterm, setZoekterm] = useState("");
  const [zoekResultaten, setZoekResultaten] = useState<any[]>([]);
  const [geselecteerdObject, setGeselecteerdObject] = useState<{
    id: string;
    label: string;
  } | null>(null);

  // Stuurbestanden state
  const [stuurbestanden, setStuurbestanden] = useState<ReportConfig[]>([]);
  const [geselecteerdBestand, setGeselecteerdBestand] =
    useState<ReportConfig | null>(null);

  // Uitvoer state
  const [isLaden, setIsLaden] = useState(false);
  const [isPdfLaden, setIsPdfLaden] = useState(false);
  const [rapportHtml, setRapportHtml] = useState<string | null>(null);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);

  useEffect(() => {
    setIsGemonteerd(true);
    haalStuurbestandenOp().then((data) => {
      setStuurbestanden(data);
      if (data.length > 0) {
        setGeselecteerdBestand(data[0]);
      }
    });
  }, []);

  const handleZoeken = async (term: string) => {
    setZoekterm(term);
    if (term.length > 1) {
      const res = await zoekObjecten(term);
      if (res.success && Array.isArray(res.objecten)) {
        setZoekResultaten(res.objecten);
      } else {
        setZoekResultaten([]);
      }
    } else {
      setZoekResultaten([]);
    }
  };

  const handleSelecteerObject = (obj: { id: string; label: string }) => {
    setGeselecteerdObject(obj);
    setZoekterm(obj.label);
    setZoekResultaten([]);
  };

  const handleGenereer = async () => {
    if (!geselecteerdObject || !geselecteerdBestand) return;

    setIsLaden(true);
    setFoutmelding(null);
    setRapportHtml(null);

    const res = await genereerRapport(
      geselecteerdObject.id,
      geselecteerdBestand
    );

    if (res.success && res.html) {
      setRapportHtml(res.html);
    } else {
      setFoutmelding(res.error || "Aanmaken rapportage mislukt.");
    }
    setIsLaden(false);
  };

  const handleOpslaan = () => {
    if (!rapportHtml || !geselecteerdObject) return;

    const blob = new Blob([rapportHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport_${geselecteerdObject.label.toLowerCase().replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!geselecteerdObject || !geselecteerdBestand) return;

    setIsPdfLaden(true);
    try {
      const res = await genereerPdfRapport(
        geselecteerdObject.id,
        geselecteerdBestand
      );

      if (res.success && res.pdfBase64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.pdfBase64}`;
        link.download = `rapport_${geselecteerdObject.label.toLowerCase().replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setFoutmelding(res.error || "PDF genereren mislukt.");
      }
    } catch (err: any) {
      setFoutmelding("Er is een onverwachte fout opgetreden bij het genereren van de PDF.");
    } finally {
      setIsPdfLaden(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGINA KOP */}
      <div>
        <h1 className="text-2xl font-bold text-emerald-400">📊 Rapportages</h1>
        <p className="text-slate-400 text-sm mt-1">
          Genereer en exporteer hiërarchische overzichten op basis van stuurbestanden.
        </p>
      </div>

      {/* TABBLADEN */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActieveTab("basis")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${actieveTab === "basis"
            ? "border-emerald-500 text-emerald-400"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          Basisrapportages
        </button>
        <button
          onClick={() => setActieveTab("custom")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${actieveTab === "custom"
            ? "border-emerald-500 text-emerald-400"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          Aangepast (Binnenkort)
        </button>
      </div>

      {actieveTab === "basis" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LINKERKOLOM: SELECTIE CONFIGURATIE */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 h-fit">
            <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">
              ⚙️ Instellingen
            </h2>

            {/* 1. OBJECT ZOEKEN */}
            <div className="space-y-2 relative">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                1. Kies Start-object
              </label>
              <input
                type="text"
                placeholder="Zoek object op label..."
                value={zoekterm}
                onChange={(e) => handleZoeken(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
              />

              {zoekResultaten.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950 divide-y divide-slate-800 shadow-2xl">
                  {zoekResultaten.map((obj) => (
                    <div
                      key={obj.id}
                      onClick={() => handleSelecteerObject(obj)}
                      className="p-2.5 hover:bg-slate-900 cursor-pointer text-xs flex justify-between items-center"
                    >
                      <span className="font-medium text-emerald-400">
                        {obj.label}
                      </span>
                      <span className="font-mono text-slate-600">
                        {obj.id.slice(0, 8)}...
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {geselecteerdObject && (
                <p className="text-xs text-emerald-400/90 font-mono pt-1">
                  ✓ Geselecteerd: <strong>{geselecteerdObject.label}</strong>
                </p>
              )}
            </div>

            {/* 2. STUURBESTAND KIEZEN */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                2. Kies Stuurbestand
              </label>
              <select
                value={geselecteerdBestand?.id || ""}
                onChange={(e) => {
                  const b = stuurbestanden.find(
                    (s) => s.id === e.target.value
                  );
                  setGeselecteerdBestand(b || null);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {stuurbestanden.length === 0 && (
                  <option value="" disabled className="text-slate-900 bg-slate-100">
                    Geen stuurbestanden gevonden...
                  </option>
                )}
                {stuurbestanden.map((b) => (
                  <option key={b.id} value={b.id} className="text-slate-900 bg-slate-100 py-1">
                    {b.naam}
                  </option>
                ))}
              </select>

              {geselecteerdBestand && (
                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg space-y-1 text-xs text-slate-400">
                  <p>{geselecteerdBestand.beschrijving}</p>
                  <p className="font-mono text-[11px] text-slate-500 pt-1">
                    Aantal niveaus: {geselecteerdBestand.levels.length}
                  </p>
                </div>
              )}
            </div>

            {/* GENEREREN KNOP */}
            <button
              onClick={handleGenereer}
              disabled={
                !isGemonteerd ||
                !geselecteerdObject ||
                !geselecteerdBestand ||
                isLaden
              }
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition shadow-lg"
            >
              {isLaden ? "Rapportage genereren..." : "▶ Genereer Rapportage"}
            </button>
          </div>

          {/* RECHTERKOLOM: UITVOER VENSTER */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between h-150">
            <div className="flex flex-col h-full overflow-hidden">
              {/* TITELBALK */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4 shrink-0">
                <h2 className="text-lg font-semibold text-slate-200">
                  📄 Uitvoer Venster
                </h2>

                {rapportHtml && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOpslaan}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-md shadow transition flex items-center gap-1.5"
                    >
                      <span>💾</span> Opslaan als HTML
                    </button>
                    <button
                      onClick={handleDownloadPdf}
                      disabled={isPdfLaden}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-md shadow transition flex items-center gap-1.5"
                    >
                      <span>📄</span> {isPdfLaden ? "PDF maken..." : "Exporteer als PDF"}
                    </button>
                  </div>
                )}
              </div>

              {/* FOUTMELDING */}
              {foutmelding && (
                <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-lg text-rose-300 text-sm shrink-0 mb-4">
                  ❌ {foutmelding}
                </div>
              )}

              {/* LEEG STATEN */}
              {!rapportHtml && !foutmelding && !isLaden && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-800/60 rounded-xl">
                  <span>Selecteer een object en stuurbestand om te starten.</span>
                </div>
              )}

              {/* LADEN STATEN */}
              {isLaden && (
                <div className="h-full flex flex-col items-center justify-center text-emerald-400 text-sm space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span>Gegevens recursief ophalen uit SQLite...</span>
                </div>
              )}

              {/* SCROLLBARE HTML CONTAINER */}
              {rapportHtml && (
                <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-4">
                  {/* A4 Papieren Container voor een schone preview */}
                  <div className="mx-auto bg-white text-slate-900 rounded-lg shadow-xl p-8 max-w-4xl min-h-full">
                    <div dangerouslySetInnerHTML={{ __html: rapportHtml }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}