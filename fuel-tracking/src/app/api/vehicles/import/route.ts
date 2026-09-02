import { NextRequest, NextResponse } from "next/server";
import type { FuelType, Part, Vehicle } from "@/types";
import { appendAudit, getVehicles, upsertVehicle } from "@/lib/repository";
import { dieselTracksMileage } from "@/data/seed";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

interface ImportRow {
  fuelType?: string;
  mainVehicleNo?: string;
  controlNo?: string;
  vehicleType?: string;
  capacity?: string;
  teamCode?: string;
  part?: string;
  drivers?: string;
  status?: string;
}

// CSV 일괄 등록 (수동 추가와 별개, 다건). control_no 기준 upsert.
export async function POST(req: NextRequest) {
  try {
    const { rows } = (await req.json()) as { rows: ImportRow[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "validation", message: "등록할 행이 없습니다." },
        { status: 400 },
      );
    }

    const existing = await getVehicles();
    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const controlNo = (r.controlNo ?? "").trim();
      const fuelType: FuelType =
        (r.fuelType ?? "").toLowerCase().includes("gasoline") ||
        (r.fuelType ?? "").includes("가솔린")
          ? "gasoline"
          : "diesel";
      const mainVehicleNo = (r.mainVehicleNo ?? "").trim();

      if (!controlNo) {
        errors.push(`${i + 2}행: CONTROL N° 누락`);
        continue;
      }
      if (fuelType === "gasoline" && !mainVehicleNo) {
        errors.push(`${i + 2}행: Main Vehicle No. 누락`);
        continue;
      }

      const prev = existing.find((v) => v.controlNo === controlNo);
      const vehicle: Vehicle = {
        vehicleId: prev?.vehicleId || `V-${Date.now()}-${i}`,
        fuelType,
        mainVehicleNo,
        controlNo,
        equipmentName: fuelType === "diesel" ? (r.vehicleType ?? "").trim() : "",
        vehicleType: (r.vehicleType ?? "").trim(),
        capacity: (r.capacity ?? "").trim(),
        teamCode: (r.teamCode ?? "").trim(),
        hourKm: prev?.hourKm ?? "",
        company: "Construction",
        team: "공사팀",
        part: ((r.part ?? "").trim() as Part) || "",
        driverIds: (r.drivers ?? "")
          .split("/")
          .map((d) => d.trim())
          .filter(Boolean),
        tracksMileage:
          fuelType === "gasoline" ? true : dieselTracksMileage((r.vehicleType ?? "").trim()),
        status: (r.status ?? "").includes("inactive") || (r.status ?? "").includes("미운행")
          ? "inactive"
          : "active",
        createdAt: prev?.createdAt || now,
        updatedAt: now,
      };

      await upsertVehicle(vehicle);
      if (prev) updated += 1;
      else created += 1;
    }

    await appendAudit({
      user: "admin",
      action: "vehicle.import",
      target: `${rows.length} rows`,
      oldValue: "",
      newValue: `created ${created}, updated ${updated}`,
    });

    return NextResponse.json({ ok: true, created, updated, errors });
  } catch (e) {
    return errorResponse(e);
  }
}
