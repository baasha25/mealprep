// Minimal RFC-4180-ish CSV parser — handles quoted fields, embedded commas,
// escaped quotes ("") and newlines inside quotes. Used by the migration importer.
// Kept dependency-free on purpose (well-scoped, tested).

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // flush trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // drop fully-empty lines
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/**
 * Parse CSV with a header row into objects keyed by normalized header
 * (lower-cased, trimmed). Returns [] if there is no data beyond the header.
 */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });
}

/** Split a delimited cell ("fish; dairy") into a clean list. */
export function splitList(cell: string | undefined): string[] {
  if (!cell) return [];
  return cell
    .split(/[;,|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
