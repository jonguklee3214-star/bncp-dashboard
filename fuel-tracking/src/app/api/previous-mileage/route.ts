import { NextRequest, NextResponse } from "next/server";
import { getLatestMileage } from "@/lib/repository";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const mainVehicleNo = req.nextUrl.searchParams.get("mainVehicleNo") ?? "";
    const previousMileageKm = await getLatestMileage(mainVehicleNo);
    return NextResponse.json({ previousMileageKm });
  } catch (e) {
    return errorResponse(e);
  }
}
