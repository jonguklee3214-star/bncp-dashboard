"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui";

export default function VehiclesPage() {
  const { t } = useI18n();
  const { vehicles, loading } = useStore();
  const [q, setQ] = useState("");

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
      <h1 className="text-xl font-bold">{t("vehicles.title")}</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`🔍 ${t("common.search")}`}
        className="w-full rounded-lg border border-neutral-border px-4 py-2.5 outline-none focus:border-hanwha"
      />
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
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-border">
            {filtered.map((v) => (
              <tr key={v.vehicleId}>
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
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
