// ─────────────────────────────────────────────────────────────
//  Vehicle Master 초기 데이터
//  사용자가 제공한 원문 그대로 (항목 104: 대소문자·괄호·하이픈·공백 보존).
//  사용자가 지정하지 않은 값은 임의로 만들지 않는다 (항목 25, 103).
// ─────────────────────────────────────────────────────────────
import type { Part, Vehicle } from "@/types";

const now = "2026-09-02T00:00:00.000Z";

function vehicle(v: Partial<Vehicle> & { vehicleId: string; fuelType: Vehicle["fuelType"] }): Vehicle {
  return {
    mainVehicleNo: "",
    controlNo: "",
    equipmentName: "",
    vehicleType: "",
    capacity: "",
    teamCode: "",
    hourKm: "",
    company: "Construction",
    team: "",
    part: "" as Part,
    driverIds: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...v,
  };
}

// ── 가솔린: Main Vehicle No. 기반 (항목 23·24·25) ──
// [mainVehicleNo, controlNo, driver(s, "/" 구분), part]
const GASOLINE_ROWS: [string, string, string, Part][] = [
  ["공사 ( I ) - 11", "LPU-006", "Eng Ali (Iraqi)", "토목"],
  ["공사 ( T ) - 01", "LPU-009", "Limon (TCN)", "토목"],
  ["공사 ( I ) - 21", "LPU-038", "IRAQI", "PLANT"],
  ["공사 ( I ) - 03", "LPU-039", "IRAQI", "토목"],
  ["공사 ( I ) - 02", "LPU-042", "Mohammed", "기전"],
  ["공사 ( T ) - 09", "LPU-045", "Zafar (TCN)", "PLANT"],
  ["공사 ( I ) - 10", "LPU-046", "Kasem (Iraqi)", "토목"],
  ["공사 ( T ) - 13", "LPU-047", "Mehedi", "건축"],
  ["공사 ( I ) - 07", "LPU-060", "Daud", "PLANT"],
  ["공사 ( I ) - 08", "LPU-076", "Saher", "토목"],
  ["공사 ( I ) - 05", "LPU-082", "Mustofa", "토목"],
  ["공사 ( I ) - 04", "LPU-103", "IRAQI", "PLANT"],
  ["공사 ( I ) - 20", "LPU-106", "Moyazzm", "PLANT"],
  ["공사 ( T ) - 04", "LPU-116", "Shariful", "건축"],
  ["공사 ( T ) - 07", "LPU-122", "Lavu", "기전"],
  ["공사-02", "LSU-013", "노옥철 부장", "기전"],
  ["공사-06", "LSU-016", "맹호윤 과장", "기전"],
  ["공사-04", "LSU-033", "원영덕 차장", "토목"],
  ["공사-03", "LSU-034", "김진형 과장", "토목"],
  ["공사-07", "LSU-047", "라대주 소장", "토목"],
  ["공사-01", "LSU-062", "이상재 팀장", "팀장"],
  ["공사-14", "LSU-064", "박귀덕 과장", "PLANT"],
  ["공사-05", "LSU-066", "김태형 차장", "건축"],
  ["공사 ( I ) - 01", "LSU-068", "iRAQI", "건축"],
  ["공사-10", "LSU-071", "이창철 차장", "토목"],
  ["공사-20", "LSU-072", "김범진 차장", "PLANT"],
  ["공사-09", "LSU-102", "신종식 / 안창훈", "기전"],
  ["공사-19", "LSU-104", "김희준 / 박정현", "공무"],
  ["공사-11", "LSU-111", "이종욱 과장", "토목"],
];

const GASOLINE: Vehicle[] = GASOLINE_ROWS.map(([main, control, drivers, part], i) =>
  vehicle({
    vehicleId: `G-${String(i + 1).padStart(3, "0")}`,
    fuelType: "gasoline",
    mainVehicleNo: main,
    controlNo: control,
    vehicleType: "Unassigned", // 차종 미확정 (항목 26) — Master 에서 수정
    team: "공사팀",
    part,
    driverIds: drivers.split("/").map((d) => d.trim()),
  }),
);

// ── 디젤: CONTROL N° 기반 장비 목록 (사용자 제공 표) ──
// [sl, equipmentName, capacity, controlNo, hourKm, teamCode]
// team 은 유종=디젤이면 "공사팀" 으로 통일 (조경 구분 안 함).
const DIESEL_ROWS: [string, string, string, string, string, string][] = [
  ["44", "Box Car (W/Lifter)", "2.5Ton", "BC-003", "85340", "HOST"],
  ["268", "Cargo Truck", "4X2, 8.5T", "CT-044", "61084", "CLDS"],
  ["773", "Dump Truck", "6X4,15T", "DT-102", "47012", "CLDS"],
  ["962", "Excavator (Wheel)", "0.7m3", "EX-089", "13111", "BECT"],
  ["979", "Excavator (Wheel)", "0.7m3", "EX-095", "811", "PCT"],
  ["998", "Excavator (Wheel)", "0.7m5", "EX-111", "3049", "CLDS"],
  ["1378", "Generator", "54Kw", "GR-T10", "", "CTLT"],
  ["1494", "Generator", "110Kw", "GR-T68", "", "CLDS"],
  ["1506", "Generator", "", "GR-T80", "", "CLDS"],
  ["1507", "Generator", "", "GR-T81", "", "CLDS"],
  ["1821", "Mini Cargo Truck", "M/T,4X2,1Ton", "LMC-080", "70798", "HOST"],
  ["1855", "Mini Cargo Truck", "M/T,4X2,1Ton", "LMC-091", "195604", "HOST"],
  ["1877", "Mini Cargo Truck", "M/T,4X2,1Ton", "LMC-099", "265435", "HOST"],
  ["1882", "Mini Cargo Truck", "M/T,4X2,1Ton", "LMC-101", "231556", "BSBS"],
  ["2117", "Generator", "27Kw", "SGR-T11", "", "CLDS"],
  ["2453", "skid Loader", "3.0m5", "WL-043", "6477", "CLDS"],
  ["2514", "Water Truck (Steel)", "6X4,12Kl", "WT-036", "53858", "CLDS"],
  ["1798", "Mini Cargo Truck", "M/T,4X2,1Ton", "LMC-067", "210542", "CLDS"],
  ["1503", "Generator", "", "GR-T77", "", "CLDS"],
  ["1679", "Mini Cargo Truck", "2.5Ton, DLX", "LMC-014", "144218", "PCT"],
  ["1699", "Mini Cargo Truck", "2.5Ton, DLX", "LMC-023", "56707", "PCPC"],
  ["1860", "Mini Cargo Truck", "M/T,4X2,1Ton", "LMC-094", "112952", "AHRT"],
  ["2460", "Bobcat", "", "WL-050", "5769", "CLDS"],
  ["2476", "Water Truck (Steel)", "6X4,16Kl", "WT-008", "112955", "CLDS"],
  ["2487", "Water Truck (Sus)", "6X4,16Kl", "WT-014", "96080", "MGAT"],
  ["2496", "Water Truck (Steel)", "6X4,16Kl", "WT-020", "85507", "CLDS"],
  ["2499", "Water Truck (Steel)", "6X4,16Kl", "WT-023", "110392", "BMCT"],
  ["2505", "Water Truck (Steel)", "6X4,16Kl", "WT-029", "60900", "CLDS"],
  ["2509", "Water Truck (Steel)", "6X4,12Kl", "WT-031", "63711", "CLDS"],
];

const DIESEL: Vehicle[] = DIESEL_ROWS.map(([sl, name, capacity, control, hourKm, teamCode]) =>
  vehicle({
    vehicleId: `D-${sl}`,
    fuelType: "diesel",
    controlNo: control,
    equipmentName: name,
    vehicleType: name, // 디젤은 장비명이 곧 차종 표시
    capacity,
    teamCode,
    hourKm,
    team: "공사팀", // 유종=디젤 → 공사팀 통일
    part: "",
    driverIds: [],
  }),
);

export const SEED_VEHICLES: Vehicle[] = [...DIESEL, ...GASOLINE];

/** 부서 목록 (항목 22·46) */
export const PARTS: Part[] = ["건축", "토목", "PLANT", "기전", "공무", "팀장"];
