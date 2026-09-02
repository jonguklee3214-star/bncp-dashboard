import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 관리자 PIN 검증. ADMIN_PIN 미설정 시 잠금(수정 불가).
export async function POST(req: NextRequest) {
  const configured = Boolean(process.env.ADMIN_PIN);
  if (!configured) {
    return NextResponse.json(
      { ok: false, configured: false, message: "관리자 PIN이 설정되지 않았습니다 (ADMIN_PIN)." },
      { status: 200 },
    );
  }
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  const ok = typeof pin === "string" && pin === process.env.ADMIN_PIN;
  return NextResponse.json({ ok, configured: true });
}
