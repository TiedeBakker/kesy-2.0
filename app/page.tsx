// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import ObjectModal from "@/src/components/ObjectModal";
import { haalStatistiekenOp, voerSyncUit, zoekObjecten } from "./actions";

export default function Home() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState<any>(null);

  // Check of de app op Vercel draait
  const isVercel = process.env.NEXT_PUBLIC_VERCEL_ENV !== undefined || process.env.VERCEL !== undefined;

  // Modal State Control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const [zoekterm, setZoekterm] = useState("");
  const [zoekResultaten, setZoekResultaten] = useState<any[]>([]);

  const laadData = async () => {
    setLoading(true);
    const s = await haalStatistiekenOp();
    setStats(s);
    setLoading(false);
  };

  useEffect(() => {
    laadData();
  }, []);

  const handleSync = async () => {
    if (isVercel) return; // Extra beveiliging
    setSyncing(true);
    setSyncLog(null);
    const res = await voerSyncUit();
    setSyncLog(res);
    await laadData();
    setSyncing(false);
  };

  const handleZoeken = async (term: string) => {
    setZoekterm(term);
    if (term.length > 1) {
      const res = await zoekObjecten(term);
      setZoekResultaten(res);
    } else {
      setZoekResultaten([]);
    }
  };

  // Route 1: Openen bestaand object
  const handleOpenObject = (id: string) => {
    setSelectedObjectId(id);
    setIsModalOpen(true);
  };

  // Route 1: Openen nieuw (leeg) object
  const handleNieuwObject = () => {
    setSelectedObjectId(null);
    setIsModalOpen(true);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-emerald-400">KESY 2.0 - Dashboard & Sync</h1>
            <p className="text-slate-400 text-sm mt-1">
              Beheer gegevens in SQLite SSOT en synchroniseer 2-weg met Turso Cloud.
            </p>
          </div>

          {/* GLOBAL NEW OBJECT BUTTON */}
          <button
            onClick={handleNieuwObject}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-lg transition flex items-center gap-2"
          >
            <span>➕</span> Nieuw Object
          </button>
        </div>

        {loading ? (
          <div className="p-4 bg-slate-800 rounded-lg text-slate-300">Statistieken laden...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LOKALE DB CARD */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-700 pb-2 flex justify-between items-center">
                <span>🖥️ Lokale SQLite DB (SSOT)</span>
                {isVercel && (
                  <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded font-mono">
                    N.v.t. op Cloud
                  </span>
                )}
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Totaal Objecten:</span>
                  <span className="font-mono font-bold text-emerald-400">{stats?.lokaal?.totaalObjecten ?? 0}</span>
                </div>
                <div className="flex justify-between text-slate-400 pl-4">
                  <span>- Publiek:</span>
                  <span className="font-mono">{stats?.lokaal?.publiekObjecten ?? 0}</span>
                </div>
                <div className="flex justify-between text-rose-400 pl-4">
                  <span>- Vertrouwelijk:</span>
                  <span className="font-mono">{stats?.lokaal?.vertrouwelijkObjecten ?? 0}</span>
                </div>
                <hr className="border-slate-700 my-2" />
                <div className="flex justify-between">
                  <span>Totaal Relaties:</span>
                  <span className="font-mono font-bold text-emerald-400">{stats?.lokaal?.totaalRelaties ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Totaal Parameterwaarden:</span>
                  <span className="font-mono font-bold text-emerald-400">{stats?.lokaal?.totaalParameters ?? 0}</span>
                </div>
              </div>
            </div>

            {/* TURSO CLOUD CARD */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-700 pb-2">
                  ☁️ Turso Cloud Database (Publiek)
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Gepubliceerde Objecten:</span>
                    <span className="font-mono font-bold text-sky-400">{stats?.turso?.totaalObjecten ?? 0}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Toont publieke objecten op Turso. Synchroniseert via Last-Write-Wins (LWW).
                  </p>
                </div>
              </div>

              <div>
                <button
                  onClick={handleSync}
                  disabled={syncing || isVercel}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border disabled:border-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
                >
                  {isVercel
                    ? "🔒 Sync alleen lokaal beschikbaar"
                    : syncing
                    ? "Bezig met 2-weg synchronisatie..."
                    : "🔄 Start Twee-Weg Sync (LWW)"}
                </button>
                {isVercel && (
                  <p className="text-[11px] text-slate-500 text-center mt-2">
                    Synchroniseren kan alleen vanuit de lokale desktop-omgeving gestart worden.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOG RESULTATEN */}
        {syncLog && (
          <div className={`p-4 rounded-xl border ${syncLog.success ? "bg-emerald-950/40 border-emerald-800" : "bg-rose-950/40 border-rose-800"}`}>
            <h3 className="font-semibold text-sm mb-1">{syncLog.success ? "✓ Sync Succesvol" : "❌ Sync Fout"}</h3>
            <pre className="text-xs font-mono text-slate-300 overflow-x-auto">
              {JSON.stringify(syncLog, null, 2)}
            </pre>
          </div>
        )}

        {/* OBJECTEN ZOEKBOX EN TEST-LAUNCHER */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-700 pb-2">
            🔍 Test Object Dossier Modal
          </h2>
          <input
            type="text"
            placeholder="Zoek een object op label (bijv. 'Bach' of 'Orgel')..."
            value={zoekterm}
            onChange={(e) => handleZoeken(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
          />
          {zoekResultaten.length > 0 && (
            <div className="divide-y divide-slate-700/50 border border-slate-700 rounded-lg overflow-hidden bg-slate-900">
              {zoekResultaten.map((obj) => (
                <div
                  key={obj.id}
                  onClick={() => handleOpenObject(obj.id)}
                  className="p-3 hover:bg-slate-800 cursor-pointer flex justify-between items-center transition"
                >
                  <span className="font-medium text-sky-400">{obj.label}</span>
                  <span className="text-xs font-mono text-slate-500">{obj.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* HET MODAL VENSTER */}
      <ObjectModal
        isOpen={isModalOpen}
        objectId={selectedObjectId}
        onClose={() => setIsModalOpen(false)}
        onSelectObject={(newId) => setSelectedObjectId(newId)}
        onSaveSuccess={() => laadData()}
      />
    </main>
  );
}