"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Weather {
  available: boolean;
  location: string;
  temperature?: number;
  condition?: string;
}

// 최상단 실제 날씨 (항목 7). 실패 시 "Weather unavailable".
export function WeatherBar({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [w, setW] = useState<Weather | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => alive && setW(d))
      .catch(() => alive && setW({ available: false, location: "" }));
    return () => {
      alive = false;
    };
  }, []);

  if (!w) return <span className="text-sm text-gray-400">···</span>;
  if (!w.available) {
    return <span className="text-sm text-gray-400">{t("common.weatherUnavailable")}</span>;
  }
  return (
    <div className={`flex items-center gap-2 ${compact ? "text-sm" : ""}`}>
      <span className="text-hanwha">☀</span>
      <span className="font-medium">{w.location}</span>
      <span className="tabular font-bold">{w.temperature}°C</span>
      {!compact && <span className="text-gray-500">{w.condition}</span>}
    </div>
  );
}
