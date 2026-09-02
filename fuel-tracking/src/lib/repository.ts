import type { FuelLog, Part, Vehicle } from "@/types";
import { SEED_VEHICLES } from "@/data/seed";
import { demoAppendLog, demoGetLogs, demoUpsertVehicle, demoVehicles, isConfigured } from "./demo";
import {
  HEADERS,
  SHEET_TABS,
  appendRow,
  ensureTab,
  readTab,
  writeHeader,
  writeRow,
} from "./sheets";

// ─────────────────────────────────────────────────────────────
//  Vehicle_Master / Fuel_Log 를 도메인 객체로 읽고 쓰는 계층.
// ─────────────────────────────────────────────────────────────

function num(v: string | undefined): number | null {
  if (v === undefined || v === "" || v.toUpperCase() === "N/A") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function rowsToObjects(rows: string[][], header: readonly string[]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const head = rows[0];
  const idx = header.map((h) => head.indexOf(h));
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      const col = idx[i];
      o[h] = col >= 0 ? (r[col] ?? "") : "";
    });
    return o;
  });
}

// ── Vehicle ──
function toVehicle(o: Record<string, string>): Vehicle {
  return {
    vehicleId: o.vehicle_id,
    fuelType: o.fuel_type === "gasoline" ? "gasoline" : "diesel",
    mainVehicleNo: o.main_vehicle_no ?? "",
    controlNo: o.control_no ?? "",
    equipmentName: o.equipment_name ?? "",
    vehicleType: o.vehicle_type ?? "",
    capacity: o.capacity ?? "",
    teamCode: o.team_code ?? "",
    hourKm: o.hour_km ?? "",
    company: o.company ?? "Construction",
    team: o.team ?? "",
    part: (o.part ?? "") as Part,
    driverIds: (o.driver_ids ?? "")
      .split("/")
      .map((d) => d.trim())
      .filter(Boolean),
    status: o.status === "inactive" ? "inactive" : "active",
    createdAt: o.created_at ?? "",
    updatedAt: o.updated_at ?? "",
  };
}

function vehicleToRow(v: Vehicle): string[] {
  return [
    v.vehicleId,
    v.fuelType,
    v.mainVehicleNo,
    v.controlNo,
    v.equipmentName,
    v.vehicleType,
    v.capacity,
    v.teamCode,
    v.hourKm,
    v.company,
    v.team,
    v.part,
    v.driverIds.join(" / "),
    v.status,
    v.createdAt,
    v.updatedAt,
  ];
}

export async function getVehicles(): Promise<Vehicle[]> {
  if (!isConfigured()) return demoVehicles();
  const rows = await readTab(SHEET_TABS.vehicles);
  return rowsToObjects(rows, HEADERS.vehicles)
    .filter((o) => o.vehicle_id)
    .map(toVehicle);
}

/**
 * 차량 추가/수정 (항목 62·63·64). vehicle_id 로 찾아 있으면 덮고 없으면 추가.
 * Fuel Log 가 있는 차량은 삭제 대신 status=inactive 로 처리한다 (데이터 무결성).
 */
export async function upsertVehicle(v: Vehicle): Promise<void> {
  if (!isConfigured()) {
    demoUpsertVehicle(v);
    return;
  }
  const rows = await readTab(SHEET_TABS.vehicles);
  const header = rows[0] ?? HEADERS.vehicles;
  const idCol = header.indexOf("vehicle_id");
  let rowNumber = -1;
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i]?.[idCol] === v.vehicleId) {
      rowNumber = i + 1; // 1-based
      break;
    }
  }
  if (rowNumber > 0) {
    await writeRow(SHEET_TABS.vehicles, rowNumber, vehicleToRow(v));
  } else {
    await appendRow(SHEET_TABS.vehicles, vehicleToRow(v));
  }
}

// ── FuelLog ──
function toFuelLog(o: Record<string, string>): FuelLog {
  return {
    recordId: o.record_id,
    fuelDatetime: o.fuel_datetime ?? "",
    fuelType: o.fuel_type === "gasoline" ? "gasoline" : "diesel",
    mainVehicleNo: o.main_vehicle_no ?? "",
    controlNo: o.control_no ?? "",
    driver: o.driver ?? "",
    company: o.company ?? "",
    team: o.team ?? "",
    part: (o.part ?? "") as Part,
    vehicleType: o.vehicle_type ?? "",
    capacity: o.capacity ?? "",
    teamCode: o.team_code ?? "",
    mileageKm: num(o.mileage_km),
    previousMileageKm: num(o.previous_mileage_km),
    distanceKm: num(o.distance_km),
    fuelVolumeL: num(o.fuel_volume_l) ?? 0,
    remarks: o.remarks ?? "",
    createdAt: o.created_at ?? "",
    updatedAt: o.updated_at ?? "",
  };
}

function fuelLogToRow(l: FuelLog): (string | number)[] {
  return [
    l.recordId,
    l.fuelDatetime,
    l.fuelType,
    l.mainVehicleNo,
    l.controlNo,
    l.driver,
    l.company,
    l.team,
    l.part,
    l.vehicleType,
    l.capacity,
    l.teamCode,
    l.mileageKm ?? "",
    l.previousMileageKm ?? "",
    l.distanceKm ?? "",
    l.fuelVolumeL,
    l.remarks,
    l.createdAt,
    l.updatedAt,
  ];
}

export async function getFuelLogs(): Promise<FuelLog[]> {
  if (!isConfigured()) return demoGetLogs();
  const rows = await readTab(SHEET_TABS.logs);
  return rowsToObjects(rows, HEADERS.logs)
    .filter((o) => o.record_id)
    .map(toFuelLog);
}

export async function appendFuelLog(log: FuelLog): Promise<void> {
  if (!isConfigured()) {
    demoAppendLog(log);
    return;
  }
  await appendRow(SHEET_TABS.logs, fuelLogToRow(log));
}

/** 동일 차량(가솔린)의 가장 최근 mileage → previous mileage 자동조회 (항목 32). */
export async function getLatestMileage(mainVehicleNo: string): Promise<number | null> {
  const logs = await getFuelLogs();
  const mine = logs
    .filter((l) => l.mainVehicleNo === mainVehicleNo && l.mileageKm != null)
    .sort((a, b) => b.fuelDatetime.localeCompare(a.fuelDatetime));
  return mine.length ? mine[0].mileageKm : null;
}

/** 중복 저장 방지: 같은 recordId 가 이미 있으면 true (항목 55). */
export async function recordExists(recordId: string): Promise<boolean> {
  const logs = await getFuelLogs();
  return logs.some((l) => l.recordId === recordId);
}

// ── 초기화: 헤더 + seed 데이터 심기 ──
export async function initSheet(): Promise<{ vehicles: number; demo?: boolean }> {
  if (!isConfigured()) return { vehicles: SEED_VEHICLES.length, demo: true };
  await ensureTab(SHEET_TABS.vehicles);
  await ensureTab(SHEET_TABS.logs);
  await ensureTab(SHEET_TABS.settings);

  await writeHeader(SHEET_TABS.vehicles, HEADERS.vehicles);
  await writeHeader(SHEET_TABS.logs, HEADERS.logs);
  await writeHeader(SHEET_TABS.settings, HEADERS.settings);

  // 이미 차량이 있으면 seed 를 덮지 않는다 (과거 데이터 보존, 항목 90).
  const existing = await getVehicles();
  if (existing.length === 0) {
    let rowNo = 2;
    for (const v of SEED_VEHICLES) {
      await writeRow(SHEET_TABS.vehicles, rowNo, vehicleToRow(v));
      rowNo += 1;
    }
    return { vehicles: SEED_VEHICLES.length };
  }
  return { vehicles: existing.length };
}
