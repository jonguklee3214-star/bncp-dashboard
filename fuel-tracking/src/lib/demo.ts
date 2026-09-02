import type { FuelLog, Vehicle } from "@/types";
import { SEED_VEHICLES } from "@/data/seed";

// ─────────────────────────────────────────────────────────────
//  데모 폴백 (Google Sheets 미설정 시).
//  ⚠ 미리보기/테스트 전용 — 서버 재시작 시 초기화된다. 실제 운영은 Google Sheets 사용.
// ─────────────────────────────────────────────────────────────

export function isConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

// 모듈 스코프 in-memory 저장 (dev/preview 한정)
const demoLogs: FuelLog[] = [];
const demoVehicleList: Vehicle[] = SEED_VEHICLES.map((v) => ({ ...v }));

export function demoVehicles(): Vehicle[] {
  return demoVehicleList;
}

export function demoUpsertVehicle(v: Vehicle): void {
  const i = demoVehicleList.findIndex((x) => x.vehicleId === v.vehicleId);
  if (i >= 0) demoVehicleList[i] = v;
  else demoVehicleList.push(v);
}

export function demoGetLogs(): FuelLog[] {
  return demoLogs;
}

export function demoAppendLog(log: FuelLog): void {
  demoLogs.push(log);
}
