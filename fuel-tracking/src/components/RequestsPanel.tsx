"use client";

import { useCallback, useEffect, useState } from "react";
import type { EditRequest, FuelLog } from "@/types";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";

// 관리자: 대기 중인 수정 요청 검토 → 승인/반려.
export function RequestsPanel({
  pin,
  logs,
  onClose,
  onChanged,
}: {
  pin: string;
  logs: FuelLog[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [requests, setRequests] = useState<EditRequest[] | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/requests?status=pending", { headers: { "x-admin-pin": pin } });
      const data = await res.json();
      setRequests(res.ok ? data.requests : []);
    } catch {
      setRequests([]);
    }
  }, [pin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(requestId: string, action: "approve" | "reject") {
    setBusy(requestId);
    try {
      await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ requestId, action }),
      });
      await load();
      onChanged();
    } finally {
      setBusy("");
    }
  }

  const logOf = (recordId: string) => logs.find((l) => l.recordId === recordId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{t("admin.requests")}</h2>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>

        {requests === null && <p className="text-sm text-gray-400">{t("common.loading")}</p>}
        {requests?.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">{t("admin.noRequests")}</p>
        )}

        <div className="space-y-3">
          {requests?.map((r) => {
            const l = logOf(r.recordId);
            return (
              <div key={r.requestId} className="rounded-lg border border-neutral-border p-3">
                <div className="text-sm font-bold">
                  {l ? l.mainVehicleNo || l.controlNo || l.vehicleType : r.recordId}
                </div>
                {l && (
                  <div className="text-xs text-gray-500">{formatDateTime(l.fuelDatetime)}</div>
                )}
                <div className="mt-2 space-y-1 text-sm">
                  {r.requestedBy && (
                    <div className="text-xs text-gray-500">{t("request.by")}: {r.requestedBy}</div>
                  )}
                  <div className="rounded bg-neutral-soft px-2 py-1.5 text-gray-700">
                    {r.fuelVolume != null && (
                      <div>
                        {t("entry.fuelVolume")}: {l ? `${l.fuelVolumeL} → ` : ""}
                        <b className="text-hanwha">{r.fuelVolume} L</b>
                      </div>
                    )}
                    {r.mileageKm != null && (
                      <div>
                        {t("entry.currentMileage")}: {l && l.mileageKm != null ? `${l.mileageKm} → ` : ""}
                        <b className="text-hanwha">{r.mileageKm} km</b>
                      </div>
                    )}
                    {r.remarks && <div>{t("entry.remarks")}: {r.remarks}</div>}
                  </div>
                  <div className="text-gray-700">📝 {r.reason}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => act(r.requestId, "approve")}
                    disabled={busy === r.requestId}
                    className="flex-1 rounded-lg bg-hanwha py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {t("admin.approve")}
                  </button>
                  <button
                    onClick={() => act(r.requestId, "reject")}
                    disabled={busy === r.requestId}
                    className="flex-1 rounded-lg border border-neutral-border py-2 text-sm text-gray-600 disabled:opacity-50"
                  >
                    {t("admin.reject")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
