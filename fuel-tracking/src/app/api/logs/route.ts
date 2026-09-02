import { NextRequest, NextResponse } from "next/server";
import type { FuelLog } from "@/types";
import {
  appendAudit,
  appendFuelLog,
  getFuelLogs,
  getLatestMileage,
  getVehicles,
  recordExists,
  updateFuelLog,
  voidRecord,
} from "@/lib/repository";
import { errorResponse } from "@/lib/api";

function isAdmin(req: NextRequest): boolean {
  const pin = req.headers.get("x-admin-pin");
  return Boolean(process.env.ADMIN_PIN) && pin === process.env.ADMIN_PIN;
}

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
  misc?: boolean; // 기타·말통 급유 (차량 없이 주유량+사유)
  reason?: string; // 말통 급유 사유 (수동 입력)
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

    const nowIso = new Date().toISOString();

    // ── 기타·말통 급유: 차량 없이 주유량 + 사유(수동) ──
    if (body.misc) {
      const reason = (body.reason ?? "").trim();
      if (!reason) {
        return NextResponse.json(
          { error: "validation", message: "사유를 입력하세요." },
          { status: 400 },
        );
      }
      const miscLog: FuelLog = {
        recordId: body.recordId,
        fuelDatetime: body.fuelDatetime || nowIso,
        fuelType: body.fuelType,
        mainVehicleNo: "",
        controlNo: "",
        driver: "",
        company: "Construction",
        team: "공사팀",
        part: "",
        vehicleType: "기타 급유",
        capacity: "",
        teamCode: "",
        mileageKm: null,
        previousMileageKm: null,
        distanceKm: null,
        fuelVolumeL: body.fuelVolume,
        remarks: reason,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await appendFuelLog(miscLog);
      return NextResponse.json({ ok: true, log: miscLog });
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

    let mileageKm: number | null = null;
    let previousMileageKm: number | null = null;
    let distanceKm: number | null = null;

    // 주행거리 관리 대상(트럭류·가솔린)만 처리. 굴삭기·로더·바브캣·발전기는 주유량만.
    if (vehicle.tracksMileage && body.currentMileage != null) {
      mileageKm = body.currentMileage;
      previousMileageKm = await getLatestMileage(vehicle.controlNo);
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

interface PatchLogBody {
  recordId: string;
  fuelVolume?: number;
  mileageKm?: number | null;
  remarks?: string;
  fuelDatetime?: string;
}

// 기록 수정 (관리자 전용 — PIN 필요)
export async function PATCH(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        { error: "forbidden", message: "관리자만 수정할 수 있습니다." },
        { status: 403 },
      );
    }
    const body = (await req.json()) as PatchLogBody;
    if (!body.recordId) {
      return NextResponse.json({ error: "validation", message: "recordId 필요" }, { status: 400 });
    }
    if (body.fuelVolume != null && body.fuelVolume <= 0) {
      return NextResponse.json(
        { error: "validation", message: "Fuel Volume 은 0보다 커야 합니다." },
        { status: 400 },
      );
    }

    const patch: Partial<FuelLog> = {};
    if (body.fuelVolume != null) patch.fuelVolumeL = body.fuelVolume;
    if (body.mileageKm !== undefined) patch.mileageKm = body.mileageKm;
    if (body.remarks !== undefined) patch.remarks = body.remarks;
    if (body.fuelDatetime) patch.fuelDatetime = new Date(body.fuelDatetime).toISOString();

    const updated = await updateFuelLog(body.recordId, patch);
    if (!updated) {
      return NextResponse.json({ error: "notfound", message: "기록을 찾을 수 없습니다." }, { status: 404 });
    }

    await appendAudit({
      user: "admin",
      action: "fuellog.update",
      target: `${updated.controlNo || updated.mainVehicleNo || updated.vehicleType} · ${updated.recordId}`,
      oldValue: "",
      newValue: `${updated.fuelVolumeL}L ${updated.mileageKm ?? ""}`,
    });

    return NextResponse.json({ ok: true, log: updated });
  } catch (e) {
    return errorResponse(e);
  }
}

// 기록 무효 처리(삭제 대신, 관리자 전용)
export async function DELETE(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json(
        { error: "forbidden", message: "관리자만 삭제(무효 처리)할 수 있습니다." },
        { status: 403 },
      );
    }
    const { recordId, reason } = (await req.json()) as { recordId?: string; reason?: string };
    if (!recordId) {
      return NextResponse.json({ error: "validation", message: "recordId 필요" }, { status: 400 });
    }
    await voidRecord(recordId, reason ?? "");
    await appendAudit({
      user: "admin",
      action: "fuellog.void",
      target: recordId,
      oldValue: "",
      newValue: reason ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
