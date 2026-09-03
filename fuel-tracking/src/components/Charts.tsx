"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Bucket } from "@/lib/stats";
import { useI18n } from "@/lib/i18n";
import { Card } from "./ui";

// 유종 2계열. 주황(한화)=가솔린, 파랑=디젤 — 색각 이상에서도 구분되는 조합
// (검증: protan ΔE 32.3 / 일반 시야 ΔE 40.5).
const DIESEL = "#2563EB";
const GASOLINE = "#F37321";
const SURFACE = "#FFFFFF";

interface Row {
  label: string;
  value: number; // 합계 (라벨용)
  diesel: number;
  gasoline: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * 하나의 막대 안에 디젤·가솔린을 쌓아 보여주는 차트 (항목 74).
 * 값 라벨은 막대 끝에 합계로 한 번만 붙이고, 유종별 값은 툴팁과 범례로 읽는다.
 */
export function BucketBarChart({
  title,
  data,
  metric,
  unit,
  labelFormatter,
  horizontal = false,
}: {
  title: string;
  data: Bucket[];
  metric: "volume" | "count";
  unit?: string;
  labelFormatter?: (key: string) => string;
  horizontal?: boolean;
}) {
  const { t } = useI18n();

  const rows: Row[] = data.map((d) => ({
    label: labelFormatter ? labelFormatter(d.key) : d.key,
    value: metric === "volume" ? d.volume : d.count,
    diesel: metric === "volume" ? d.volumeDiesel : d.countDiesel,
    gasoline: metric === "volume" ? d.volumeGasoline : d.countGasoline,
  }));

  const suffix = unit ? ` ${unit}` : "";
  const empty = rows.length === 0 || rows.every((r) => r.value === 0);
  const names: Record<string, string> = {
    diesel: t("fuelType.diesel"),
    gasoline: t("fuelType.gasoline"),
  };

  const tooltip = (
    <Tooltip
      cursor={{ fill: "rgba(17,24,39,0.04)" }}
      contentStyle={{
        borderRadius: 10,
        border: "1px solid #E5E7EB",
        fontSize: 12,
        boxShadow: "0 4px 16px -6px rgba(0,0,0,.15)",
      }}
      formatter={(v: number, k: string) => [`${fmt(v)}${suffix}`, names[k] ?? k]}
      labelStyle={{ color: "#6b7280", fontWeight: 600 }}
    />
  );

  // 합계 라벨: 스택 맨 위(가솔린) 막대에 total 값을 붙인다.
  const totalLabel = (position: "top" | "right") => (
    <LabelList
      dataKey="value"
      position={position}
      formatter={(v: number) => `${fmt(v)}${suffix}`}
      style={{
        fontSize: position === "top" ? 12 : 11,
        fill: "#111827",
        fontWeight: 700,
      }}
    />
  );

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-700">{title}</h3>
        {unit && <span className="text-[11px] text-gray-400">{t("common.unit")}: {unit}</span>}
      </div>

      {/* 범례 — 계열이 둘이므로 항상 표시 */}
      <div className="mb-2 flex items-center gap-3 text-[11px] text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: DIESEL }} />
          {t("fuelType.diesel")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GASOLINE }} />
          {t("fuelType.gasoline")}
        </span>
      </div>

      {empty ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-300">
          {t("common.noData")}
        </div>
      ) : (
        <div style={{ width: "100%", height: horizontal ? Math.max(150, rows.length * 40) : 230 }}>
          <ResponsiveContainer>
            {horizontal ? (
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 52, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#F0F0F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  tick={{ fontSize: 12, fill: "#374151" }}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                {tooltip}
                <Bar
                  dataKey="diesel"
                  stackId="f"
                  fill={DIESEL}
                  stroke={SURFACE}
                  strokeWidth={1}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="gasoline"
                  stackId="f"
                  fill={GASOLINE}
                  stroke={SURFACE}
                  strokeWidth={1}
                  radius={[0, 5, 5, 0]}
                  maxBarSize={22}
                >
                  {totalLabel("right")}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={rows} margin={{ left: -8, right: 12, top: 22, bottom: 4 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#F0F0F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#374151" }}
                  interval="preserveStartEnd"
                  axisLine={{ stroke: "#E5E7EB" }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "#4b5563" }} axisLine={false} tickLine={false} width={36} />
                {tooltip}
                <Bar
                  dataKey="diesel"
                  stackId="f"
                  fill={DIESEL}
                  stroke={SURFACE}
                  strokeWidth={1}
                  maxBarSize={64}
                />
                <Bar
                  dataKey="gasoline"
                  stackId="f"
                  fill={GASOLINE}
                  stroke={SURFACE}
                  strokeWidth={1}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={64}
                >
                  {totalLabel("top")}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
