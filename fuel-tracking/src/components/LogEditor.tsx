"use client";

import { useState } from "react";
import type { FuelLog } from "@/types";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";

// 관리자 기록 수정 모달. pin 을 헤더로 전송.
export function LogEditor({
  log,
  pin,
  onClose,
  onSaved,
}: {
  log: FuelLog;
  pin: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [fuelVolume, setFuelVolume] = useState(String(log.fuelVolumeL));
  const [mileage, setMileage] = useState(log.mileageKm != null ? String(log.mileageKm) : "");
  const [remarks, setRemarks] = useState(log.remarks);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [voiding, setVoiding] = useState(false);

  const hasMileage = log.mileageKm != null;
  const input =
    "mt-1 w-full rounded-lg border border-neutral-border px-3 py-2.5 outline-none focus:border-hanwha";

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({
          recordId: log.recordId,
          fuelVolume: Number(fuelVolume),
          mileageKm: hasMileage && mileage !== "" ? Number(mileage) : undefined,
          remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "save failed");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  async function voidRecord() {
    if (!confirm(t("admin.voidConfirm"))) return;
    const reason = window.prompt(t("admin.voidReason")) ?? "";
    setVoiding(true);
    setErr("");
    try {
      const res = await fetch("/api/logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ recordId: log.recordId, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "void failed");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-card">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-bold">{t("admin.editRecord")}</h2>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        <div className="mb-4 text-xs text-gray-500">
          {log.mainVehicleNo || log.controlNo || log.vehicleType} · {formatDateTime(log.fuelDatetime)}
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">
              {t("entry.fuelVolume")} ({t("units.l")})
            </span>
            <input
              inputMode="decimal"
              value={fuelVolume}
              onChange={(e) => setFuelVolume(e.target.value.replace(/[^0-9.]/g, ""))}
              className={`${input} text-lg font-bold`}
            />
          </label>

          {hasMileage && (
            <label className="block">
              <span className="text-xs font-medium text-gray-600">{t("entry.currentMileage")} (km)</span>
              <input
                inputMode="decimal"
                value={mileage}
                onChange={(e) => setMileage(e.target.value.replace(/[^0-9.]/g, ""))}
                className={input}
              />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium text-gray-600">{t("entry.remarks")}</span>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={input} />
          </label>

          {err && <p className="text-sm text-danger">{err}</p>}

          <button
            onClick={save}
            disabled={saving || !fuelVolume}
            className="w-full rounded-lg bg-hanwha py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>

          <button
            onClick={voidRecord}
            disabled={voiding}
            className="w-full rounded-lg border border-danger/40 py-2.5 text-sm font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
          >
            🗑 {t("admin.void")}
          </button>
        </div>
      </div>
    </div>
  );
}
