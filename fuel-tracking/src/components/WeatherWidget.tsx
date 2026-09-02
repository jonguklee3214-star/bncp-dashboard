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

  if (!w) {
    return <Card className="h-[132px] animate-pulse bg-neutral-soft" />;
  }
  if (!w.available || !w.current) {
    return (
      <Card className="flex h-[132px] items-center justify-center text-sm text-gray-400">
        {t("common.weatherUnavailable")}
      </Card>
    );
  }

  const dow = (iso: string, i: number) =>
    i === 0
      ? t("weather.now")
      : new Date(iso + "T00:00:00").toLocaleDateString(LOCALE[lang] ?? "en-GB", { weekday: "short" });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        {/* 현재 날씨 */}
        <div className="flex items-center gap-4 sm:w-64 sm:border-r sm:border-neutral-border sm:pr-4">
          <div className="text-5xl leading-none">{weatherEmoji(w.current.code)}</div>
          <div>
            <div className="text-xs text-gray-500">📍 {w.location}</div>
            <div className="flex items-baseline gap-1">
              <span className="tabular text-4xl font-bold text-gray-900">{w.current.temp}°</span>
              <span className="text-sm text-gray-500">{w.current.condition}</span>
            </div>
            <div className="mt-1 flex gap-3 text-[11px] text-gray-500">
              <span>💨 {w.current.wind}km/h</span>
              {w.current.humidity != null && <span>💧 {w.current.humidity}%</span>}
            </div>
          </div>
        </div>

        {/* 7일 예보 */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 text-xs font-bold text-gray-500">{t("weather.forecast")}</div>
          <div className="grid grid-cols-7 gap-1">
            {(w.daily ?? []).map((d, i) => (
              <div
                key={d.date}
                className="flex flex-col items-center rounded-lg py-1.5 text-center"
                style={{ background: i === 0 ? "rgba(243,115,33,0.08)" : "transparent" }}
              >
                <span className="text-[11px] font-medium text-gray-600">{dow(d.date, i)}</span>
                <span className="my-0.5 text-lg leading-none">{weatherEmoji(d.code)}</span>
                <span className="tabular text-[11px] font-bold text-gray-800">{d.tmax}°</span>
                <span className="tabular text-[10px] text-gray-400">{d.tmin}°</span>
                {d.precipProb != null && d.precipProb > 0 && (
                  <span className="tabular text-[10px] text-blue-500">💧{d.precipProb}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
