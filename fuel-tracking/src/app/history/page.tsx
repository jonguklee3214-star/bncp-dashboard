"use client";

import { useMemo, useState } from "react";
import type { FuelLog } from "@/types";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useAdmin } from "@/lib/useAdmin";
import { formatDateTime, formatKm, formatL } from "@/lib/format";
import { downloadCsv, logsToCsv } from "@/lib/csv";
import { Card } from "@/components/ui";
import { LogEditor } from "@/components/LogEditor";
import { RequestModal } from "@/components/RequestModal";
import { RequestsPanel } from "@/components/RequestsPanel";

export default function HistoryPage() {
  const { t } = useI18n();
  const { logs, loading, refresh } = useStore();
  const { isAdmin, pin, unlock, lock } = useAdmin();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<FuelLog | null>(null);
  const [requesting, setRequesting] = useState<FuelLog | null>(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");

  async function tryUnlock() {
    setPinErr("");
    const r = await unlock(pinInput);
    if (r.ok) {
      setPinOpen(false);
      setPinInput("");
    } else {
      setPinErr(r.message || t("admin.wrongPin"));
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sorted = [...logs].sort((a, b) => b.fuelDatetime.localeCompare(a.fuelDatetime));
    if (!s) return sorted;
    // 부분 검색: 차량번호·관리번호·운전자·파트·차종 (항목 48)
    return sorted.filter((l) =>
      [l.mainVehicleNo, l.controlNo, l.driver, l.part, l.vehicleType]
        .join(" ")
        .toLowerCase()
        .includes(s),
    );
  }, [logs, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("history.title")}</h1>
        <div className="no-print flex flex-wrap gap-2">
          {isAdmin ? (
            <>
              <button
                onClick={() => setRequestsOpen(true)}
                className="rounded-md border border-neutral-border bg-white px-3 py-1.5 text-sm hover:border-hanwha"
              >
                📥 {t("admin.requests")}
              </button>
              <button
                onClick={lock}
                className="rounded-md border border-hanwha bg-hanwha/10 px-3 py-1.5 text-sm font-medium text-hanwha"
              >
                🔓 {t("admin.unlocked")}
              </button>
            </>
          ) : (
            <button
              onClick={() => setPinOpen(true)}
              className="rounded-md border border-neutral-border bg-white px-3 py-1.5 text-sm hover:border-hanwha"
            >
              🔒 {t("admin.edit")}
            </button>
          )}
          <button
            onClick={() => downloadCsv("fuel-history.csv", logsToCsv(filtered))}
            className="rounded-md border border-neutral-border bg-white px-3 py-1.5 text-sm hover:border-hanwha"
          >
            {t("common.csv")}
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md border border-neutral-border bg-white px-3 py-1.5 text-sm hover:border-hanwha"
          >
            {t("common.print")}
          </button>
        </div>
      </div>

      {/* 관리자 PIN 입력 */}
      {pinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-card bg-white p-5">
            <div className="mb-3 font-bold">{t("admin.enterPin")}</div>
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              autoFocus
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
              className="w-full rounded-lg border border-neutral-border px-3 py-2.5 outline-none focus:border-hanwha"
            />
            {pinErr && <p className="mt-2 text-sm text-danger">{pinErr}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setPinOpen(false);
                  setPinInput("");
                  setPinErr("");
                }}
                className="flex-1 rounded-lg border border-neutral-border py-2 text-sm"
              >
                {t("common.cancel")}
              </button>
              <button onClick={tryUnlock} className="flex-1 rounded-lg bg-hanwha py-2 text-sm font-bold text-white">
                {t("admin.unlock")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && pin && (
        <LogEditor log={editing} pin={pin} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
      {requesting && (
        <RequestModal log={requesting} onClose={() => setRequesting(null)} onDone={() => {}} />
      )}
      {requestsOpen && pin && (
        <RequestsPanel
          pin={pin}
          logs={logs}
          onClose={() => setRequestsOpen(false)}
          onChanged={refresh}
        />
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`🔍 ${t("history.searchPlaceholder")}`}
        className="no-print w-full rounded-lg border border-neutral-border px-4 py-2.5 outline-none focus:border-hanwha"
      />

      {loading && <p className="text-sm text-gray-400">{t("common.loading")}</p>}
      {!loading && filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400">{t("common.noRecords")}</p>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <Card className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border bg-neutral-soft text-left text-xs text-gray-500">
                <th className="px-3 py-2 font-medium">{t("history.datetime")}</th>
                <th className="px-3 py-2 font-medium">{t("entry.mainVehicleNo")}</th>
                <th className="px-3 py-2 font-medium">{t("entry.controlNo")}</th>
                <th className="px-3 py-2 font-medium">{t("entry.driver")}</th>
                <th className="px-3 py-2 font-medium">{t("entry.part")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("entry.distance")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("entry.fuelVolume")}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {filtered.map((l) => (
                <tr key={l.recordId}>
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(l.fuelDatetime)}</td>
                  <td className="px-3 py-2 font-medium">{l.mainVehicleNo || "—"}</td>
                  <td className="px-3 py-2">{l.controlNo || l.vehicleType}</td>
                  <td className="px-3 py-2">{l.driver || "—"}</td>
                  <td className="px-3 py-2">{l.part || l.teamCode || "—"}</td>
                  <td className="tabular px-3 py-2 text-right">{l.distanceKm != null ? formatKm(l.distanceKm) : "—"}</td>
                  <td className="tabular px-3 py-2 text-right font-bold text-hanwha">{formatL(l.fuelVolumeL)}</td>
                  <td className="no-print px-3 py-2 text-right">
                    <button
                      onClick={() => (isAdmin ? setEditing(l) : setRequesting(l))}
                      className="rounded-md border border-neutral-border px-2 py-1 text-xs hover:border-hanwha"
                    >
                      {isAdmin ? t("vehicles.edit") : t("request.button")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Mobile cards (항목 47) */}
      <div className="space-y-3 md:hidden">
        {filtered.map((l) => (
          <Card key={l.recordId} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold">{l.mainVehicleNo || l.controlNo || l.vehicleType}</div>
                <div className="text-xs text-gray-500">{l.controlNo || l.vehicleType}</div>
              </div>
              <button
                onClick={() => (isAdmin ? setEditing(l) : setRequesting(l))}
                className="rounded-md border border-neutral-border px-2 py-1 text-xs hover:border-hanwha"
              >
                {isAdmin ? t("vehicles.edit") : t("request.button")}
              </button>
            </div>
            {l.driver && <div className="text-sm text-gray-700">{l.driver}</div>}
            <div className="mt-2 space-y-1 text-sm">
              <div className="text-xs text-gray-500">{formatDateTime(l.fuelDatetime)}</div>
              {l.mileageKm != null && (
                <Row label={t("entry.currentMileage")} value={formatKm(l.mileageKm)} />
              )}
              {l.distanceKm != null && (
                <Row label={t("entry.distance")} value={formatKm(l.distanceKm)} />
              )}
              <Row label={t("entry.fuelVolume")} value={formatL(l.fuelVolumeL)} highlight />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`tabular ${highlight ? "font-bold text-hanwha" : ""}`}>{value}</span>
    </div>
  );
}
