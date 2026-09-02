"use client";

import { useMemo, useState } from "react";
import type { Vehicle } from "@/types";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui";
import { VehicleEditor } from "@/components/VehicleEditor";
import { VehicleImport } from "@/components/VehicleImport";

export default function VehiclesPage() {
  const { t } = useI18n();
  const { vehicles, loading, refresh } = useStore();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [adding, setAdding] = useState(false);

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
          <VehicleImport onDone={refresh} />
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg bg-hanwha px-3 py-1.5 text-sm font-bold text-white"
          >
            + {t("vehicles.add")}
          </button>
        </div>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`🔍 ${t("common.search")}`}
        className="w-full rounded-lg border border-neutral-border px-4 py-2.5 outline-none focus:border-hanwha"
      />

      {(adding || editing) && (
        <VehicleEditor
          initial={editing ?? undefined}
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
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setEditing(v)}
                    className="rounded-md border border-neutral-border px-2 py-1 text-xs hover:border-hanwha"
                  >
                    {t("vehicles.edit")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
