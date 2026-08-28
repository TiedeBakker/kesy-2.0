"use client";

import { useState } from "react";
import { parseCsvWithHeader, ParsedCsvResult } from "@/src/lib/csvParser";
import { voerCsvImportUit } from "./actions";
import { importeerStuurbestandAction, StuurbestandPayload } from "@/app/actions";
import DocumentInvoerForm from "./DocumentInvoerForm";

type MainTab = "import" | "snelle-invoer";
type ObjectInvoerType = "document";

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("snelle-invoer");
  const [selectedObjectType, setSelectedObjectType] = useState<ObjectInvoerType>("document");

  // State voor Import
  const [importType, setImportType] = useState<"csv" | "json" | null>(null);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsvResult | null>(null);
  const [parsedJson, setParsedJson] = useState<StuurbestandPayload | null>(null);
  const [importing, setImporting] = useState(false);
  const [resultStats, setResultStats] = useState<any>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isJson = file.name.endsWith(".json");
    const reader = new FileReader();

    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      setResultStats(null);

      if (isJson) {
        try {
          const jsonPayload: StuurbestandPayload = JSON.parse(text);
          setParsedJson(jsonPayload);
          setParsedCsv(null);
          setImportType("json");
        } catch (err) {
          alert("Ongeldig JSON-stuurbestand.");
        }
      } else {
        const result = parseCsvWithHeader(text);
        setParsedCsv(result);
        setParsedJson(null);
        setImportType("csv");
      }
    };

    reader.readAsText(file);
  };

  const handleRunImport = async () => {
    setImporting(true);

    if (importType === "csv" && parsedCsv?.config) {
      const res = await voerCsvImportUit({
        config: parsedCsv.config,
        rows: parsedCsv.rows,
      });
      setImporting(false);

      if (res.success) {
        setResultStats({ type: "csv", ...res.stats });
      } else {
        alert(`CSV Import mislukt: ${res.error}`);
      }
    } else if (importType === "json" && parsedJson) {
      const res = await importeerStuurbestandAction(parsedJson);
      setImporting(false);

      if (res.success) {
        setResultStats({
          type: "json",
          totaalSets: parsedJson.Sets.length,
          totaalMedia: res.count,
        });
      } else {
        alert(`JSON Import mislukt: ${res.error}`);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER EN HOOFD TAB-NAVIGATIE */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>📥</span> Invoer & Import
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gebruik gestroomlijnde invoerformulieren voor specifieke objecten of voer batch-imports uit.
          </p>
        </div>

        <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab("snelle-invoer")}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === "snelle-invoer"
                ? "bg-sky-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>⚡</span> Snelle Object Invoer
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === "import"
                ? "bg-sky-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📂</span> Batch Import (CSV/JSON)
          </button>
        </div>
      </div>

      {/* TAB 1: SNELLE OBJECT INVOER */}
      {activeTab === "snelle-invoer" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-400">Kies Objecttype:</span>
            <select
              value={selectedObjectType}
              onChange={(e) => setSelectedObjectType(e.target.value as ObjectInvoerType)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-sky-400 font-bold focus:outline-none"
            >
              <option value="document">📄 Digitaal Document (DArchieven)</option>
            </select>
          </div>

          {selectedObjectType === "document" && <DocumentInvoerForm />}
        </div>
      )}

      {/* TAB 2: UNIVERSAL IMPORT ENGINE */}
      {activeTab === "import" && (
        <div className="space-y-6">
          <div className="p-8 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl text-center space-y-3 hover:border-sky-500/50 transition cursor-pointer">
            <input
              type="file"
              accept=".csv,.txt,.json"
              onChange={handleFileUpload}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer block">
              <span className="text-3xl block mb-2">📄</span>
              <span className="text-sm font-semibold text-sky-400">
                Klik om CSV- of JSON-stuurbestand te selecteren
              </span>
              <span className="text-xs text-slate-500 block mt-1">
                Ondersteunt .csv met `#` config header & .json stuurbestanden
              </span>
            </label>
          </div>

          {(parsedCsv || parsedJson) && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-mono text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                    {importType === "json"
                      ? `Media Batch: ${parsedJson?.BatchId}`
                      : `CSV Profiel: ${parsedCsv?.config?.profile || "Geen profiel"}`}
                  </span>
                  <h2 className="text-lg font-bold text-slate-100 mt-2">
                    Preview Data & Mapping
                  </h2>
                </div>

                <button
                  onClick={handleRunImport}
                  disabled={importing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition disabled:opacity-40"
                >
                  {importing ? "Bezig met importeren..." : "🚀 Voer Import Definitief Uit"}
                </button>
              </div>

              {resultStats && (
                <div className="p-4 bg-emerald-950/50 border border-emerald-800 rounded-lg space-y-2">
                  <h3 className="text-sm font-bold text-emerald-400">✓ Import Succesvol Afgerond!</h3>
                  {resultStats.type === "json" ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono pt-1">
                      <div>
                        <span className="text-slate-400 block">Sets Aangemaakt:</span>
                        <span className="text-base text-emerald-300 font-bold">{resultStats.totaalSets}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Media Geïmporteerd:</span>
                        <span className="text-base text-sky-300 font-bold">{resultStats.totaalMedia}</span>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}