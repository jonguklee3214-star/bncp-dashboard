// ─────────────────────────────────────────────────────────────
//  BNCP Fuel Tracking — 데이터 모델
//  ⚠ 금액/단가 관련 필드는 절대 두지 않는다 (항목 3, 103).
// ─────────────────────────────────────────────────────────────

/** 유종. 입력은 유종 선택부터 시작한다 (제일 먼저 갈라지는 축). */
export type FuelType = "diesel" | "gasoline";

export type VehicleStatus = "active" | "inactive";

/** Part (부서). 디젤은 team=공사팀 고정, part 미사용. */
export type Part = "건축" | "토목" | "PLANT" | "기전" | "공무" | "팀장" | "";

/**
 * Vehicle Master 한 행.
 * - gasoline: mainVehicleNo(주 식별자) + driverIds + part 사용. capacity/teamCode/hourKm 는 빈 값.
 * - diesel:   controlNo(식별자) + equipmentName + capacity + teamCode 사용.
 *             driverIds/part 미사용, team 은 "공사팀" 고정, mileage 개념 없음.
 * 원본 문자열(mainVehicleNo, controlNo, driver, equipmentName)은 그대로 보존한다 (항목 104).
 */
export interface Vehicle {
  vehicleId: string;
  fuelType: FuelType;
  mainVehicleNo: string; // gasoline 만; diesel 은 "" (controlNo 로 식별)
  controlNo: string;
  equipmentName: string; // diesel 의 장비종류(= Vehicle Type). gasoline 은 vehicleType 사용
  vehicleType: string; // gasoline 의 차종. 미확정이면 "Unassigned" (항목 26)
  capacity: string; // diesel 만 (2.5Ton 등)
  teamCode: string; // diesel 원본 Team Code (HOST/CLDS…). 참고용 보존
  hourKm: string; // diesel Master 초기 참고값 (Hour/KM). 집계에는 쓰지 않음
  company: string;
  team: string; // diesel = "공사팀" 고정
  part: Part;
  driverIds: string[]; // 운전자 이름 배열. gasoline 만 (복수 운전자 지원, 항목 19)
  tracksMileage: boolean; // 주행거리(km) 입력 대상 여부. 트럭류=true, 굴삭기·로더·바브캣·발전기=false
  mileageExemptReason?: string; // 미터기 고장 등으로 관리자가 주행거리 면제 승인한 사유
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fuel Log 한 행 = 주유 1회 (항목 21, 37).
 * 주유 당시의 Master 스냅샷을 함께 저장한다 (항목 52).
 * - diesel: fuelVolumeL 만 유효. mileage/distance/driver 는 비움(또는 N/A).
 */
export interface FuelLog {
  recordId: string;
  fuelDatetime: string; // ISO. 현장(Asia/Baghdad) 기준으로 처리
  fuelType: FuelType;
  mainVehicleNo: string;
  controlNo: string;
  driver: string; // 스냅샷 문자열 ("신종식 / 안창훈")
  company: string;
  team: string;
  part: Part;
  vehicleType: string; // gasoline 차종 또는 diesel equipmentName
  capacity: string;
  teamCode: string;
  mileageKm: number | null; // diesel/발전기 등은 null (N/A)
  previousMileageKm: number | null;
  distanceKm: number | null;
  fuelVolumeL: number;
  remarks: string;
  voided?: boolean; // 무효 처리(삭제 대신). 집계·이력에서 제외.
  createdAt: string;
  updatedAt: string;
}

/** 수정 요청 (입력자 → 관리자 승인). */
export interface EditRequest {
  requestId: string;
  recordId: string;
  requestedBy: string;
  fuelVolume: number | null;
  mileageKm: number | null;
  remarks: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface AppSettings {
  weatherLocationName: string;
  weatherLatitude: number;
  weatherLongitude: number;
  siteTimezone: string;
}
