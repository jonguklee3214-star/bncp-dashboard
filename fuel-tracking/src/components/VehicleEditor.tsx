"use client";

import { useState } from "react";
import type { FuelType, Part, Vehicle } from "@/types";
import { useI18n } from "@/lib/i18n";
import { PARTS } from "@/data/seed";

const EMPTY: Vehicle = {
  vehicleId: "",
  fuelType: "diesel",
  mainVehicleNo: "",
  controlNo: "",
  equipmentName: "",
  vehicleType: "",
  capacity: "",
  teamCode: "",
  hourKm: "",
  company: "Construction",
  team: "공사팀",
  part: "",
  driverIds: [],
  tracksMileage: true,
  status: "active",
  createdAt: "",
  updatedAt: "",
};

export function VehicleEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Vehicle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [v, setV] = useState<Vehicle>(initial ? { ...initial } : { ...EMPTY });
  const [drivers, setDrivers] = useState(initial ? initial.driverIds.join(" / ") : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (patch: Partial<Vehicle>) => setV((s) => ({ ...s, ...patch }));
  const input =
    "mt-1 w-full rounded-lg border border-neutral-border px-3 py-2 text-sm outline-none focus:border-hanwha";

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...v,
          driverIds: drivers.split("/").map((d) => d.trim()).filter(Boolean),
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

  const isGasoline = v.fuelType === "gasoline";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{initial ? t("vehicles.edit") : t("vehicles.add")}</h2>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>

        <div className="space-y-3">
          {/* 유종 */}
          <div className="grid grid-cols-2 gap-2">
            {(["diesel", "gasoline"] as FuelType[]).map((ft) => (
              <button
                key={ft}
                onClick={() => set({ fuelType: ft })}
                className={`rounded-lg border py-2 text-sm font-bold ${
                  v.fuelType === ft ? "border-hanwha bg-hanwha text-white" : "border-neutral-border"
                }`}
              >
                {t(`fuelType.${ft}`)}
              </button>
            ))}
          </div>

          {isGasoline && (
            <label className="block">
              <span className="text-xs text-gray-500">{t("entry.mainVehicleNo")}</span>
              <input className={input} value={v.mainVehicleNo} onChange={(e) => set({ mainVehicleNo: e.target.value })} />
            </label>
          )}

          <label className="block">
            <span className="text-xs text-gray-500">{t("entry.controlNo")}</span>
            <input className={input} value={v.controlNo} onChange={(e) => set({ controlNo: e.target.value })} />
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">{t("entry.vehicleType")}</span>
            <input
              className={input}
              value={isGasoline ? v.vehicleType : v.equipmentName}
              onChange={(e) =>
                isGasoline ? set({ vehicleType: e.target.value }) : set({ equipmentName: e.target.value, vehicleType: e.target.value })
              }
            />
          </label>

          {isGasoline ? (
            <>
              <label className="block">
                <span className="text-xs text-gray-500">{t("entry.driver")}</span>
                <input className={input} value={drivers} onChange={(e) => setDrivers(e.target.value)} placeholder={t("vehicles.driversHint")} />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">{t("entry.part")}</span>
                <select className={input} value={v.part} onChange={(e) => set({ part: e.target.value as Part })}>
                  <option value=""></option>
                  {PARTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-gray-500">{t("entry.capacity")}</span>
                <input className={input} value={v.capacity} onChange={(e) => set({ capacity: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">{t("entry.teamCode")}</span>
                <input className={input} value={v.teamCode} onChange={(e) => set({ teamCode: e.target.value })} />
              </label>
            </div>
          )}

          <label className="block">
            <span className="text-xs text-gray-500">{t("vehicles.status")}</span>
            <select className={input} value={v.status} onChange={(e) => set({ status: e.target.value as Vehicle["status"] })}>
              <option value="active">{t("vehicles.active")}</option>
              <option value="inactive">{t("vehicles.inactive")}</option>
            </select>
          </label>

          {err && <p className="text-sm text-danger">{err}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-lg bg-hanwha py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
