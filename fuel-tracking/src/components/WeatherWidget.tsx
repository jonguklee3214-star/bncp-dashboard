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

// 헤더에서 '오늘'과 '주간'을 따로 그리므로 요청이 두 번 나가지 않게 공유한다.
let weatherPromise: Promise<Weather> | null = null;
function loadWeather(): Promise<Weather> {
  weatherPromise ??= fetch("/api/weather")
    .then((r) => r.json())
    .catch(() => ({ available: false, location: "" }) as Weather);
  return weatherPromise;
}

/**
 * 날씨 표시.
 *  - variant="bar"  : 헤더용 한 줄 (오늘 + 주간 예보)
 *  - variant="now"  : 오늘 날씨만 (모바일 제목 옆)
 *  - variant="days" : 주간 예보만 (모바일 아랫줄)
 *  - variant="card" : 카드형
 */
export function WeatherWidget({
  variant = "card",
}: {
  /** card=카드형 · bar=한 줄 전체 · now=오늘만 · days=주간 예보만 */
  variant?: "card" | "bar" | "now" | "days";
}) {
  const { t, lang } = useI18n();
  const [w, setW] = useState<Weather | null>(null);
  const bar = variant === "bar" || variant === "now" || variant === "days";

  useEffect(() => {
    let alive = true;
    void loadWeather().then((d) => alive && setW(d));
    return () => {
      alive = false;
    };
  }, []);

  if (!w) {
    return bar ? (
      <div className="h-[42px] w-full max-w-[520px] animate-pulse rounded-md bg-neutral-soft" />
    ) : (
      <Card className="h-[84px] animate-pulse bg-neutral-soft" />
    );
  }

  if (!w.available || !w.current) {
    return bar ? (
      <span className="text-xs text-gray-500">{t("common.weatherUnavailable")}</span>
    ) : (
      <Card className="flex h-[64px] items-center justify-center text-sm text-gray-500">
        {t("common.weatherUnavailable")}
      </Card>
    );
  }

  const dow = (iso: string, i: number) =>
    i === 0
      ? t("weather.now")
      : new Date(iso + "T00:00:00").toLocaleDateString(LOCALE[lang] ?? "en-GB", { weekday: "short" });

  // ── 헤더 고정용 한 줄 ──
  if (bar) {
    const today = w.daily?.[0];
    const now = (
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-xl leading-none">{weatherEmoji(w.current.code)}</span>
        <span className="tabular text-lg font-bold leading-none text-gray-900">{w.current.temp}°</span>
        <div className="leading-tight">
          <div className="flex gap-1 text-[10px] font-semibold text-gray-700">
            <span>📍 {w.location}</span>
            {today && (
              <span className="tabular text-gray-600">
                {today.tmax}°/{today.tmin}°
              </span>
            )}
          </div>
          <div className="flex gap-1.5 text-[10px] text-gray-600">
            <span>💨 {w.current.wind}</span>
            {w.current.humidity != null && <span>💧 {w.current.humidity}%</span>}
          </div>
        </div>
      </div>
    );

    if (variant === "now") return now;

    const days = (
      <div className="flex items-center gap-0.5">
        {(w.daily ?? []).map((d, i) => (
          <div
            key={d.date}
            className="flex w-[40px] shrink-0 flex-col items-center rounded px-0.5 leading-tight"
            style={{ background: i === 0 ? "rgba(243,115,33,0.08)" : "transparent" }}
          >
            <span className="text-[10px] font-semibold text-gray-700">{dow(d.date, i)}</span>
            <span className="text-[13px] leading-none">{weatherEmoji(d.code)}</span>
            <span className="tabular text-[10px] font-bold text-gray-900">
              {d.tmax}°<span className="font-normal text-gray-500">/{d.tmin}°</span>
            </span>
            <span className="tabular h-[11px] text-[9px] font-medium text-blue-600">
              {d.precipProb ? `💧${d.precipProb}%` : ""}
            </span>
          </div>
        ))}
      </div>
    );

    if (variant === "days") return <div className="overflow-x-auto">{days}</div>;

    return (
      <div className="flex items-center gap-2 overflow-x-auto">
        {now}
        <div className="h-8 w-px shrink-0 bg-neutral-border" />
        <div className="shrink-0">{days}</div>
      </div>
    );
  }

  // ── 카드형 (기존) ──
  return (
    <Card className="flex items-stretch gap-3 overflow-x-auto p-3">
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
