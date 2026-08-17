// app/import/page.tsx
"use client";

import { useState } from "react";
import { parseCsvWithHeader, ParsedCsvResult } from "@/src/lib/csvParser";
import { voerCsvImportUit } from "./actions";

export default function ImportPage() {
  const [parsedData, setParsedData] = useState<ParsedCsvResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [resultStats, setResultStats] = useState<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const result = parseCsvWithHeader(text);
        setParsedData(result);
        setResultStats(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRunImport = async () => {
    if (!parsedData?.config || !parsedData.rows.length) return;

    setImporting(true);
    const res = await voerCsvImportUit({
      config: parsedData.config,
      rows: parsedData.rows,
    });
    setImporting(false);

    if (res.success) {
      setResultStats(res.stats);
    } else {
      alert(`Import mislukt: ${res.error}`);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <span>📥</span> Dynamische CSV Import Engine
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Laad een CSV-bestand in inclusief `#` metadata configuratie-header om gegevens generiek te importeren.
        </p>
      </div>

      {/* BESTAND UPLOADER */}
      <div className="p-8 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl text-center space-y-3 hover:border-sky-500/50 transition cursor-pointer">
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
          id="csv-file-input"
        />
        <label htmlFor="csv-file-input" className="cursor-pointer block">
          <span className="text-3xl block mb-2">📄</span>
          <span className="text-sm font-semibold text-sky-400">Klik om CSV-bestand te selecteren</span>
          <span className="text-xs text-slate-500 block mt-1">Ondersteunt .csv bestanden met JSON `#` header</span>
        </label>
      </div>

      {/* PREVIEW VAN VERWERKT BESTAND */}
      {parsedData && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-start border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-mono text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                Profiel: {parsedData.config?.profile || "Geen profiel header gedetecteerd"}
              </span>
              <h2 className="text-lg font-bold text-slate-100 mt-2">
                Preview Data & Config Mapping
              </h2>
            </div>

            <button
              onClick={handleRunImport}
              disabled={importing || !parsedData.config}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition disabled:opacity-40"
            >
              {importing ? "Bezig met importeren..." : "🚀 Voer Import Definitief Uit"}
            </button>
          </div>

          {/* PARSING ERROR BANNER */}
          {parsedData.errors.length > 0 && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-lg space-y-1">
              {parsedData.errors.map((err, idx) => (
                <p key={idx}>⚠️ {err}</p>
              ))}
            </div>
          )}

          {/* IMPORT RESULTATEN STATS */}
          {resultStats && (
            <div className="p-4 bg-emerald-950/50 border border-emerald-800 rounded-lg space-y-2">
              <h3 className="text-sm font-bold text-emerald-400">✓ Import Succesvol Afgerond!</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono pt-1">
                <div>
                  <span className="text-slate-400 block">Dozen Aangemaakt:</span>
                  <span className="text-base text-emerald-300 font-bold">{resultStats.uniekeDozenAangemaakt}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Dozen Hergebruikt:</span>
                  <span className="text-base text-sky-300 font-bold">{resultStats.uniekeDozenGevonden}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Specimengroepen:</span>
                  <span className="text-base text-emerald-300 font-bold">{resultStats.specimengroepenAangemaakt}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Totaal Regels:</span>
                  <span className="text-base text-slate-200 font-bold">{resultStats.totaalVerwerkteRegels}</span>
                </div>
              </div>
            </div>
          )}

          {/* TABEL PREVIEW (EERSTE 5 REGELS) */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-semibold block">
              Gedetecteerde Datarijen ({parsedData.rows.length} totaal, toont eerste 5):
            </span>
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    {parsedData.headers.map((h, i) => (
                      <th key={i} className="p-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono bg-slate-900/50">
                  {parsedData.rows.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-800/40">
                      {row.map((col, cIdx) => (
                        <td key={cIdx} className="p-2.5 truncate max-w-[200px]">{col}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}