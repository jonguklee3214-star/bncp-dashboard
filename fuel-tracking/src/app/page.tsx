"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import {
  applyFilters,
  byDay,
  byDriverName,
  byMonth,
  byPart,
  byVehicle,
  byWeek,
  computeKpi,
  mileageIssues,
  type Filters,
} from "@/lib/stats";
import { formatDayLabel, formatDateTime, formatL } from "@/lib/format";
import { KpiTile, Card } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";
import { BucketBarChart } from "@/components/Charts";

export default function DashboardPage() {
  const { t } = useI18n();
  const { vehicles, logs, loading, error } = useStore();
  const [filters, setFilters] = useState<Filters>({ period: "thisMonth" });

  const filtered = useMemo(() => applyFilters(logs, filters), [logs, filters]);
  const kpi = useMemo(() => computeKpi(filtered), [filtered]);
  const recent = useMemo(
    () => [...filtered].sort((a, b) => b.fuelDatetime.localeCompare(a.fuelDatetime)).slice(0, 8),
    [filtered],
  );
  const issues = useMemo(() => mileageIssues(filtered), [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("dashboard.title")}</h1>
      </div>

      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-gray-400">{t("common.loading")}</p>}

      <FilterBar filters={filters} onChange={setFilters} vehicles={vehicles} />

      {/* Data Alerts (항목 78) */}
      {issues.length > 0 && (
        <Card className="border-warning/40 bg-warning/5 p-3">
          <div className="text-sm font-bold text-warning">
            ⚠ {t("dashboard.alerts")} · {issues.length} {t("dashboard.mileageIssues")}
          </div>
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {issues.slice(0, 5).map((l) => (
              <li key={l.recordId}>
                {l.mainVehicleNo || l.controlNo} · {formatDateTime(l.fuelDatetime)} ·{" "}
                {l.previousMileageKm?.toLocaleString()} → {l.mileageKm?.toLocaleString()} km
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* KPI (금액 KPI 없음, 항목 41) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile label={t("dashboard.kpi.transactions")} value={String(kpi.transactions)} unit={t("units.transactions")} />
        <KpiTile label={t("dashboard.kpi.volume")} value={kpi.volume.toLocaleString()} unit={t("units.l")} />
        <KpiTile label={t("dashboard.kpi.distance")} value={kpi.distance.toLocaleString()} unit={t("units.km")} />
        <KpiTile label={t("dashboard.kpi.avgVolume")} value={String(kpi.avgVolume)} unit={t("units.l")} />
        <KpiTile label={t("dashboard.kpi.activeVehicles")} value={String(kpi.activeVehicles)} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BucketBarChart title={t("dashboard.charts.dailyVolume")} data={byDay(filtered)} metric="volume" unit={t("units.l")} labelFormatter={(k) => formatDayLabel(k + "T00:00:00")} />
        <BucketBarChart title={t("dashboard.charts.dailyCount")} data={byDay(filtered)} metric="count" unit={t("units.transactions")} labelFormatter={(k) => formatDayLabel(k + "T00:00:00")} />
        <BucketBarChart title={t("dashboard.charts.weeklyVolume")} data={byWeek(filtered)} metric="volume" unit={t("units.l")} />
        <BucketBarChart title={t("dashboard.charts.monthlyVolume")} data={byMonth(filtered)} metric="volume" unit={t("units.l")} />
        <BucketBarChart title={t("dashboard.charts.partVolume")} data={byPart(filtered)} metric="volume" unit={t("units.l")} horizontal />
        <BucketBarChart title={t("dashboard.charts.vehicleVolume")} data={byVehicle(filtered).slice(0, 10)} metric="volume" unit={t("units.l")} horizontal />
        <BucketBarChart title={t("dashboard.charts.driverVolume")} data={byDriverName(filtered).slice(0, 10)} metric="volume" unit={t("units.l")} horizontal />
      </div>

      {/* Recent */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-bold text-gray-700">{t("dashboard.recent")}</h3>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">{t("common.noRecords")}</p>
        ) : (
          <ul className="divide-y divide-neutral-border">
            {recent.map((l) => (
              <li key={l.recordId} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="font-medium">{l.mainVehicleNo || l.controlNo}</div>
                  <div className="text-xs text-gray-500">
                    {l.controlNo} · {formatDateTime(l.fuelDatetime)}
                  </div>
                </div>
                <div className="tabular font-bold text-hanwha">{formatL(l.fuelVolumeL)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
