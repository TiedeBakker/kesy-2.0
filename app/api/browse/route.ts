// app/api/browse/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BASE_DIR = "C:\\wamp64\\www";
const BASE_URL = "http://localhost";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subPath = searchParams.get("path") || "";

  // Beveiliging: Voorkom dat men via '../../' buiten C:\wamp64\www kan navigeren
  const safeSubPath = path.normalize(subPath).replace(/^(\.\.[\/\\])+/, "").replace(/^[\/\\]+/, "");
  const targetDir = path.join(BASE_DIR, safeSubPath);

  try {
    if (!fs.existsSync(targetDir)) {
      return NextResponse.json({ error: "Map niet gevonden op server" }, { status: 404 });
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });

    const items = entries
      .filter((entry) => !entry.name.startsWith(".")) // Verberg verborgen bestanden
      .map((entry) => {
        const itemSubPath = path.join(safeSubPath, entry.name).replace(/\\/g, "/");
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          relPath: itemSubPath,
          url: `${BASE_URL}/${itemSubPath}`,
        };
      })
      // Sorteer: Mappen eerst, daarna bestanden
      .sort((a, b) => (b.isDirectory ? 1 : 0) - (a.isDirectory ? 1 : 0) || a.name.localeCompare(b.name));

    return NextResponse.json({
      currentPath: safeSubPath.replace(/\\/g, "/"),
      items,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}