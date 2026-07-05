import type { ListItemRow } from "../db";

export interface ImportedItemRow {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  area: string;
  brand: string;
  priority: string;
  notes: string;
  checked: boolean;
  favourite?: boolean;
}

const CSV_HEADERS = ["name", "quantity", "unit", "category", "area", "brand", "priority", "notes", "checked"];

const csvEscape = (value: unknown) => {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const itemsToCSV = (items: ListItemRow[]) => {
  const rows = [CSV_HEADERS.join(",")];
  for (const item of items) {
    rows.push(
      [
        item.name,
        item.quantity,
        item.unit || "",
        item.category?.category_name || "",
        item.area?.area_name || "",
        item.brand || "",
        item.priority || "",
        item.notes || "",
        item.checked ? "true" : "false",
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return rows.join("\n");
};

export const itemsToJSON = (items: ListItemRow[]) =>
  JSON.stringify(
    items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category?.category_name || null,
      area: item.area?.area_name || null,
      brand: item.brand,
      priority: item.priority,
      notes: item.notes,
      checked: item.checked,
      favourite: item.favourite,
    })),
    null,
    2
  );

// Not a full RFC 4180 parser, but handles quoted fields with embedded
// commas/quotes — covers both what itemsToCSV produces and typical
// spreadsheet exports.
const parseCSVLine = (line: string): string[] => {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
};

export const parseCSV = (text: string): ImportedItemRow[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines
    .slice(1)
    .map((line) => {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i];
      });
      return {
        name: (row.name || "").trim(),
        quantity: parseFloat(row.quantity) || 1,
        unit: row.unit || "",
        category: row.category || "",
        area: row.area || "",
        brand: row.brand || "",
        priority: row.priority || "normal",
        notes: row.notes || "",
        checked: row.checked === "true",
      };
    })
    .filter((row) => row.name);
};

export const parseJSON = (text: string): ImportedItemRow[] => {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("Expected a JSON array of items");
  return data
    .map((row) => ({
      name: (row.name || "").trim(),
      quantity: Number(row.quantity) || 1,
      unit: row.unit || "",
      category: row.category || "",
      area: row.area || "",
      brand: row.brand || "",
      priority: row.priority || "normal",
      notes: row.notes || "",
      checked: !!row.checked,
      favourite: !!row.favourite,
    }))
    .filter((row) => row.name);
};

export const downloadFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
