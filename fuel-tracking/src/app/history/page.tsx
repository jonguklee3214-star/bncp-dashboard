"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { EditHistoryEntry, FuelLog } from "@/types";
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
  // 관리자가 승인해서 지금 고칠 수 있는 기록들 (recordId → requestId)
  const [open, setOpen] = useState<Record<string, { requestId: string; requestedBy: string; reason: string }>>({});
  // 기록별 수정 흔적
  const [edits, setEdits] = useState<Record<string, EditHistoryEntry[]>>({});
  const [shown, setShown] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [o, e] = await Promise.all([
        fetch("/api/requests/open").then((r) => r.json()),
        fetch("/api/logs/edits").then((r) => r.json()),
      ]);
      setOpen(o.open ?? {});
      setEdits(e.edits ?? {});
    } catch {
      /* 표시용 부가 정보라 실패해도 목록은 그대로 */
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const afterChange = useCallback(async () => {
    await refresh();
    await loadMeta();
  }, [refresh, loadMeta]);

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

      {editing && (isAdmin || open[editing.recordId]) && (
        <LogEditor
          log={editing}
          pin={isAdmin ? (pin ?? undefined) : undefined}
          requestId={isAdmin ? undefined : open[editing.recordId]?.requestId}
          onClose={() => setEditing(null)}
          onSaved={afterChange}
        />
      )}
      {requesting && (
        <RequestModal log={requesting} onClose={() => setRequesting(null)} onDone={loadMeta} />
      )}
      {requestsOpen && pin && (
        <RequestsPanel
          pin={pin}
          logs={logs}
          onClose={() => setRequestsOpen(false)}
          onChanged={afterChange}
          onEditNow={(l) => setEditing(l)}
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
                <th className="px-3 py-2 font-medium">{t("entry.remarks")}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {filtered.map((l) => (
                <Fragment key={l.recordId}>
                  <tr>
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTime(l.fuelDatetime)}</td>
                    <td className="px-3 py-2 font-medium">{l.mainVehicleNo || "—"}</td>
                    <td className="px-3 py-2">{l.controlNo || l.vehicleType}</td>
                    <td className="px-3 py-2">{l.driver || "—"}</td>
                    <td className="px-3 py-2">{l.part || l.teamCode || "—"}</td>
                    <td className="tabular px-3 py-2 text-right">
                      {l.distanceKm != null ? formatKm(l.distanceKm) : "—"}
                    </td>
                    <td className="tabular px-3 py-2 text-right font-bold text-hanwha">
                      {formatL(l.fuelVolumeL)}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate" title={l.remarks}>
                          {l.remarks || "—"}
                        </span>
                        <EditedBadge log={l} edits={edits} shown={shown} setShown={setShown} t={t} />
                      </div>
                    </td>
                    <td className="no-print px-3 py-2 text-right">
                      <EditButton
                        log={l}
                        isAdmin={isAdmin}
                        open={open}
                        t={t}
                        onEdit={() => setEditing(l)}
                        onRequest={() => setRequesting(l)}
                      />
                    </td>
                  </tr>
                  {shown === l.recordId && (
                    <tr className="bg-neutral-soft/60">
                      <td colSpan={9} className="px-3 py-2">
                        <EditHistoryList entries={edits[l.recordId] ?? []} t={t} />
                      </td>
                    </tr>
                  )}
                </Fragment>
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
              <EditButton
                log={l}
                isAdmin={isAdmin}
                open={open}
                t={t}
                onEdit={() => setEditing(l)}
                onRequest={() => setRequesting(l)}
              />
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
              {l.remarks && <Row label={t("entry.remarks")} value={l.remarks} />}
            </div>
            <div className="mt-2">
              <EditedBadge log={l} edits={edits} shown={shown} setShown={setShown} t={t} />
            </div>
            {shown === l.recordId && (
              <div className="mt-2 rounded-lg bg-neutral-soft p-2">
                <EditHistoryList entries={edits[l.recordId] ?? []} t={t} />
              </div>
            )}
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

/** 관리자 / 승인받은 요청자 / 그 외 — 세 가지 상태의 버튼 하나. */
function EditButton({
  log,
  isAdmin,
  open,
  t,
  onEdit,
  onRequest,
}: {
  log: FuelLog;
  isAdmin: boolean;
  open: Record<string, { requestId: string; requestedBy: string; reason: string }>;
  t: (k: string) => string;
  onEdit: () => void;
  onRequest: () => void;
}) {
  if (isAdmin) {
    return (
      <button
        onClick={onEdit}
        className="rounded-md border border-neutral-border px-2 py-1 text-xs hover:border-hanwha"
      >
        {t("vehicles.edit")}
      </button>
    );
  }
  if (open[log.recordId]) {
    return (
      <button
        onClick={onEdit}
        className="rounded-md border border-success bg-success/10 px-2 py-1 text-xs font-bold text-success"
      >
        ✏ {t("request.editNow")}
      </button>
    );
  }
  return (
    <button
      onClick={onRequest}
      className="rounded-md border border-neutral-border px-2 py-1 text-xs hover:border-hanwha"
    >
      {t("request.button")}
    </button>
  );
}

/** 수정된 기록에 붙는 '수정됨 n회' 표시. 누르면 이력을 펼친다. */
function EditedBadge({
  log,
  edits,
  shown,
  setShown,
  t,
}: {
  log: FuelLog;
  edits: Record<string, EditHistoryEntry[]>;
  shown: string | null;
  setShown: (v: string | null) => void;
  t: (k: string) => string;
}) {
  const n = edits[log.recordId]?.length ?? 0;
  if (!n) return null;
  return (
    <button
      onClick={() => setShown(shown === log.recordId ? null : log.recordId)}
      className="no-print shrink-0 rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning"
    >
      ✏ {t("history.edited")} {n}
    </button>
  );
}

function EditHistoryList({ entries, t }: { entries: EditHistoryEntry[]; t: (k: string) => string }) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-1 text-xs text-gray-700">
      <div className="font-bold">{t("history.editHistory")}</div>
      {entries.map((e, i) => (
        <div key={i} className="flex flex-wrap gap-x-2">
          <span className="text-gray-500">{formatDateTime(e.at)}</span>
          <span className="font-medium">{e.user}</span>
          <span>
            {e.action === "fuellog.void" ? `🗑 ${t("admin.void")}` : `→ ${e.result}`}
          </span>
          {e.reason && <span className="text-gray-500">📝 {e.reason}</span>}
        </div>
      ))}
    </div>
  );
}
