"use client";

import { useState } from "react";
import { LANGS, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Card, SectionTitle } from "@/components/ui";

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { refresh } = useStore();
  const [initState, setInitState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [initMsg, setInitMsg] = useState("");

  async function initSheet() {
    setInitState("running");
    setInitMsg("");
    try {
      const res = await fetch("/api/init", { method: "POST" });
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
        <SectionTitle>{t("settings.initSheet")}</SectionTitle>
        <p className="mb-3 text-sm text-gray-500">
          Google Sheet 에 헤더와 초기 차량/장비 데이터를 심습니다. (이미 데이터가 있으면 보존)
        </p>
        <button
          onClick={initSheet}
          disabled={initState === "running"}
          className="rounded-lg bg-hanwha px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {initState === "running" ? "..." : t("settings.initSheet")}
        </button>
        {initMsg && (
          <p className={`mt-2 text-sm ${initState === "error" ? "text-danger" : "text-success"}`}>
            {initMsg}
          </p>
        )}
      </Card>
    </div>
  );
}
