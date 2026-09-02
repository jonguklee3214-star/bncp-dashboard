"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import ko from "@/locales/ko.json";
import en from "@/locales/en.json";
import bn from "@/locales/bn.json";

// 언어 혼용 금지 (항목 10): 선택 언어 하나로 전체 UI 를 표시한다.
export type Lang = "ko" | "en" | "bn";

const DICTS: Record<Lang, unknown> = { ko, en, bn };
const STORAGE_KEY = "fts.lang";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা" },
];

function lookup(dict: unknown, path: string): string {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  // 마지막 선택 언어 복원 (항목 80)
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Lang | null;
    if (saved && (["ko", "en", "bn"] as Lang[]).includes(saved)) {
      setLangState(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage 접근 불가 시 무시 */
    }
  }, []);

  const t = useCallback((key: string) => lookup(DICTS[lang], key), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
