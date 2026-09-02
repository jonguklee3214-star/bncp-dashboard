"use client";

import { useMemo } from "react";
import type { Vehicle } from "@/types";
import { useI18n } from "@/lib/i18n";
import type { Filters, PeriodKey } from "@/lib/stats";

const PERIODS: PeriodKey[] = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "custom",
];

export function FilterBar({
  filters,
  onChange,
  vehicles,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  vehicles: Vehicle[];
}) {
  const { t } = useI18n();
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const parts = useMemo(
    () => [...new Set(vehicles.map((v) => v.part).filter(Boolean))],
    [vehicles],
  );
  const drivers = useMemo(
    () => [...new Set(vehicles.flatMap((v) => v.driverIds).filter(Boolean))],
    [vehicles],
  );
  const types = useMemo(
    () =>
      [
        ...new Set(
          vehicles.map((v) => (v.fuelType === "diesel" ? v.equipmentName : v.vehicleType)).filter(Boolean),
        ),
      ],
    [vehicles],
  );

  const selCls =
    "rounded-md border border-neutral-border bg-white px-2 py-1.5 text-sm outline-none focus:border-hanwha";

  return (
    <div className="space-y-3">
      {/* 기간 */}
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set({ period: p })}
            className={`rounded-full px-3 py-1 text-xs ${
              filters.period === p
                ? "bg-hanwha text-white"
                : "border border-neutral-border bg-white text-gray-600 hover:border-hanwha"
            }`}
          >
            {t(`period.${p}`)}
          </button>
        ))}
      </div>

      {filters.period === "custom" && (
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.customStart ?? ""}
            onChange={(e) => set({ customStart: e.target.value })}
            className={selCls}
          />
          <input
            type="date"
            value={filters.customEnd ?? ""}
            onChange={(e) => set({ customEnd: e.target.value })}
            className={selCls}
          />
        </div>
      )}

      {/* 조건 */}
      <div className="flex flex-wrap gap-2">
        <select value={filters.fuelType ?? ""} onChange={(e) => set({ fuelType: e.target.value as never })} className={selCls}>
          <option value="">{t("filter.fuelType")}: {t("common.all")}</option>
          <option value="diesel">{t("fuelType.diesel")}</option>
          <option value="gasoline">{t("fuelType.gasoline")}</option>
        </select>

        <select value={filters.part ?? ""} onChange={(e) => set({ part: e.target.value })} className={selCls}>
          <option value="">{t("filter.part")}: {t("common.all")}</option>
          {parts.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select value={filters.vehicleType ?? ""} onChange={(e) => set({ vehicleType: e.target.value })} className={selCls}>
          <option value="">{t("filter.vehicleType")}: {t("common.all")}</option>
          {types.map((ty) => (
            <option key={ty} value={ty}>{ty}</option>
          ))}
        </select>

        <select value={filters.driver ?? ""} onChange={(e) => set({ driver: e.target.value })} className={selCls}>
          <option value="">{t("filter.driver")}: {t("common.all")}</option>
          {drivers.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
