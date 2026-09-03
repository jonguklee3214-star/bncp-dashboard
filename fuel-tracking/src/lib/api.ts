import { NextRequest, NextResponse } from "next/server";
import { SheetsConfigError } from "./sheets";

/**
 * 관리자 확인. ADMIN_PIN 환경변수가 설정돼 있고 요청 헤더의 PIN 이 일치할 때만 true.
 * (미설정이면 모든 관리자 기능은 잠긴 상태 — 안전 기본값)
 */
export function isAdminRequest(req: NextRequest): boolean {
  const pin = req.headers.get("x-admin-pin");
  return Boolean(process.env.ADMIN_PIN) && pin === process.env.ADMIN_PIN;
}

/** 관리자 전용 API 의 공통 거부 응답. */
export function forbidden(message = "관리자만 사용할 수 있습니다.") {
  return NextResponse.json({ error: "forbidden", message }, { status: 403 });
}

/** 서버 오류를 사용자가 이해하기 쉬운 메시지로 변환 (항목 86). */
export function errorResponse(e: unknown) {
  if (e instanceof SheetsConfigError) {
    return NextResponse.json({ error: "config", message: e.message }, { status: 500 });
  }
  const message = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
  return NextResponse.json({ error: "server", message }, { status: 500 });
}
