"use client";

import { useMemo, useState } from "react";
import type { Vehicle } from "@/types";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useAdmin } from "@/lib/useAdmin";
import { Card } from "@/components/ui";
import { VehicleEditor } from "@/components/VehicleEditor";
import { VehicleImport } from "@/components/VehicleImport";

export default function VehiclesPage() {
  const { t } = useI18n();
  const { vehicles, loading, refresh } = useStore();
  const { isAdmin, pin, unlock, lock } = useAdmin();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [adding, setAdding] = useState(false);
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

  // 미터기 고장 등 주행거리 면제 승인/해제 (관리자)
  async function toggleExempt(v: Vehicle) {
    if (!pin) return;
    if (v.mileageExemptReason) {
      await fetch("/api/exempt", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ controlNo: v.controlNo }),
      });
    } else {
      const reason = window.prompt(t("admin.exemptReason"));
      if (!reason?.trim()) return;
      await fetch("/api/exempt", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": pin },
        body: JSON.stringify({ controlNo: v.controlNo, reason }),
      });
    }
    await refresh();
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vehicles;
    return vehicles.filter((v) =>
      [v.mainVehicleNo, v.controlNo, v.equipmentName, v.vehicleType, v.part, v.teamCode]
        .join(" ")
        .toLowerCase()
        .includes(s),
    );
  }, [vehicles, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("vehicles.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <button
              onClick={lock}
              className="rounded-md border border-hanwha bg-hanwha/10 px-3 py-1.5 text-sm font-medium text-hanwha"
            >
              🔓 {t("admin.unlocked")}
            </button>
          ) : (
            <button
              onClick={() => setPinOpen(true)}
              className="rounded-md border border-neutral-border bg-white px-3 py-1.5 text-sm hover:border-hanwha"
            >
              🔒 {t("admin.locked")}
            </button>
          )}
          {isAdmin && pin && (
            <>
              <VehicleImport pin={pin} onDone={refresh} />
              <button
                onClick={() => setAdding(true)}
                className="rounded-lg bg-hanwha px-3 py-1.5 text-sm font-bold text-white"
              >
                + {t("vehicles.add")}
              </button>
            </>
          )}
        </div>
      </div>

      {isAdmin ? (
        <p className="text-xs text-gray-500">🛠 {t("admin.exemptHint")}</p>
      ) : (
        <p className="text-xs text-gray-500">🔒 {t("admin.adminOnly")}</p>
      )}

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
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`🔍 ${t("common.search")}`}
        className="w-full rounded-lg border border-neutral-border px-4 py-2.5 outline-none focus:border-hanwha"
      />

      {(adding || editing) && pin && (
        <VehicleEditor
          initial={editing ?? undefined}
          pin={pin}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      )}
      {loading && <p className="text-sm text-gray-400">{t("common.loading")}</p>}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border bg-neutral-soft text-left text-xs text-gray-500">
              <th className="px-3 py-2 font-medium">{t("fuelType.label")}</th>
              <th className="px-3 py-2 font-medium">{t("entry.mainVehicleNo")}</th>
              <th className="px-3 py-2 font-medium">{t("entry.controlNo")}</th>
              <th className="px-3 py-2 font-medium">{t("entry.vehicleType")}</th>
              <th className="px-3 py-2 font-medium">{t("entry.capacity")}</th>
              <th className="px-3 py-2 font-medium">{t("entry.driver")}</th>
              <th className="px-3 py-2 font-medium">{t("entry.part")}</th>
              <th className="px-3 py-2 font-medium">{t("vehicles.status")}</th>
              <th className="px-3 py-2 font-medium">km</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-border">
            {filtered.map((v) => (
              <tr key={v.vehicleId} className={v.status === "inactive" ? "opacity-50" : ""}>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      v.fuelType === "diesel" ? "bg-ink/10 text-ink" : "bg-hanwha/10 text-hanwha"
                    }`}
                  >
                    {t(`fuelType.${v.fuelType}`)}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">{v.mainVehicleNo || "—"}</td>
                <td className="px-3 py-2">{v.controlNo}</td>
                <td className="px-3 py-2">{v.fuelType === "diesel" ? v.equipmentName : v.vehicleType}</td>
                <td className="px-3 py-2">{v.capacity || "—"}</td>
                <td className="px-3 py-2">{v.driverIds.join(" / ") || "—"}</td>
                <td className="px-3 py-2">{v.part || v.teamCode || "—"}</td>
                <td className="px-3 py-2">
                  {v.status === "active" ? t("vehicles.active") : t("vehicles.inactive")}
                </td>
                <td className="px-3 py-2">
                  {v.mileageExemptReason ? (
                    <span
                      title={v.mileageExemptReason}
                      className="rounded bg-warning/15 px-1.5 py-0.5 text-xs text-warning"
                    >
                      🛠 {t("admin.exemptOn")}
                    </span>
                  ) : v.tracksMileage ? (
                    <span className="text-xs text-gray-600">✔</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    {isAdmin && (v.tracksMileage || v.mileageExemptReason) && (
                      <button
                        onClick={() => toggleExempt(v)}
                        className="rounded-md border border-neutral-border px-2 py-1 text-xs hover:border-hanwha"
                      >
                        {v.mileageExemptReason ? t("admin.exemptRevoke") : t("admin.exemptGrant")}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => setEditing(v)}
                        className="rounded-md border border-neutral-border px-2 py-1 text-xs hover:border-hanwha"
                      >
                        {t("vehicles.edit")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
