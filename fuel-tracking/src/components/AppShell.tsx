"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { DemoBanner } from "./DemoBanner";
import { WeatherWidget } from "./WeatherWidget";

interface NavItem {
  href: string;
  key: string;
  mobileKey?: string; // 하단 네비 짧은 라벨
  icon: string;
}

const NAV: NavItem[] = [
  { href: "/", key: "nav.dashboard", mobileKey: "nav.dashboard", icon: "▤" },
  { href: "/entry", key: "nav.fuelEntry", mobileKey: "nav.fuel", icon: "⛽" },
  { href: "/history", key: "nav.fuelHistory", mobileKey: "nav.history", icon: "≣" },
  { href: "/reports", key: "nav.reports", icon: "📄" },
  { href: "/vehicles", key: "nav.vehicles", icon: "🚚" },
  { href: "/help", key: "nav.help", icon: "❓" },
  { href: "/settings", key: "nav.settings", mobileKey: "nav.more", icon: "⚙" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  // 한국어일 때만 국문 로고, 그 외(영어·벵골어)는 영문 로고로 통일
  const logo = lang === "ko" ? "/img/hanwha-ec-ko.png" : "/img/hanwha-ec-en.png";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-screen">
      {/* ── Desktop sidebar ── */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-neutral-border bg-white md:flex">
        <div className="flex flex-col items-center gap-1.5 px-5 py-4">
          <Image src={logo} alt="Hanwha E&C" width={150} height={33} priority className="h-8 w-auto" />
          <span className="text-sm font-bold text-gray-800">{t("appTeam")}</span>
        </div>
        <nav className="flex-1 px-3 py-4">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive(n.href)
                  ? "bg-hanwha/10 font-bold text-hanwha"
                  : "text-gray-800 hover:bg-neutral-soft"
              }`}
            >
              <span className="w-5 text-center">{n.icon}</span>
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-border p-3 text-xs text-gray-400">
          Fuel Tracking System
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="md:ml-60">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-20 border-b border-neutral-border bg-white/90 backdrop-blur">
          {/* 유류 절약 캠페인 문구 (항목 8) */}
          <div className="flex items-center justify-center gap-2 bg-hanwha px-4 py-2 font-bold text-white">
            <span className="text-base leading-none">⛽</span>
            <span className="text-[13px] sm:text-[15px]">{t("campaign")}</span>
          </div>
          <DemoBanner />
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            {/* mobile logo + 팀명 */}
            <div className="flex flex-col md:hidden">
              <Image src={logo} alt="Hanwha E&C" width={140} height={30} className="h-6 w-auto" />
              <span className="mt-0.5 text-[11px] font-bold text-gray-800">{t("appTeam")}</span>
            </div>
            <div className="hidden text-sm text-gray-400 md:block">{t("appSubtitle")}</div>
            <LanguageSwitcher />
          </div>
        </header>

        {/* Content — 날씨는 모든 페이지 상단 고정 (항목 7) */}
        <main className="print-full px-4 pb-24 pt-4 md:px-8 md:pb-10">
          <div className="no-print mb-4">
            <WeatherWidget />
          </div>
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation (항목 6) ── */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex border-t border-neutral-border bg-white md:hidden">
        {NAV.filter((n) => n.mobileKey).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
              isActive(n.href) ? "text-hanwha" : "text-gray-500"
            }`}
          >
            <span className="text-lg leading-none">{n.icon}</span>
            {t(n.mobileKey as string)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
