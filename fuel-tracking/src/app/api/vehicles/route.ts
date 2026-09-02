import { NextRequest, NextResponse } from "next/server";
import type { Vehicle } from "@/types";
import { appendAudit, getVehicles, upsertVehicle } from "@/lib/repository";
import { dieselTracksMileage } from "@/data/seed";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

function summarize(v: Vehicle): string {
  return [
    v.fuelType,
    v.mainVehicleNo,
    v.controlNo,
    v.fuelType === "diesel" ? v.equipmentName : v.vehicleType,
    v.part || v.teamCode,
    v.driverIds.join("/"),
    v.status,
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function GET() {
  try {
    const vehicles = await getVehicles();
    return NextResponse.json({ vehicles });
  } catch (e) {
    return errorResponse(e);
  }
}

// 차량 추가/수정 (항목 62). vehicleId 가 있으면 수정, 없으면 생성.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Vehicle>;
    const now = new Date().toISOString();
    const isNew = !body.vehicleId;
    const vehicle: Vehicle = {
      vehicleId: body.vehicleId || `V-${Date.now()}`,
      fuelType: body.fuelType === "gasoline" ? "gasoline" : "diesel",
      mainVehicleNo: (body.mainVehicleNo ?? "").trim(),
      controlNo: (body.controlNo ?? "").trim(),
      equipmentName: (body.equipmentName ?? "").trim(),
      vehicleType: (body.vehicleType ?? "").trim(),
      capacity: (body.capacity ?? "").trim(),
      teamCode: (body.teamCode ?? "").trim(),
      hourKm: body.hourKm ?? "",
      company: body.company || "Construction",
      team: body.team || "공사팀",
      part: body.part ?? "",
      driverIds: Array.isArray(body.driverIds)
        ? body.driverIds.map((d) => d.trim()).filter(Boolean)
        : [],
      tracksMileage:
        body.fuelType === "gasoline"
          ? true
          : dieselTracksMileage((body.equipmentName ?? body.vehicleType ?? "").trim()),
      status: body.status === "inactive" ? "inactive" : "active",
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    // 최소 검증: 식별자 필수
    if (vehicle.fuelType === "gasoline" && !vehicle.mainVehicleNo) {
      return NextResponse.json(
        { error: "validation", message: "Main Vehicle No. 를 입력하세요." },
        { status: 400 },
      );
    }
    if (!vehicle.controlNo) {
      return NextResponse.json(
        { error: "validation", message: "CONTROL N° 를 입력하세요." },
        { status: 400 },
      );
    }

    // 변경 전 값 (수정 시 audit 용)
    const before = isNew
      ? undefined
      : (await getVehicles()).find((x) => x.vehicleId === vehicle.vehicleId);

    await upsertVehicle(vehicle);

    // 관리자 변경 추적 (항목 79)
    await appendAudit({
      user: "admin",
      action: isNew ? "vehicle.create" : "vehicle.update",
      target: vehicle.controlNo || vehicle.mainVehicleNo,
      oldValue: before ? summarize(before) : "",
      newValue: summarize(vehicle),
    });

    return NextResponse.json({ ok: true, vehicle, created: isNew });
  } catch (e) {
    return errorResponse(e);
  }
}
