import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 실제 Weather API (Open-Meteo, 무료·키 불필요). 현재 + 7일 예보. 실패 시 unavailable (항목 7).
const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mainly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Dense Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  80: "Rain Showers",
  81: "Rain Showers",
  82: "Violent Showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

export async function GET() {
  const name = process.env.WEATHER_LOCATION_NAME || "Baghdad";
  const lat = process.env.WEATHER_LATITUDE || "33.3152";
  const lon = process.env.WEATHER_LONGITUDE || "44.3661";
  const tz = process.env.SITE_TIMEZONE || "Asia/Baghdad";

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
      `&forecast_days=7&timezone=${encodeURIComponent(tz)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("weather api error");
    const d = await res.json();
    const temp = Math.round(d?.current?.temperature_2m);
    const code = d?.current?.weather_code;
    if (!Number.isFinite(temp)) throw new Error("no temp");

    const daily = (d?.daily?.time ?? []).map((date: string, i: number) => ({
      date,
      code: d.daily.weather_code[i],
      tmax: Math.round(d.daily.temperature_2m_max[i]),
      tmin: Math.round(d.daily.temperature_2m_min[i]),
      precipProb: d.daily.precipitation_probability_max?.[i] ?? null,
      wind: Math.round(d.daily.wind_speed_10m_max?.[i] ?? 0),
    }));

    return NextResponse.json({
      available: true,
      location: name,
      current: {
        temp,
        code,
        condition: WMO[code] ?? "—",
        wind: Math.round(d?.current?.wind_speed_10m ?? 0),
        precip: d?.current?.precipitation ?? 0,
        humidity: d?.current?.relative_humidity_2m ?? null,
      },
      daily,
      // 하위호환 (상단바 compact 표시용)
      temperature: temp,
      condition: WMO[code] ?? "—",
    });
  } catch {
    return NextResponse.json({ available: false, location: name });
  }
}
