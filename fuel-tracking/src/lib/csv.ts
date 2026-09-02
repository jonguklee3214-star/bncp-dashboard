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

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
