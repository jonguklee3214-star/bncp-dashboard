import type { FuelLog } from "@/types";
import { formatDateTime } from "./format";

// CSV Export (항목 61). 금액 컬럼 없음.
export function logsToCsv(logs: FuelLog[]): string {
  const header = [
    "Date",
    "Fuel Type",
    "Main Vehicle No.",
    "CONTROL N°",
    "Driver",
    "Company",
    "Team",
    "Part",
    "Vehicle Type",
    "Capacity",
    "Mileage",
    "Distance",
    "Fuel Volume (L)",
    "Remarks",
  ];
  const rows = logs.map((l) => [
    formatDateTime(l.fuelDatetime),
    l.fuelType,
    l.mainVehicleNo,
    l.controlNo,
    l.driver,
    l.company,
    l.team,
    l.part,
    l.vehicleType,
    l.capacity,
    l.mileageKm ?? "",
    l.distanceKm ?? "",
    l.fuelVolumeL,
    l.remarks,
  ]);
  return [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

// 간단한 CSV 파서 (따옴표·쉼표 처리). 첫 행을 헤더로 사용.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cur.push(field);
      field = "";
    } else if (c === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
