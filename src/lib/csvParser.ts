// src/lib/csvParser.ts

export interface ImportStepConfig {
  step: number;
  target: "parent_object" | "child_object";
  contextKey?: string;
  labelTemplate: string;
  objectTypeId: string;
  relations?: {
    relationTypeId: string;
    relatedContextKey: string;
    direction: "outgoing" | "incoming";
  }[];
  parameters?: {
    parameterId: string;
    column: number;
    type?: "string" | "number";
  }[];
}

export interface ImportConfigHeader {
  profile: string;
  version: string;
  delimiter?: string;
  ignoreEmptyRows?: boolean;
  isConfidential?: boolean; // 🔒 Nieuw: bepaalt vertrouwelijkheid van de hele import
  steps: ImportStepConfig[];
}

export interface ParsedCsvResult {
  config: ImportConfigHeader | null;
  headers: string[];
  rows: string[][];
  errors: string[];
}

export function parseCsvWithHeader(rawCsvText: string): ParsedCsvResult {
  const lines = rawCsvText.split(/\r?\n/);
  const jsonHeaderLines: string[] = [];
  const dataLines: string[] = [];
  const errors: string[] = [];

  // 1. Scheid JSON header regels (#) van de dataset
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      jsonHeaderLines.push(trimmed.substring(1).trim());
    } else if (trimmed.length > 0) {
      dataLines.push(line);
    }
  }

  // 2. Parse JSON Metadata Config
  let config: ImportConfigHeader | null = null;
  if (jsonHeaderLines.length > 0) {
    try {
      config = JSON.parse(jsonHeaderLines.join("\n"));
    } catch (err: any) {
      errors.push(`Fout bij parsen van Metadata Header: ${err.message}`);
    }
  }

  const delimiter = config?.delimiter || ";";

  // 3. Verwerk data regels & filter ruis (zoals ;;;;)
  const rows: string[][] = [];
  let csvHeaders: string[] = [];

  dataLines.forEach((line, index) => {
    // Splits op scheidingsteken (rekening houdend met quotes)
    const rawCols = line.split(delimiter).map((col) => col.replace(/^"(.*)"$/, "$1").trim());

    // Check of regel leeg is (bijv. ;;;;)
    const hasData = rawCols.some((col) => col.length > 0);
    if (!hasData && (config?.ignoreEmptyRows ?? true)) {
      return; // Sla lege regel over
    }

    if (csvHeaders.length === 0) {
      csvHeaders = rawCols; // Eerste geldige regel is de CSV kolommenkop
    } else {
      rows.push(rawCols);
    }
  });

  return {
    config,
    headers: csvHeaders,
    rows,
    errors,
  };
}