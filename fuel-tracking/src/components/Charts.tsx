"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Bucket } from "@/lib/stats";
import { Card } from "./ui";

const HANWHA = "#F37321";
const HANWHA_50 = "#FBB584";

interface Row extends Bucket {
  label: string;
  value: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

// 정보 전달 우선의 절제된 업무용 차트 (항목 74). 값 라벨을 직접 표시해 한눈에 파악.
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
  const rows: Row[] = data.map((d) => ({
    ...d,
    label: labelFormatter ? labelFormatter(d.key) : d.key,
    value: d[metric],
  }));

  const suffix = unit ? ` ${unit}` : "";
  const empty = rows.length === 0 || rows.every((r) => r.value === 0);

  const tooltip = (
    <Tooltip
      cursor={{ fill: "rgba(243,115,33,0.06)" }}
      contentStyle={{
        borderRadius: 10,
        border: "1px solid #E5E7EB",
        fontSize: 12,
        boxShadow: "0 4px 16px -6px rgba(0,0,0,.15)",
      }}
      formatter={(v: number) => [`${fmt(v)}${suffix}`, ""]}
      labelStyle={{ color: "#6b7280", fontWeight: 600 }}
      separator=""
    />
  );

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-gray-700">{title}</h3>
        {unit && <span className="text-[11px] text-gray-400">단위: {unit}</span>}
      </div>

      {empty ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-300">
          데이터 없음
        </div>
      ) : (
        <div style={{ width: "100%", height: horizontal ? Math.max(150, rows.length * 40) : 230 }}>
          <ResponsiveContainer>
            {horizontal ? (
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#F0F0F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
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
                <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={22}>
                  {rows.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? HANWHA : HANWHA_50} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(v: number) => `${fmt(v)}${suffix}`}
                    style={{ fontSize: 11, fill: "#6b7280", fontWeight: 600 }}
                  />
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
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={36} />
                {tooltip}
                <Bar dataKey="value" fill={HANWHA} radius={[6, 6, 0, 0]} maxBarSize={64}>
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(v: number) => `${fmt(v)}${suffix}`}
                    style={{ fontSize: 12, fill: "#111827", fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
