import csv from "csv-parser";
import { Readable } from "stream";

export interface CSVRow {
  [key: string]: string;
}

export async function parseCSV(
  fileBuffer: Buffer,
  encoding: BufferEncoding = "utf-8"
): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CSVRow[] = [];
    const stream = Readable.from(fileBuffer.toString(encoding));

    stream
      .pipe(csv())
      .on("data", (row: CSVRow) => {
        // Normalize keys to lowercase
        const normalizedRow: CSVRow = {};
        Object.keys(row).forEach((key) => {
          normalizedRow[key.toLowerCase().trim()] = row[key] ?? "";
        });
        rows.push(normalizedRow);
      })
      .on("end", () => resolve(rows))
      .on("error", (error) => reject(error));
  });
}

export function validateCSVHeaders(
  headers: string[],
  requiredHeaders: string[]
): { valid: boolean; missing: string[] } {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
  const missing = requiredHeaders.filter(
    (req) => !normalizedHeaders.includes(req.toLowerCase())
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}
