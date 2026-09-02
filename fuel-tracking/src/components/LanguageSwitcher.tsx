"use client";

import { LANGS, useI18n } from "@/lib/i18n";

// 언어 선택인 걸 누구나 알 수 있게 지구본 아이콘 + 현재 언어명 표시.
export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-neutral-border bg-white pl-2.5 pr-1">
      <span aria-hidden className="text-base leading-none">🌐</span>
      <select
        aria-label="Language / 언어 / ভাষা"
        value={lang}
        onChange={(e) => setLang(e.target.value as never)}
        className="cursor-pointer border-0 bg-transparent py-1.5 pr-1 text-sm font-medium outline-none focus:ring-0"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
