import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 실제 Weather API (Open-Meteo, 무료·키 불필요). 실패 시 unavailable (항목 7).
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

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("weather api error");
    const data = await res.json();
    const temp = Math.round(data?.current?.temperature_2m);
    const code = data?.current?.weather_code;
    if (!Number.isFinite(temp)) throw new Error("no temp");
    return NextResponse.json({
      available: true,
      location: name,
      temperature: temp,
      condition: WMO[code] ?? "—",
    });
  } catch {
    // 임의의 값을 표시하지 않는다 (항목 7)
    return NextResponse.json({ available: false, location: name });
  }
}
