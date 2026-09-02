import { google, sheets_v4 } from "googleapis";

// ─────────────────────────────────────────────────────────────
//  Google Sheets 저수준 클라이언트 (Service Account 인증)
//  credential 은 서버 환경변수에서만 읽는다 — 프론트엔드/GitHub 노출 금지 (항목 53).
// ─────────────────────────────────────────────────────────────

export const SHEET_TABS = {
  vehicles: "Vehicle_Master",
  logs: "Fuel_Log",
  settings: "Settings",
  audit: "Audit_Log",
  voided: "Voided",
  requests: "Edit_Requests",
  exempt: "Mileage_Exempt",
} as const;

export const HEADERS = {
  vehicles: [
    "vehicle_id",
    "fuel_type",
    "main_vehicle_no",
    "control_no",
    "equipment_name",
    "vehicle_type",
    "capacity",
    "team_code",
    "hour_km",
    "company",
    "team",
    "part",
    "driver_ids",
    "status",
    "created_at",
    "updated_at",
  ],
  logs: [
    "record_id",
    "fuel_datetime",
    "fuel_type",
    "main_vehicle_no",
    "control_no",
    "driver",
    "company",
    "team",
    "part",
    "vehicle_type",
    "capacity",
    "team_code",
    "mileage_km",
    "previous_mileage_km",
    "distance_km",
    "fuel_volume_l",
    "remarks",
    "created_at",
    "updated_at",
  ],
  settings: ["key", "value"],
  audit: ["timestamp", "user", "action", "target", "old_value", "new_value"],
  voided: ["record_id", "reason", "user", "at"],
  // 미터기 고장 등으로 주행거리 입력을 면제한 차량 (관리자 승인)
  exempt: ["control_no", "reason", "approved_by", "at"],
  requests: [
    "request_id",
    "record_id",
    "requested_by",
    "fuel_volume",
    "mileage_km",
    "remarks",
    "reason",
    "status",
    "created_at",
  ],
} as const;

export class SheetsConfigError extends Error {}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new SheetsConfigError(
      `환경변수 ${name} 가 설정되지 않았습니다. .env.local (또는 배포 환경변수)을 확인하세요.`,
    );
  }
  return v;
}

export function getSheetId(): string {
  return requiredEnv("GOOGLE_SHEET_ID");
}

let cached: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (cached) return cached;

  const email = requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  // private key 는 \n 이스케이프된 형태로 저장되는 경우가 많다 → 실제 개행으로 복원
  const key = requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cached = google.sheets({ version: "v4", auth });
  return cached;
}

/** 탭 전체 값을 2차원 배열로 읽는다 (헤더 포함). */
export async function readTab(tab: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${tab}!A1:ZZ100000`,
  });
  return (res.data.values as string[][]) ?? [];
}

/** 한 행을 탭 끝에 추가한다. */
export async function appendRow(tab: string, row: (string | number)[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

/** 특정 1-based 행 번호를 통째로 덮어쓴다. */
export async function writeRow(
  tab: string,
  rowNumber: number,
  row: (string | number)[],
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `${tab}!A${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

/** 여러 행을 한 번의 요청으로 기록한다 (쓰기 할당량 절약 — 항목 89). */
export async function writeRows(
  tab: string,
  startRow: number,
  rows: (string | number)[][],
): Promise<void> {
  if (rows.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `${tab}!A${startRow}`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

/** 탭 헤더(1행)만 설정한다. */
export async function writeHeader(tab: string, header: readonly string[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [header as string[]] },
  });
}

/** 탭이 없으면 만든다. */
export async function ensureTab(tab: string): Promise<void> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: getSheetId() });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tab);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: getSheetId(),
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }
}
