"use client";

import { useState } from "react";
import Link from "next/link";
import { LANGS, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useAdmin } from "@/lib/useAdmin";
import { Card, SectionTitle } from "@/components/ui";

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { refresh } = useStore();
  const { isAdmin, pin, unlock, lock } = useAdmin();
  const [initState, setInitState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [initMsg, setInitMsg] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState("");

  // 관리자 잠금 해제 (시트 초기화 같은 위험한 작업은 관리자만)
  async function tryUnlock() {
    setPinErr("");
    const r = await unlock(pinInput);
    if (r.ok) setPinInput("");
    else setPinErr(r.message || t("admin.wrongPin"));
  }

  async function initSheet() {
    if (!pin) return;
    setInitState("running");
    setInitMsg("");
    try {
      const res = await fetch("/api/init", {
        method: "POST",
        headers: { "x-admin-pin": pin },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "init failed");
      setInitState("done");
      setInitMsg(`OK — Vehicle_Master: ${data.vehicles}`);
      await refresh();
    } catch (e) {
      setInitState("error");
      setInitMsg(e instanceof Error ? e.message : "error");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">{t("settings.title")}</h1>

      <Link href="/help" className="block">
        <Card className="flex items-center justify-between p-4 hover:border-hanwha">
          <span className="font-bold text-gray-800">❓ {t("nav.help")}</span>
          <span className="text-gray-400">›</span>
        </Card>
      </Link>

      <Card className="p-4">
        <SectionTitle>{t("settings.language")}</SectionTitle>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`rounded-lg border px-4 py-2 text-sm ${
                lang === l.code ? "border-hanwha bg-hanwha text-white" : "border-neutral-border bg-white"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionTitle>{t("settings.initSheet")}</SectionTitle>
          {isAdmin && (
            <button onClick={lock} className="text-xs font-medium text-hanwha">
              🔓 {t("admin.unlocked")}
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-gray-500">
          Google Sheet 에 헤더와 초기 차량/장비 데이터를 심습니다. (이미 데이터가 있으면 보존)
        </p>

        {isAdmin ? (
          <button
            onClick={initSheet}
            disabled={initState === "running"}
            className="rounded-lg bg-hanwha px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {initState === "running" ? "..." : t("settings.initSheet")}
          </button>
        ) : (
          <div>
            <p className="mb-2 text-xs text-gray-500">🔒 {t("admin.adminOnly")}</p>
            <div className="flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
                placeholder={t("admin.enterPin")}
                className="w-40 rounded-lg border border-neutral-border px-3 py-2 text-sm outline-none focus:border-hanwha"
              />
              <button
                onClick={tryUnlock}
                className="rounded-lg border border-hanwha px-3 py-2 text-sm font-bold text-hanwha"
              >
                {t("admin.unlock")}
              </button>
            </div>
            {pinErr && <p className="mt-2 text-sm text-danger">{pinErr}</p>}
          </div>
        )}

        {initMsg && (
          <p className={`mt-2 text-sm ${initState === "error" ? "text-danger" : "text-success"}`}>
            {initMsg}
          </p>
        )}
      </Card>
    </div>
  );
}
