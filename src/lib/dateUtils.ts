// src/lib/dateUtils.ts

/**
 * Zet de huidige UTC/ISO string om naar een 'YYYY-MM-DDTHH:mm' formaat 
 * geschikt voor HTML <input type="datetime-local" />
 */
export function toLocalDatetimeInput(isoString?: string | null): string {
  const date = isoString ? new Date(isoString) : new Date();
  if (isNaN(date.getTime())) return "";

  const pad = (num: number) => String(num).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Zet de waarde uit een datetime-local input om naar een geldige ISO UTC string 
 * voor opslag in de SQLite database.
 */
export function toUtcIsoString(localDatetimeString: string): string {
  if (!localDatetimeString) return new Date().toISOString();
  return new Date(localDatetimeString).toISOString();
}

/**
 * Formatteert een ISO string naar een net Nederlands lokaal formaat voor weergave
 * bijv: "13-08-2026 15:03"
 */
export function formatToDutchDatetime(isoString?: string | null): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  return date.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}