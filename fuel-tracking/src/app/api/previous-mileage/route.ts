import { NextRequest, NextResponse } from "next/server";
import { getLatestMileage } from "@/lib/repository";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // CONTROL N° 기준 (가솔린·디젤 트럭 공통). 하위호환으로 mainVehicleNo 도 받음.
    const controlNo =
      req.nextUrl.searchParams.get("controlNo") ??
      req.nextUrl.searchParams.get("mainVehicleNo") ??
      "";
    const previousMileageKm = await getLatestMileage(controlNo);
    return NextResponse.json({ previousMileageKm });
  } catch (e) {
    return errorResponse(e);
  }
}
