export type ExportFormat = "csv" | "json";

export function toCsv(columns: string[], rows: unknown[][]): string {
  const lines: string[] = [];
  lines.push(columns.map(csvField).join(","));
  for (const row of rows) {
    lines.push(row.map(csvField).join(","));
  }
  return lines.join("\r\n");
}

export function toJson(columns: string[], rows: unknown[][]): string {
  const objects = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = jsonValue(row[i]);
    }
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Uint8Array) return quote(toBase64(value));
  const s = String(value);
  if (/[",\r\n]/.test(s)) return quote(s);
  return s;
}

function quote(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

function jsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Uint8Array) return toBase64(value);
  return value;
}

function toBase64(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}
