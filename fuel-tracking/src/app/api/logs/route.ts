import { NextRequest, NextResponse } from "next/server";
import type { FuelLog } from "@/types";
import {
  appendAudit,
  appendFuelLog,
  getFuelLogs,
  getLatestMileage,
  getEditRequests,
  getVehicles,
  recordExists,
  setEditRequestStatus,
  updateFuelLog,
  voidRecord,
} from "@/lib/repository";
import { errorResponse, isAdminRequest } from "@/lib/api";

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

    // 주행거리 대상 차량은 주행거리 필수. 미터기 고장 면제 승인 차량은 tracksMileage=false 로 내려와 통과.
    if (vehicle.tracksMileage && body.currentMileage == null) {
      return NextResponse.json(
        {
          error: "mileage_required",
          message: "주행거리를 입력하세요. 미터기가 고장이면 관리자 예외 승인이 필요합니다.",
        },
        { status: 400 },
      );
    }

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
  reason?: string;
  requestId?: string; // 관리자가 승인한 수정 요청 (입력자가 직접 고칠 때)
  editedBy?: string;
}

/**
 * 기록 수정. 두 가지 경로만 허용한다.
 *   1) 관리자 PIN
 *   2) 관리자가 승인한 수정 요청(requestId) — 요청한 사람이 직접 고친다. 승인 1건당 1회.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as PatchLogBody;
    if (!body.recordId) {
      return NextResponse.json({ error: "validation", message: "recordId 필요" }, { status: 400 });
    }

    const admin = isAdminRequest(req);
    let editor = "admin";
    let approvedReason = "";
    if (!admin) {
      if (!body.requestId) {
        return NextResponse.json(
          { error: "forbidden", message: "관리자 승인을 받은 뒤에 수정할 수 있습니다." },
          { status: 403 },
        );
      }
      const approved = await getEditRequests("approved");
      const match = approved.find(
        (r) => r.requestId === body.requestId && r.recordId === body.recordId,
      );
      if (!match) {
        return NextResponse.json(
          { error: "forbidden", message: "승인된 수정 요청이 없거나 이미 수정했습니다." },
          { status: 403 },
        );
      }
      editor = match.requestedBy || "요청자";
      approvedReason = match.reason;
    }

    // 사유: 관리자는 필수, 요청자는 신청할 때 적은 사유를 그대로 쓴다.
    const reason = body.reason?.trim() || approvedReason;
    if (!reason) {
      return NextResponse.json(
        { error: "validation", message: "수정 사유를 입력하세요." },
        { status: 400 },
      );
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

    // 승인 1건은 수정 1회로 소진
    if (!admin && body.requestId) await setEditRequestStatus(body.requestId, "done");

    await appendAudit({
      user: admin ? "admin" : editor,
      action: "fuellog.update",
      target: `${updated.controlNo || updated.mainVehicleNo || updated.vehicleType} · ${updated.recordId}`,
      oldValue: reason,
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
    if (!isAdminRequest(req)) {
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
