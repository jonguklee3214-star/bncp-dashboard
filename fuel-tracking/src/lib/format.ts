// 현장(Asia/Baghdad) 기준 날짜/시간 처리 (항목 75). PC/Mobile timezone 이 달라도 일관.
const TZ = "Asia/Baghdad";

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** 125430 → "125,430 km" */
export function formatKm(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${formatNumber(n)} km`;
}

/** 소수 허용 주유량 → "80 L" / "82.75 L" */
export function formatL(n: number): string {
  const s = Number.isInteger(n) ? String(n) : String(n);
  return `${s} L`;
}

/** ISO → "01 Sep 2026  08:42" (현장 시간) */
export function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date}  ${time}`;
}

/** ISO → "Sep 01" */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "short" });
}

/** 현장 기준 오늘의 YYYY-MM-DD */
export function siteToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // en-CA = YYYY-MM-DD
}

/** 현장 기준 datetime-local 초기값 (YYYY-MM-DDTHH:mm) */
export function siteNowLocalInput(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
