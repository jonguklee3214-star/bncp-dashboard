import { NextRequest, NextResponse } from "next/server";
import {
  addMileageExempt,
  appendAudit,
  getMileageExempt,
  removeMileageExempt,
} from "@/lib/repository";
import { errorResponse, isAdminRequest } from "@/lib/api";

export const dynamic = "force-dynamic";

// 면제 목록 (누구나 조회 가능 — 입력 화면에서 상태 표시용)
export async function GET() {
  try {
    const map = await getMileageExempt();
    return NextResponse.json({ exempt: Object.fromEntries(map) });
  } catch (e) {
    return errorResponse(e);
  }
}

// 면제 승인 (관리자 1회 승인 → 이후 그 차량은 주행거리 없이 입력 가능)
export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json(
        { error: "forbidden", message: "관리자만 승인할 수 있습니다." },
        { status: 403 },
      );
    }
    const { controlNo, reason } = (await req.json()) as { controlNo?: string; reason?: string };
    if (!controlNo || !reason?.trim()) {
      return NextResponse.json(
        { error: "validation", message: "차량과 사유가 필요합니다." },
        { status: 400 },
      );
    }
    await addMileageExempt(controlNo, reason.trim());
    await appendAudit({
      user: "admin",
      action: "mileage.exempt.grant",
      target: controlNo,
      oldValue: "",
      newValue: reason.trim(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

// 면제 해제 (미터기 수리 등)
export async function DELETE(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json(
        { error: "forbidden", message: "관리자만 해제할 수 있습니다." },
        { status: 403 },
      );
    }
    const { controlNo } = (await req.json()) as { controlNo?: string };
    if (!controlNo) {
      return NextResponse.json({ error: "validation", message: "controlNo 필요" }, { status: 400 });
    }
    await removeMileageExempt(controlNo);
    await appendAudit({
      user: "admin",
      action: "mileage.exempt.revoke",
      target: controlNo,
      oldValue: "",
      newValue: "",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
