"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { weatherEmoji } from "@/lib/weatherIcons";
import { Card } from "./ui";

interface Daily {
  date: string;
  code: number;
  tmax: number;
  tmin: number;
  precipProb: number | null;
  wind: number;
}
interface Weather {
  available: boolean;
  location: string;
  current?: { temp: number; code: number; condition: string; wind: number; precip: number; humidity: number | null };
  daily?: Daily[];
}

const LOCALE: Record<string, string> = { ko: "ko-KR", en: "en-GB", bn: "bn-BD" };

export function WeatherWidget() {
  const { t, lang } = useI18n();
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

  if (!w) return <Card className="h-[84px] animate-pulse bg-neutral-soft" />;
  if (!w.available || !w.current) {
    return (
      <Card className="flex h-[64px] items-center justify-center text-sm text-gray-500">
        {t("common.weatherUnavailable")}
      </Card>
    );
  }

  const dow = (iso: string, i: number) =>
    i === 0
      ? t("weather.now")
      : new Date(iso + "T00:00:00").toLocaleDateString(LOCALE[lang] ?? "en-GB", { weekday: "short" });

  return (
    <Card className="flex items-stretch gap-3 overflow-x-auto p-3">
      {/* 현재 날씨 — 컴팩트 */}
      <div className="flex shrink-0 items-center gap-2.5 border-r border-neutral-border pr-3">
        <span className="text-3xl leading-none">{weatherEmoji(w.current.code)}</span>
        <div>
          <div className="text-[11px] font-medium text-gray-600">📍 {w.location}</div>
          <div className="flex items-baseline gap-1">
            <span className="tabular text-2xl font-bold text-gray-900">{w.current.temp}°</span>
            <span className="text-xs text-gray-600">{w.current.condition}</span>
          </div>
          <div className="flex gap-2 text-[10px] text-gray-500">
            <span>💨 {w.current.wind}</span>
            {w.current.humidity != null && <span>💧 {w.current.humidity}%</span>}
          </div>
        </div>
      </div>

      {/* 7일 예보 — 한 줄 */}
      <div className="flex flex-1 items-center justify-between gap-1">
        {(w.daily ?? []).map((d, i) => (
          <div
            key={d.date}
            className="flex min-w-[42px] flex-col items-center rounded-md px-1 py-0.5 text-center"
            style={{ background: i === 0 ? "rgba(243,115,33,0.08)" : "transparent" }}
          >
            <span className="text-[11px] font-semibold text-gray-700">{dow(d.date, i)}</span>
            <span className="text-base leading-tight">{weatherEmoji(d.code)}</span>
            <span className="tabular text-[11px] font-bold text-gray-900">
              {d.tmax}° <span className="font-normal text-gray-500">{d.tmin}°</span>
            </span>
            {d.precipProb != null && d.precipProb > 0 && (
              <span className="tabular text-[10px] font-medium text-blue-600">💧{d.precipProb}%</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
