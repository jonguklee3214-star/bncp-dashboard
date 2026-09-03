"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { weatherEmoji } from "@/lib/weatherIcons";

interface Weather {
  available: boolean;
  location: string;
  current?: { temp: number; code: number; condition: string; wind: number };
}

// 상단바 현재 날씨 (항목 7). onDark=주황 배너 위 흰 글씨.
export function WeatherBar({ onDark = false }: { onDark?: boolean }) {
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

  const muted = onDark ? "text-white/80" : "text-gray-500";
  const strong = onDark ? "text-white" : "text-gray-900";

  if (!w) return <span className={`text-sm ${muted}`}>···</span>;
  if (!w.available || !w.current) {
    return <span className={`text-xs ${muted}`}>{t("common.weatherUnavailable")}</span>;
  }
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span>{weatherEmoji(w.current.code)}</span>
      <span className={`font-medium ${strong}`}>{w.location}</span>
      <span className={`tabular font-bold ${strong}`}>{w.current.temp}°C</span>
      <span className={`hidden sm:inline ${muted}`}>{w.current.condition}</span>
    </div>
  );
}
