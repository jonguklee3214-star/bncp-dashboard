import { NextResponse } from "next/server";
import { SheetsConfigError } from "./sheets";

/** 서버 오류를 사용자가 이해하기 쉬운 메시지로 변환 (항목 86). */
export function errorResponse(e: unknown) {
  if (e instanceof SheetsConfigError) {
    return NextResponse.json({ error: "config", message: e.message }, { status: 500 });
  }
  const message = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
  return NextResponse.json({ error: "server", message }, { status: 500 });
}
