import { NextResponse } from "next/server";
import { getVehicles } from "@/lib/repository";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vehicles = await getVehicles();
    return NextResponse.json({ vehicles });
  } catch (e) {
    return errorResponse(e);
  }
}
