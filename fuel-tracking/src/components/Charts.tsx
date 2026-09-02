"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Bucket } from "@/lib/stats";
import { Card } from "./ui";

const HANWHA = "#F37321";
const HANWHA_50 = "#FBB584";

// 정보 전달 우선의 절제된 업무용 차트 (항목 74)
export function BucketBarChart({
  title,
  data,
  metric,
  labelFormatter,
  horizontal = false,
}: {
  title: string;
  data: Bucket[];
  metric: "volume" | "count";
  labelFormatter?: (key: string) => string;
  horizontal?: boolean;
}) {
  const rows = data.map((d) => ({
    ...d,
    label: labelFormatter ? labelFormatter(d.key) : d.key,
    value: d[metric],
  }));

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-bold text-gray-700">{title}</h3>
      <div style={{ width: "100%", height: horizontal ? Math.max(160, rows.length * 34) : 220 }}>
        <ResponsiveContainer>
          {horizontal ? (
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="#EEE" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <Tooltip cursor={{ fill: "#F7F8FA" }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? HANWHA : HANWHA_50} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={rows} margin={{ left: -12, right: 8 }}>
              <CartesianGrid vertical={false} stroke="#EEE" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "#F7F8FA" }} />
              <Bar dataKey="value" fill={HANWHA} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
