import { NextResponse } from "next/server";
import { getEditRequests } from "@/lib/repository";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * 승인됐지만 아직 수정하지 않은 요청 목록 (공개).
 * 주유 이력 화면에서 "이 기록은 지금 수정할 수 있다"를 표시하는 용도라
 * 관리자 PIN 없이 읽을 수 있다. 실제 수정은 requestId 를 검증한다.
 */
export async function GET() {
  try {
    const approved = await getEditRequests("approved");
    const open: Record<string, { requestId: string; requestedBy: string; reason: string }> = {};
    for (const r of approved) {
      // 같은 기록에 여러 건이면 가장 최근 승인 건을 쓴다 (목록은 최신순)
      if (!open[r.recordId]) {
        open[r.recordId] = { requestId: r.requestId, requestedBy: r.requestedBy, reason: r.reason };
      }
    }
    return NextResponse.json({ open });
  } catch (e) {
    return errorResponse(e);
  }
}
