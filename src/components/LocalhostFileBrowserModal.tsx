// src/components/LocalhostFileBrowserModal.tsx
"use client";

import { useState, useEffect } from "react";

interface Item {
  name: string;
  isDirectory: boolean;
  relPath: string;
  url: string;
}

interface LocalhostFileBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (url: string) => void;
}

export default function LocalhostFileBrowserModal({
  isOpen,
  onClose,
  onSelectFile,
}: LocalhostFileBrowserModalProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const laadMap = async (path: string = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
      const data = await res.json();

      if (res.ok) {
        setItems(data.items);
        setCurrentPath(data.currentPath);
      } else {
        setError(data.error || "Fout bij ophalen van mappen.");
      }
    } catch (e) {
      setError("Kan geen verbinding maken met de bestandsbrowser.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      laadMap("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const gaOmhoog = () => {
    if (!currentPath) return;
    const delen = currentPath.split("/").filter(Boolean);
    delen.pop();
    laadMap(delen.join("/"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl p-5 space-y-4 shadow-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>📂</span>
            <span>Blader in localhost (C:\wamp64\www)</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>

        {/* Broodkruimels / Pad navigatie */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded border border-slate-800 text-xs font-mono text-slate-300">
          <button
            type="button"
            onClick={gaOmhoog}
            disabled={!currentPath}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-[11px]"
          >
            ⬆️ Omhoog
          </button>
          <span className="text-slate-500">/www/</span>
          <span className="text-sky-400 truncate">{currentPath || "(hoofdmap)"}</span>
        </div>

        {error && (
          <div className="p-2 bg-rose-950/80 border border-rose-700 text-rose-200 text-xs rounded">
            ⚠️ {error}
          </div>
        )}

        {/* Lijst van bestanden en mappen */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-[300px]">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">Mappen en bestanden laden...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-slate-500 italic text-xs">Deze map is leeg.</div>
          ) : (
            items.map((item) => (
              <div
                key={item.relPath}
                onClick={() => {
                  if (item.isDirectory) {
                    laadMap(item.relPath);
                  } else {
                    onSelectFile(item.url);
                    onClose();
                  }
                }}
                className={`p-2 rounded text-xs flex items-center justify-between cursor-pointer transition ${
                  item.isDirectory
                    ? "bg-slate-800/60 hover:bg-slate-800 text-amber-300 font-semibold"
                    : "bg-slate-950/60 hover:bg-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span>{item.isDirectory ? "📁" : "📄"}</span>
                  <span className="truncate">{item.name}</span>
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  {item.isDirectory ? "Map" : "Selecteer ➔"}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 pt-3">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
          >
            Annuleren
          </button>
        </div>

      </div>
    </div>
  );
}