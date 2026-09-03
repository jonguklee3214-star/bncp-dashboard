import { NextRequest, NextResponse } from "next/server";
import { initSheet } from "@/lib/repository";
import { errorResponse, forbidden, isAdminRequest } from "@/lib/api";

export const dynamic = "force-dynamic";

// 최초 1회: 헤더 + 초기 차량 데이터 심기. 이미 데이터가 있으면 보존. (관리자 전용)
export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return forbidden("시트 초기화는 관리자만 할 수 있습니다.");
    }
    const result = await initSheet();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return errorResponse(e);
  }
}
