import { NextRequest, NextResponse } from "next/server";
import type { EditRequest, FuelLog } from "@/types";
import {
  addEditRequest,
  appendAudit,
  getEditRequests,
  setEditRequestStatus,
  updateFuelLog,
} from "@/lib/repository";
import { errorResponse, isAdminRequest } from "@/lib/api";

export const dynamic = "force-dynamic";

// 목록 (관리자) — 기본 pending
export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "forbidden", message: "관리자 전용" }, { status: 403 });
    }
    const status = (req.nextUrl.searchParams.get("status") as EditRequest["status"]) || "pending";
    const requests = await getEditRequests(status);
    return NextResponse.json({ requests });
  } catch (e) {
    return errorResponse(e);
  }
}

// 생성 (누구나 — 입력자가 수정 요청)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      recordId: string;
      requestedBy?: string;
      fuelVolume?: number | null;
      mileageKm?: number | null;
      remarks?: string;
      reason: string;
    };
    if (!body.recordId || !body.reason?.trim()) {
      return NextResponse.json(
        { error: "validation", message: "대상 기록과 사유가 필요합니다." },
        { status: 400 },
      );
    }
    const request: EditRequest = {
      requestId:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `req-${Date.now()}`,
      recordId: body.recordId,
      requestedBy: (body.requestedBy ?? "").trim(),
      fuelVolume: body.fuelVolume ?? null,
      mileageKm: body.mileageKm ?? null,
      remarks: (body.remarks ?? "").trim(),
      reason: body.reason.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await addEditRequest(request);
    return NextResponse.json({ ok: true, request });
  } catch (e) {
    return errorResponse(e);
  }
}

// 승인/반려 (관리자). 승인 시 실제 기록에 반영.
export async function PATCH(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "forbidden", message: "관리자 전용" }, { status: 403 });
    }
    const { requestId, action } = (await req.json()) as {
      requestId: string;
      action: "approve" | "reject";
    };
    if (!requestId || !action) {
      return NextResponse.json({ error: "validation", message: "requestId·action 필요" }, { status: 400 });
    }

    const all = await getEditRequests();
    const target = all.find((r) => r.requestId === requestId);
    if (!target) {
      return NextResponse.json({ error: "notfound", message: "요청을 찾을 수 없습니다." }, { status: 404 });
    }

    if (action === "approve") {
      const patch: Partial<FuelLog> = {};
      if (target.fuelVolume != null) patch.fuelVolumeL = target.fuelVolume;
      if (target.mileageKm != null) patch.mileageKm = target.mileageKm;
      if (target.remarks) patch.remarks = target.remarks;
      await updateFuelLog(target.recordId, patch);
    }

    await setEditRequestStatus(requestId, action === "approve" ? "approved" : "rejected");
    await appendAudit({
      user: "admin",
      action: `request.${action}`,
      target: `${target.recordId} · ${requestId}`,
      oldValue: target.reason,
      newValue: `${target.fuelVolume ?? ""}L ${target.mileageKm ?? ""}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
