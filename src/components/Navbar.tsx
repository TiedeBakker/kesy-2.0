// src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Maximize, Minimize } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Monitor of we fullscreen zijn of niet
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Fout bij inschakelen fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const navItems = [
    { label: "Dashboard", href: "/", icon: "📊" },
    { label: "Catalogus", href: "/admin/catalogus", icon: "📚" },
    { label: "Invoer & Import", href: "/import", icon: "📥" },
    { label: "Presentaties", href: "/presentaties", icon: "📈" },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 w-full select-none">
      <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* LOGO */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-base text-sky-400 hover:opacity-90">
            <span>📦</span>
            <span className="tracking-wide">
              Kesy <span className="text-[10px] text-sky-400 bg-sky-950 border border-sky-800/80 px-1.5 py-0.5 rounded font-mono font-semibold">2.0</span>
            </span>
          </Link>

          {/* NAVIGATIE LINKS */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-sky-600/90 text-white shadow-sm font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* STATUS & FULLSCREEN TOGGLE */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-100 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-md transition"
            title="Schakel Volledig Scherm (F11)"
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Scherm Herstellen</span>
              </>
            ) : (
              <>
                <Maximize className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Volledig Scherm</span>
              </>
            )}
          </button>

          <span className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Lokaal Actief
          </span>
        </div>
      </div>
    </header>
  );
}