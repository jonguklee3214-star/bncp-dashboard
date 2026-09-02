import { NextRequest, NextResponse } from "next/server";
import type { FuelLog } from "@/types";
import {
  appendFuelLog,
  getFuelLogs,
  getLatestMileage,
  getVehicles,
  recordExists,
} from "@/lib/repository";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await getFuelLogs();
    return NextResponse.json({ logs });
  } catch (e) {
    return errorResponse(e);
  }
}

interface CreateLogBody {
  recordId: string;
  fuelType: "diesel" | "gasoline";
  mainVehicleNo?: string;
  controlNo?: string;
  currentMileage?: number | null;
  fuelVolume: number;
  remarks?: string;
  fuelDatetime?: string;
  allowMileageException?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateLogBody;

    // ── 검증 (항목 56) ──
    if (!body.fuelVolume || body.fuelVolume <= 0) {
      return NextResponse.json(
        { error: "validation", message: "Fuel Volume 은 0보다 커야 합니다." },
        { status: 400 },
      );
    }
    if (!body.recordId) {
      return NextResponse.json(
        { error: "validation", message: "recordId 가 필요합니다." },
        { status: 400 },
      );
    }

    // 중복 저장 방지 (항목 55)
    if (await recordExists(body.recordId)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const vehicles = await getVehicles();
    const vehicle =
      body.fuelType === "gasoline"
        ? vehicles.find((v) => v.mainVehicleNo === body.mainVehicleNo)
        : vehicles.find((v) => v.controlNo === body.controlNo);

    if (!vehicle) {
      return NextResponse.json(
        { error: "validation", message: "선택한 차량/장비를 찾을 수 없습니다." },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    let mileageKm: number | null = null;
    let previousMileageKm: number | null = null;
    let distanceKm: number | null = null;

    // 가솔린만 주행거리 처리. 디젤은 주유량만 (사용자 결정).
    if (body.fuelType === "gasoline" && body.currentMileage != null) {
      mileageKm = body.currentMileage;
      previousMileageKm = await getLatestMileage(vehicle.mainVehicleNo);
      if (previousMileageKm != null) {
        // 주행거리 이상 (항목 34)
        if (mileageKm < previousMileageKm && !body.allowMileageException) {
          return NextResponse.json(
            {
              error: "mileage",
              message: "현재 주행거리가 이전 주행거리보다 작습니다.",
              previousMileageKm,
            },
            { status: 400 },
          );
        }
        distanceKm = mileageKm - previousMileageKm;
      }
    }

    // 스냅샷 저장 (항목 52): 주유 당시 Master 정보 보존
    const log: FuelLog = {
      recordId: body.recordId,
      fuelDatetime: body.fuelDatetime || nowIso,
      fuelType: body.fuelType,
      mainVehicleNo: vehicle.mainVehicleNo,
      controlNo: vehicle.controlNo,
      driver: vehicle.driverIds.join(" / "),
      company: vehicle.company,
      team: vehicle.team,
      part: vehicle.part,
      vehicleType: vehicle.fuelType === "diesel" ? vehicle.equipmentName : vehicle.vehicleType,
      capacity: vehicle.capacity,
      teamCode: vehicle.teamCode,
      mileageKm,
      previousMileageKm,
      distanceKm,
      fuelVolumeL: body.fuelVolume,
      remarks: body.remarks ?? "",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await appendFuelLog(log);
    return NextResponse.json({ ok: true, log });
  } catch (e) {
    return errorResponse(e);
  }
}
