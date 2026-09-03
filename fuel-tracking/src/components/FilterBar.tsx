"use client";

import { useEffect, useMemo, useState } from "react";
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

/**
 * 간단 필터 바.
 *  - 기간: 드롭다운 1개 (사용자 지정이면 날짜 2개 + 조회 버튼)
 *  - 조건: '필터' 버튼을 눌렀을 때만 펼침. 선택한 것은 칩으로 요약.
 */
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
  const [open, setOpen] = useState(false);
  // 날짜는 '조회'를 눌러야 적용 (고르는 도중 화면이 계속 바뀌지 않도록)
  const [start, setStart] = useState(filters.customStart ?? "");
  const [end, setEnd] = useState(filters.customEnd ?? "");

  useEffect(() => {
    setStart(filters.customStart ?? "");
    setEnd(filters.customEnd ?? "");
  }, [filters.customStart, filters.customEnd]);

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const parts = useMemo(() => [...new Set(vehicles.map((v) => v.part).filter(Boolean))], [vehicles]);
  const drivers = useMemo(
    () => [...new Set(vehicles.flatMap((v) => v.driverIds).filter(Boolean))],
    [vehicles],
  );
  const types = useMemo(
    () => [
      ...new Set(
        vehicles.map((v) => (v.fuelType === "diesel" ? v.equipmentName : v.vehicleType)).filter(Boolean),
      ),
    ],
    [vehicles],
  );

  // 현재 걸려 있는 조건 (기간 제외)
  const active = [
    filters.fuelType ? { key: "fuelType" as const, label: t(`fuelType.${filters.fuelType}`) } : null,
    filters.part ? { key: "part" as const, label: filters.part } : null,
    filters.vehicleType ? { key: "vehicleType" as const, label: filters.vehicleType } : null,
    filters.driver ? { key: "driver" as const, label: filters.driver } : null,
  ].filter(Boolean) as { key: keyof Filters; label: string }[];

  const ctl =
    "rounded-lg border border-neutral-border bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-hanwha";

  return (
    <div className="space-y-2">
      {/* 한 줄: 기간 드롭다운 + 필터 버튼 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.period}
          onChange={(e) => set({ period: e.target.value as PeriodKey })}
          className={`${ctl} font-medium`}
          aria-label={t("period.label")}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {t(`period.${p}`)}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${
            active.length
              ? "border-hanwha bg-hanwha/10 font-medium text-hanwha"
              : "border-neutral-border bg-white text-gray-700 hover:border-hanwha"
          }`}
        >
          ⚙ {t("filter.more")}
          {active.length > 0 && (
            <span className="rounded-full bg-hanwha px-1.5 text-[11px] font-bold text-white">
              {active.length}
            </span>
          )}
          <span className="text-[10px] text-gray-500">{open ? "▲" : "▼"}</span>
        </button>

        {/* 선택한 조건 요약 — 접혀 있을 때만 */}
        {!open &&
          active.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => set({ [a.key]: "" } as Partial<Filters>)}
              className="rounded-full bg-neutral-soft px-2.5 py-1 text-xs text-gray-700 hover:bg-neutral-border"
            >
              {a.label} ✕
            </button>
          ))}
      </div>

      {/* 사용자 지정 기간: 날짜 고르고 '조회' */}
      {filters.period === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={ctl} />
          <span className="text-sm text-gray-500">~</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={ctl} />
          <button
            type="button"
            onClick={() => set({ customStart: start, customEnd: end })}
            className="rounded-lg bg-hanwha px-4 py-2 text-sm font-bold text-white"
          >
            {t("filter.view")}
          </button>
        </div>
      )}

      {/* 펼쳤을 때만 보이는 조건 4개 */}
      {open && (
        <div className="rounded-card border border-neutral-border bg-white p-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <select
              value={filters.fuelType ?? ""}
              onChange={(e) => set({ fuelType: e.target.value as never })}
              className={ctl}
            >
              <option value="">
                {t("filter.fuelType")}: {t("common.all")}
              </option>
              <option value="diesel">{t("fuelType.diesel")}</option>
              <option value="gasoline">{t("fuelType.gasoline")}</option>
            </select>

            <select value={filters.part ?? ""} onChange={(e) => set({ part: e.target.value })} className={ctl}>
              <option value="">
                {t("filter.part")}: {t("common.all")}
              </option>
              {parts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={filters.vehicleType ?? ""}
              onChange={(e) => set({ vehicleType: e.target.value })}
              className={ctl}
            >
              <option value="">
                {t("filter.vehicleType")}: {t("common.all")}
              </option>
              {types.map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </select>

            <select value={filters.driver ?? ""} onChange={(e) => set({ driver: e.target.value })} className={ctl}>
              <option value="">
                {t("filter.driver")}: {t("common.all")}
              </option>
              {drivers.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...filters, fuelType: "", part: "", vehicleType: "", driver: "" })}
              className="rounded-lg border border-neutral-border px-3 py-1.5 text-sm text-gray-700 hover:border-hanwha"
            >
              {t("filter.reset")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-hanwha px-4 py-1.5 text-sm font-bold text-white"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
