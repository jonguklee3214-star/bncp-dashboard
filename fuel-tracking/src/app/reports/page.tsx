"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { applyFilters, byPart, byVehicle, computeKpi, type Filters } from "@/lib/stats";
import { formatL } from "@/lib/format";
import { downloadCsv, logsToCsv } from "@/lib/csv";
import { Card, KpiTile, SectionTitle } from "@/components/ui";
import { FilterBar } from "@/components/FilterBar";

export default function ReportsPage() {
  const { t } = useI18n();
  const { vehicles, logs } = useStore();
  const [filters, setFilters] = useState<Filters>({ period: "thisMonth" });

  const filtered = useMemo(() => applyFilters(logs, filters), [logs, filters]);
  const kpi = useMemo(() => computeKpi(filtered), [filtered]);
  const parts = useMemo(() => byPart(filtered), [filtered]);
  const vehiclesAgg = useMemo(() => byVehicle(filtered), [filtered]);

  return (
    <div className="space-y-5 print-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("reports.title")}</h1>
        <div className="no-print flex gap-2">
          <button
            onClick={() => downloadCsv("fuel-report.csv", logsToCsv(filtered))}
            className="rounded-md border border-neutral-border bg-white px-3 py-1.5 text-sm hover:border-hanwha"
          >
            {t("common.csv")}
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md border border-neutral-border bg-white px-3 py-1.5 text-sm hover:border-hanwha"
          >
            {t("common.print")} / {t("common.pdf")}
          </button>
        </div>
      </div>

      <div className="no-print">
        <FilterBar filters={filters} onChange={setFilters} vehicles={vehicles} />
      </div>

      {/* 금액 정보 없음 (항목 58) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label={t("dashboard.kpi.transactions")} value={String(kpi.transactions)} unit={t("units.transactions")} />
        <KpiTile label={t("dashboard.kpi.volume")} value={kpi.volume.toLocaleString()} unit={t("units.l")} />
        <KpiTile label={t("dashboard.kpi.distance")} value={kpi.distance.toLocaleString()} unit={t("units.km")} />
        <KpiTile label={t("dashboard.kpi.avgVolume")} value={String(kpi.avgVolume)} unit={t("units.l")} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>{t("dashboard.charts.partVolume")}</SectionTitle>
          <SimpleTable rows={parts.map((p) => [p.key, `${p.count}`, formatL(p.volume)])} cols={[t("entry.part"), t("units.transactions"), t("entry.fuelVolume")]} />
        </Card>
        <Card className="p-4">
          <SectionTitle>{t("dashboard.charts.vehicleVolume")}</SectionTitle>
          <SimpleTable rows={vehiclesAgg.slice(0, 15).map((v) => [v.key, `${v.count}`, formatL(v.volume)])} cols={[t("filter.vehicle"), t("units.transactions"), t("entry.fuelVolume")]} />
        </Card>
      </div>
    </div>
  );
}

function SimpleTable({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-border text-left text-xs text-gray-500">
          {cols.map((c, i) => (
            <th key={i} className={`py-1.5 font-medium ${i > 0 ? "text-right" : ""}`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-border">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={`tabular py-1.5 ${j > 0 ? "text-right" : "font-medium"}`}>{c}</td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td className="py-4 text-gray-400">—</td></tr>
        )}
      </tbody>
    </table>
  );
}
