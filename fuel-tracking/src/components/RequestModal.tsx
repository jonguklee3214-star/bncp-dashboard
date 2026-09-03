"use client";

import { useState } from "react";
import type { FuelLog } from "@/types";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, formatL } from "@/lib/format";

/**
 * 입력자가 "이 기록 고치게 해 주세요" 하고 올리는 신청.
 * 값은 여기서 적지 않는다 — 관리자가 승인하면 본인이 직접 고친다.
 */
export function RequestModal({
  log,
  onClose,
  onDone,
}: {
  log: FuelLog;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [by, setBy] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  const input =
    "mt-1 w-full rounded-lg border border-neutral-border px-3 py-2.5 outline-none focus:border-hanwha";

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: log.recordId, requestedBy: by, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "failed");
      setOk(true);
      setMsg(t("request.submitted"));
      onDone();
      setTimeout(onClose, 1800);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-card">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-bold">{t("request.title")}</h2>
          <button onClick={onClose} className="text-gray-400">
            ✕
          </button>
        </div>

        <div className="mb-3 rounded-lg bg-neutral-soft px-3 py-2 text-xs text-gray-700">
          {log.mainVehicleNo || log.controlNo || log.vehicleType} · {formatDateTime(log.fuelDatetime)} ·{" "}
          {formatL(log.fuelVolumeL)}
        </div>

        <p className="mb-4 rounded-lg bg-hanwha/5 p-3 text-xs leading-relaxed text-gray-700">
          {t("request.flow")}
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">{t("request.by")}</span>
            <input value={by} onChange={(e) => setBy(e.target.value)} className={input} />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">{t("request.reason")} *</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("request.reasonPlaceholder")}
              className={input}
            />
          </label>

          {msg && <p className={`text-sm ${ok ? "text-success" : "text-danger"}`}>{msg}</p>}

          <button
            onClick={submit}
            disabled={busy || ok || !reason.trim()}
            className="w-full rounded-lg bg-hanwha py-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? t("common.saving") : t("request.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
