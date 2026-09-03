import { NextResponse } from "next/server";
import { getEditHistory } from "@/lib/repository";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** 기록별 수정 이력 (주유 이력 화면에 '수정됨' 표시용). 공개 조회. */
export async function GET() {
  try {
    const edits = await getEditHistory();
    return NextResponse.json({ edits });
  } catch (e) {
    return errorResponse(e);
  }
}
