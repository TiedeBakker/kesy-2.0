// src/app/admin/catalogus/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  haalCatalogiOp,
  slaParameterOp,
  slaRelatieTypeOp,
  slaUnitOp,
  slaParameterSetOp,
  verwijderCatalogusItem
} from "@/app/actions";

export default function CatalogusBeheerPage() {
  const [activeTab, setActiveTab] = useState<"parameters" | "relations" | "sets" | "units">("parameters");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ parameters: [], relations: [], units: [], valueTypes: [], parameterSets: [] });
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [paramForm, setParamForm] = useState({ id: "", code: "", label: "", dataType: "string", unit: "" });
  const [relForm, setRelForm] = useState({ id: "", label: "" });
  const [unitForm, setUnitForm] = useState({ id: "", label: "", symbol: "" });
  const [setForm, setSetForm] = useState<{ id: string; label: string; items: any[] }>({ id: "", label: "", items: [] });

  const laadData = useCallback(async () => {
    setLoading(true);
    const res = await haalCatalogiOp();
    if (res.success) {
      setData(res.data);
    } else {
      setError(res.error || "Fout bij ophalen catalogus");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    laadData();
  }, [laadData]);

  // --- HANDLERS ---
  const handleSaveParam = async () => {
    if (!paramForm.label || !paramForm.code) return alert("Code en Label verplicht");
    const res = await slaParameterOp(paramForm);
    if (res.success) {
      setParamForm({ id: "", code: "", label: "", dataType: "string", unit: "" });
      laadData();
    } else setError(res.error);
  };

  const handleSaveRel = async () => {
    if (!relForm.label) return alert("Label verplicht");
    const res = await slaRelatieTypeOp(relForm);
    if (res.success) {
      setRelForm({ id: "", label: "" });
      laadData();
    } else setError(res.error);
  };

  const handleSaveUnit = async () => {
    if (!unitForm.label || !unitForm.symbol) return alert("Label en Symbool verplicht");
    const res = await slaUnitOp(unitForm);
    if (res.success) {
      setUnitForm({ id: "", label: "", symbol: "" });
      laadData();
    } else setError(res.error);
  };

  const handleSaveSet = async () => {
    if (!setForm.label) return alert("Setnaam verplicht");
    const res = await slaParameterSetOp(setForm);
    if (res.success) {
      setSetForm({ id: "", label: "", items: [] });
      laadData();
    } else setError(res.error);
  };

  const handleVerwijder = async (tabel: any, id: string) => {
    if (!confirm("Weet je zeker dat je dit stamgegeven wilt verwijderen?")) return;
    const res = await verwijderCatalogusItem(tabel, id);
    if (res.success) laadData();
    else setError(res.error);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>⚙️</span> Catalogus & Stamgegevens Beheer
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Beheer parameters, relatietypen, eenheden en presets voor testen en productie.
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            ← Terug naar Dashboard
          </a>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-200 rounded-lg text-xs flex justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* TABBLADEN */}
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: "parameters", label: "📊 Parameters", count: data.parameters.length },
            { id: "relations", label: "🔗 Relatietypen", count: data.relations.length },
            { id: "sets", label: "📦 Parameter Sets", count: data.parameterSets.length },
            { id: "units", label: "📏 Eenheden", count: data.units.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === tab.id
                ? "border-sky-500 text-sky-400 bg-slate-900/50"
                : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              <span>{tab.label}</span>
              <span className="bg-slate-800 text-xs px-2 py-0.5 rounded-full font-mono text-slate-300">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500">Stamgegevens laden...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* TAB 1: PARAMETERS */}
            {activeTab === "parameters" && (
              <>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h3 className="font-bold text-slate-200 text-sm">
                    {paramForm.id ? "✏️ Parameter Bewerken" : "➕ Nieuwe Parameter"}
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Code / Unieke Key</label>
                      <input
                        type="text"
                        value={paramForm.code}
                        onChange={(e) => setParamForm({ ...paramForm, code: e.target.value })}
                        placeholder="bijv. LENGTE_M, PH_WAARDE"
                        className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-100 outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Label (Weergavenaam)</label>
                      <input
                        type="text"
                        value={paramForm.label}
                        onChange={(e) => setParamForm({ ...paramForm, label: e.target.value })}
                        placeholder="bijv. Lengte in meters"
                        className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-100 outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-1">Data Type</label>
                        <select
                          value={paramForm.dataType || ""}
                          onChange={(e) => setParamForm({ ...paramForm, dataType: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 px-2 py-1.5 rounded text-slate-100 outline-none"
                        >
                          <option value="string">Tekst (String)</option>
                          <option value="number">Getal (Number)</option>
                          <option value="boolean">Ja/Nee (Boolean)</option>
                          <option value="date">Datum (Date)</option>
                          <option value="markdown">Markdown / Geavanceerde tekst</option>
                          <option value="file">📁 Bestand / Media / Document (File)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Eenheid (Optioneel)</label>
                        <select
                          value={paramForm.unit || ""}
                          onChange={(e) => setParamForm({ ...paramForm, unit: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 px-2 py-1.5 rounded text-slate-100 outline-none"
                        >
                          <option value="">- Geen -</option>
                          {data.units.map((u: any) => (
                            <option key={u.id} value={u.symbol}>{u.label} ({u.symbol})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSaveParam}
                        className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-1.5 rounded transition"
                      >
                        {paramForm.id ? "Bijwerken" : "Toevoegen"}
                      </button>
                      {paramForm.id && (
                        <button
                          onClick={() => setParamForm({ id: "", code: "", label: "", dataType: "string", unit: "" })}
                          className="bg-slate-800 px-3 py-1.5 rounded text-slate-400 hover:text-slate-200"
                        >
                          Annuleer
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-h-125 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                      <tr>
                        <th className="p-3">Code</th>
                        <th className="p-3">Label</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Eenheid</th>
                        <th className="p-3 text-right">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {[...data.parameters]
                        .sort((a: any, b: any) => a.label.localeCompare(b.label))
                        .map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-800/30">
                            <td className="p-3 font-mono text-sky-400">{p.code}</td>
                            <td className="p-3 font-semibold text-slate-200">{p.label}</td>
                            <td className="p-3 text-slate-400">{p.dataType}</td>
                            <td className="p-3 text-emerald-400">{p.unit || "-"}</td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => setParamForm(p)}
                                className="text-slate-400 hover:text-sky-400"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleVerwijder("parameters", p.id)}
                                className="text-slate-500 hover:text-rose-400"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* TAB 2: RELATIETYPEN */}
            {activeTab === "relations" && (
              <>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h3 className="font-bold text-slate-200 text-sm">
                    {relForm.id ? "✏️ Relatietype Bewerken" : "➕ Nieuw Relatietype"}
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Label / Naam van relatie</label>
                      <input
                        type="text"
                        value={relForm.label}
                        onChange={(e) => setRelForm({ ...relForm, label: e.target.value })}
                        placeholder="bijv. Is onderdeel van, Grenst aan"
                        className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-100 outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSaveRel}
                        className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-1.5 rounded transition"
                      >
                        {relForm.id ? "Bijwerken" : "Toevoegen"}
                      </button>
                      {relForm.id && (
                        <button
                          onClick={() => setRelForm({ id: "", label: "" })}
                          className="bg-slate-800 px-3 py-1.5 rounded text-slate-400 hover:text-slate-200"
                        >
                          Annuleer
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-h-125 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Label</th>
                        <th className="p-3 text-right">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {[...data.relations]
                        .sort((a: any, b: any) => a.label.localeCompare(b.label))
                        .map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-800/30">
                            <td className="p-3 font-mono text-slate-500">{r.id}</td>
                            <td className="p-3 font-semibold text-emerald-400">🔗 {r.label}</td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => setRelForm(r)}
                                className="text-slate-400 hover:text-sky-400"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleVerwijder("relations", r.id)}
                                className="text-slate-500 hover:text-rose-400"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* TAB 3: PARAMETER SETS */}
            {activeTab === "sets" && (
              <>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h3 className="font-bold text-slate-200 text-sm">
                    {setForm.id ? "✏️ Set Bewerken" : "➕ Nieuwe Parameter Set"}
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Set Naam / Preset Label</label>
                      <input
                        type="text"
                        value={setForm.label}
                        onChange={(e) => setSetForm({ ...setForm, label: e.target.value })}
                        placeholder="bijv. Vaste Planten Opname"
                        className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-100 outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Parameters in deze set:</label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {data.parameters.map((p: any) => {
                          const bestaandeItem = setForm.items.find(i => i.parameterId === p.id);
                          const isChecked = Boolean(bestaandeItem);

                          return (
                            <div key={p.id} className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800">
                              <label className="flex items-center gap-2 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSetForm({
                                        ...setForm,
                                        items: [...setForm.items, { parameterId: p.id, isMeetwaarde: false, volgnr: setForm.items.length + 1 }]
                                      });
                                    } else {
                                      setSetForm({
                                        ...setForm,
                                        items: setForm.items.filter(i => i.parameterId !== p.id)
                                      });
                                    }
                                  }}
                                  className="rounded border-slate-700 bg-slate-800 text-sky-500"
                                />
                                <span className="text-slate-200 font-medium">{p.label}</span>
                              </label>

                              {isChecked && (
                                <label className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                                  <input
                                    type="checkbox"
                                    checked={bestaandeItem?.isMeetwaarde || false}
                                    onChange={(e) => {
                                      setSetForm({
                                        ...setForm,
                                        items: setForm.items.map(i => i.parameterId === p.id ? { ...i, isMeetwaarde: e.target.checked } : i)
                                      });
                                    }}
                                  />
                                  <span>Meting</span>
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={handleSaveSet}
                      className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-1.5 rounded transition mt-2"
                    >
                      {setForm.id ? "Set Bijwerken" : "Set Opslaan"}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 max-h-125 overflow-y-auto">
                  {[...data.parameterSets]
                    .sort((a: any, b: any) => a.label.localeCompare(b.label))
                    .map((s: any) => (
                      <div key={s.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-sky-400 text-sm flex items-center gap-2">
                            <span>📦</span> {s.label}
                          </h4>
                          <div className="space-x-2">
                            <button onClick={() => setSetForm(s)} className="text-xs text-slate-400 hover:text-sky-400">✏️ Bewerken</button>
                            <button onClick={() => handleVerwijder("parameter_sets", s.id)} className="text-xs text-slate-500 hover:text-rose-400">🗑️</button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {s.items.map((item: any) => {
                            const paramDef = data.parameters.find((p: any) => p.id === item.parameterId);
                            return (
                              <span key={item.id} className="text-[11px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-300 flex items-center gap-1">
                                <span>{paramDef?.label || item.parameterId}</span>
                                {item.isMeetwaarde && <span className="text-[9px] text-amber-400" title="Geteld als variabel meetpunt">📈</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>              </>
            )}

            {/* TAB 4: EENHEDEN */}
            {activeTab === "units" && (
              <>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <h3 className="font-bold text-slate-200 text-sm">
                    {unitForm.id ? "✏️ Eenheid Bewerken" : "➕ Nieuwe Eenheid"}
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Label (Omschrijving)</label>
                      <input
                        type="text"
                        value={unitForm.label}
                        onChange={(e) => setUnitForm({ ...unitForm, label: e.target.value })}
                        placeholder="bijv. Meter, Celsius"
                        className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-100 outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Symbool / Weergave</label>
                      <input
                        type="text"
                        value={unitForm.symbol}
                        onChange={(e) => setUnitForm({ ...unitForm, symbol: e.target.value })}
                        placeholder="bijv. m, °C, cm"
                        className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded text-slate-100 outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <button
                      onClick={handleSaveUnit}
                      className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-1.5 rounded transition mt-2"
                    >
                      Opslaan
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-h-125 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className=" text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                      <tr>
                        <th className="p-3">Symbool</th>
                        <th className="p-3">Omschrijving</th>
                        <th className="p-3 text-right">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {[...data.units]
                        .sort((a: any, b: any) => a.label.localeCompare(b.label))
                        .map((u: any) => (
                          <tr key={u.id} className="hover:bg-slate-800/30">
                            <td className="p-3 font-mono text-emerald-400 font-bold">{u.symbol}</td>
                            <td className="p-3 text-slate-200">{u.label}</td>
                            <td className="p-3 text-right space-x-2">
                              <button onClick={() => setUnitForm(u)} className="text-slate-400 hover:text-sky-400">✏️</button>
                              <button onClick={() => handleVerwijder("units", u.id)} className="text-slate-500 hover:text-rose-400">🗑️</button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>              </>
            )}

          </div>
        )}

      </div>
    </div>
  );
}