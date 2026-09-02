import { NextResponse } from "next/server";
import { initSheet } from "@/lib/repository";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

// 최초 1회: 헤더 + 초기 차량 데이터 심기. 이미 데이터가 있으면 보존.
export async function POST() {
  try {
    const result = await initSheet();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return errorResponse(e);
  }
}
