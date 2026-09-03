"use client";

import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { FuelEntryForm } from "@/components/FuelEntryForm";

export default function HomePage() {
  const { t } = useI18n();
  const { loading, error } = useStore();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t("entry.title")}</h1>
      {loading && <p className="text-sm text-gray-400">{t("common.loading")}</p>}
      {error && (
        <p className="mb-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}
      {!loading && <FuelEntryForm />}
    </div>
  );
}
