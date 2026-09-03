import type { FuelLog } from "@/types";

const TZ = "Asia/Baghdad";

export type PeriodKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom";

export interface Filters {
  period: PeriodKey;
  customStart?: string; // YYYY-MM-DD
  customEnd?: string;
  fuelType?: "diesel" | "gasoline" | "";
  part?: string;
  mainVehicleNo?: string;
  controlNo?: string;
  driver?: string;
  vehicleType?: string;
}

// 현장 기준 날짜 문자열 (YYYY-MM-DD)
export function siteDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}
function siteMonth(iso: string): string {
  return siteDate(iso).slice(0, 7); // YYYY-MM
}

// ISO Week (항목 76)
function isoWeek(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: TZ }));
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 기간을 [start, end] (YYYY-MM-DD, 포함) 으로 해석. */
export function resolvePeriod(f: Filters): { start: string; end: string } {
  const today = todayStr();
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 월=0
  const monthStart = today.slice(0, 8) + "01";
  switch (f.period) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { start: y, end: y };
    }
    case "thisWeek": {
      const s = addDays(today, -dow);
      return { start: s, end: addDays(s, 6) };
    }
    case "lastWeek": {
      const s = addDays(today, -dow - 7);
      return { start: s, end: addDays(s, 6) };
    }
    case "thisMonth":
      return { start: monthStart, end: addDays(addMonth(monthStart, 1), -1) };
    case "lastMonth": {
      const s = addMonth(monthStart, -1);
      return { start: s, end: addDays(monthStart, -1) };
    }
    case "thisYear":
      return { start: today.slice(0, 4) + "-01-01", end: today.slice(0, 4) + "-12-31" };
    case "custom":
      return { start: f.customStart || today, end: f.customEnd || today };
    default:
      return { start: today, end: today };
  }
}

function addMonth(dateStr: string, n: number): string {
  const [y, m] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** 필터(기간 + 조건) 적용. 각 필드가 KPI·그래프에 동일하게 반영 (항목 43). */
export function applyFilters(logs: FuelLog[], f: Filters): FuelLog[] {
  const { start, end } = resolvePeriod(f);
  return logs.filter((l) => {
    const d = siteDate(l.fuelDatetime);
    if (d < start || d > end) return false;
    if (f.fuelType && l.fuelType !== f.fuelType) return false;
    if (f.part && l.part !== f.part) return false;
    if (f.mainVehicleNo && l.mainVehicleNo !== f.mainVehicleNo) return false;
    if (f.controlNo && l.controlNo !== f.controlNo) return false;
    if (f.vehicleType && l.vehicleType !== f.vehicleType) return false;
    // 복수 운전자 차량은 각 운전자 이름으로 검색 가능 (항목 45)
    if (f.driver && !l.driver.split("/").map((s) => s.trim()).includes(f.driver)) return false;
    return true;
  });
}

export interface Kpi {
  transactions: number;
  volume: number;
  volumeDiesel: number;
  volumeGasoline: number;
  distance: number;
  avgVolume: number;
  activeVehicles: number;
}

// 주유 기록 1건 = 주유 1회 (항목 21·37). 운전자 수와 무관.
export function computeKpi(logs: FuelLog[]): Kpi {
  const transactions = logs.length;
  const volume = round(logs.reduce((s, l) => s + l.fuelVolumeL, 0));
  const sum = (ft: FuelLog["fuelType"]) =>
    round(logs.filter((l) => l.fuelType === ft).reduce((s, l) => s + l.fuelVolumeL, 0));
  const volumeDiesel = sum("diesel");
  const volumeGasoline = sum("gasoline");
  const distance = round(logs.reduce((s, l) => s + (l.distanceKm ?? 0), 0));
  const avgVolume = transactions ? round(volume / transactions) : 0;
  const activeVehicles = new Set(logs.map((l) => l.controlNo || l.mainVehicleNo)).size;
  return { transactions, volume, volumeDiesel, volumeGasoline, distance, avgVolume, activeVehicles };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// 주행거리 이상 데이터 (항목 78): 현재<이전.
export function mileageIssues(logs: FuelLog[]): FuelLog[] {
  return logs.filter(
    (l) => l.mileageKm != null && l.previousMileageKm != null && l.mileageKm < l.previousMileageKm,
  );
}

export interface Bucket {
  key: string;
  volume: number;
  count: number;
  distance: number;
}

function groupBy(logs: FuelLog[], keyFn: (l: FuelLog) => string): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const l of logs) {
    const key = keyFn(l);
    if (!key) continue;
    const b = map.get(key) ?? { key, volume: 0, count: 0, distance: 0 };
    b.volume += l.fuelVolumeL;
    b.count += 1;
    b.distance += l.distanceKm ?? 0;
    map.set(key, b);
  }
  return [...map.values()].map((b) => ({
    ...b,
    volume: round(b.volume),
    distance: round(b.distance),
  }));
}

export const byDay = (logs: FuelLog[]) =>
  groupBy(logs, (l) => siteDate(l.fuelDatetime)).sort((a, b) => a.key.localeCompare(b.key));
export const byWeek = (logs: FuelLog[]) =>
  groupBy(logs, (l) => isoWeek(l.fuelDatetime)).sort((a, b) => a.key.localeCompare(b.key));
export const byMonth = (logs: FuelLog[]) =>
  groupBy(logs, (l) => siteMonth(l.fuelDatetime)).sort((a, b) => a.key.localeCompare(b.key));
export const byPart = (logs: FuelLog[]) =>
  groupBy(logs, (l) => l.part || "—").sort((a, b) => b.volume - a.volume);
export const byVehicle = (logs: FuelLog[]) =>
  groupBy(logs, (l) => l.mainVehicleNo || l.controlNo).sort((a, b) => b.volume - a.volume);
export const byDriverName = (logs: FuelLog[]) => {
  // 복수 운전자: 각 운전자에 동일 기록을 귀속 (검색·집계용)
  const map = new Map<string, Bucket>();
  for (const l of logs) {
    const drivers = l.driver ? l.driver.split("/").map((s) => s.trim()) : [];
    for (const dv of drivers) {
      if (!dv) continue;
      const b = map.get(dv) ?? { key: dv, volume: 0, count: 0, distance: 0 };
      b.volume += l.fuelVolumeL;
      b.count += 1;
      b.distance += l.distanceKm ?? 0;
      map.set(dv, b);
    }
  }
  return [...map.values()]
    .map((b) => ({ ...b, volume: round(b.volume), distance: round(b.distance) }))
    .sort((a, b) => b.volume - a.volume);
};

/** 조회 기간 안에서 "누가(또는 어느 차량이) 몇 번, 며칠에" 넣었는지. */
export interface UsageRow {
  key: string;        // 운전자 이름 또는 차량 식별자
  isDriver: boolean;
  vehicles: string[]; // 그 사람이 넣은 차량들
  count: number;
  volume: number;
  dates: string[];    // YYYY-MM-DD, 오름차순
}

export function usageByPerson(logs: FuelLog[]): UsageRow[] {
  const map = new Map<string, UsageRow>();
  for (const l of logs) {
    const vehicle = l.mainVehicleNo || l.controlNo || l.vehicleType || "—";
    // 운전자가 있으면 사람 기준, 없으면(디젤 장비 등) 차량 기준으로 묶는다.
    const drivers = l.driver
      ? l.driver.split("/").map((d) => d.trim()).filter(Boolean)
      : [];
    const keys = drivers.length ? drivers : [vehicle];
    for (const key of keys) {
      const row =
        map.get(key) ??
        { key, isDriver: drivers.length > 0, vehicles: [], count: 0, volume: 0, dates: [] };
      row.count += 1;
      // 복수 운전자 차량은 주유량을 나눠 갖지 않고 각자에게 그대로 보여준다 (횟수 기준 조회이므로)
      row.volume = round(row.volume + l.fuelVolumeL);
      const d = siteDate(l.fuelDatetime);
      if (!row.dates.includes(d)) row.dates.push(d);
      if (!row.vehicles.includes(vehicle)) row.vehicles.push(vehicle);
      map.set(key, row);
    }
  }
  for (const row of map.values()) row.dates.sort();
  return [...map.values()].sort((a, b) => b.count - a.count || b.volume - a.volume);
}
