"use client";

import { useEffect, useMemo, useState } from "react";
import type { FuelType, Vehicle } from "@/types";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { formatKm, formatNumber, siteNowLocalInput } from "@/lib/format";
import { SearchableSelect, type Option } from "./SearchableSelect";
import { Card, ReadonlyField } from "./ui";

type SaveState = "idle" | "saving" | "success" | "error";

export function FuelEntryForm() {
  const { t } = useI18n();
  const { vehicles, refresh } = useStore();

  // 1) 제일 먼저 유종 선택 (사용자 결정)
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [datetime, setDatetime] = useState("");
  const [currentMileage, setCurrentMileage] = useState("");
  const [fuelVolume, setFuelVolume] = useState("");
  const [remarks, setRemarks] = useState("");
  const [previousMileage, setPreviousMileage] = useState<number | null>(null);
  const [allowException, setAllowException] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => setDatetime(siteNowLocalInput()), []);

  // 선택 유종에 해당하는 차량/장비만 (active 만, 항목 63)
  const pool = useMemo(
    () => vehicles.filter((v) => v.fuelType === fuelType && v.status === "active"),
    [vehicles, fuelType],
  );

  const options: Option[] = useMemo(
    () =>
      pool.map((v) =>
        fuelType === "gasoline"
          ? { value: v.vehicleId, label: v.mainVehicleNo, sub: `${v.controlNo} · ${v.driverIds.join(" / ")}` }
          : { value: v.vehicleId, label: `${v.controlNo} · ${v.equipmentName}`, sub: v.capacity },
      ),
    [pool, fuelType],
  );

  const vehicle: Vehicle | undefined = pool.find((v) => v.vehicleId === vehicleId);

  // 가솔린: 선택 시 previous mileage 자동 조회 (항목 32)
  useEffect(() => {
    setPreviousMileage(null);
    setAllowException(false);
    if (fuelType === "gasoline" && vehicle) {
      fetch(`/api/previous-mileage?mainVehicleNo=${encodeURIComponent(vehicle.mainVehicleNo)}`)
        .then((r) => r.json())
        .then((d) => setPreviousMileage(d.previousMileageKm ?? null))
        .catch(() => setPreviousMileage(null));
    }
  }, [fuelType, vehicle]);

  const distance =
    fuelType === "gasoline" && previousMileage != null && currentMileage !== ""
      ? Number(currentMileage) - previousMileage
      : null;

  const mileageLow =
    fuelType === "gasoline" &&
    previousMileage != null &&
    currentMileage !== "" &&
    Number(currentMileage) < previousMileage;

  function resetAfterSave() {
    setVehicleId("");
    setCurrentMileage("");
    setFuelVolume("");
    setRemarks("");
    setPreviousMileage(null);
    setAllowException(false);
    setDatetime(siteNowLocalInput());
  }

  async function onSubmit() {
    if (save === "saving") return; // 중복 저장 방지 (항목 55)
    const volume = Number(fuelVolume);
    if (!vehicle || !volume || volume <= 0) {
      setSave("error");
      setMsg(t("common.saveFail"));
      return;
    }
    if (mileageLow && !allowException) return;

    setSave("saving");
    setMsg("");
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          fuelType,
          mainVehicleNo: vehicle.mainVehicleNo,
          controlNo: vehicle.controlNo,
          currentMileage:
            fuelType === "gasoline" && currentMileage !== "" ? Number(currentMileage) : null,
          fuelVolume: volume,
          remarks,
          fuelDatetime: datetime ? new Date(datetime).toISOString() : undefined,
          allowMileageException: allowException,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "save failed");
      setSave("success");
      setMsg(t("common.saveSuccess"));
      resetAfterSave();
      await refresh(); // 실시간 반영 (항목 54)
      setTimeout(() => setSave("idle"), 2500);
    } catch {
      setSave("error");
      setMsg(t("common.saveFail"));
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Step 1 — 유종 */}
      <Card className="p-4">
        <div className="mb-2 text-xs text-gray-500">{t("fuelType.label")}</div>
        <div className="grid grid-cols-2 gap-3">
          {(["diesel", "gasoline"] as FuelType[]).map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => {
                setFuelType(ft);
                setVehicleId("");
              }}
              className={`rounded-lg border px-4 py-4 text-center font-bold transition ${
                fuelType === ft
                  ? "border-hanwha bg-hanwha text-white"
                  : "border-neutral-border bg-white text-gray-700 hover:border-hanwha"
              }`}
            >
              {t(`fuelType.${ft}`)}
            </button>
          ))}
        </div>
      </Card>

      {!fuelType && (
        <p className="py-6 text-center text-sm text-gray-400">{t("fuelType.selectPrompt")}</p>
      )}

      {/* Step 2 — 차량/장비 + 입력 */}
      {fuelType && (
        <>
          <Card className="p-4">
            <div className="mb-2 text-xs text-gray-500">
              {fuelType === "gasoline" ? t("entry.mainVehicleNo") : t("entry.controlNo")}
            </div>
            <SearchableSelect
              options={options}
              value={vehicleId}
              onChange={setVehicleId}
              placeholder={fuelType === "gasoline" ? t("entry.selectVehicle") : t("entry.selectEquipment")}
              searchPlaceholder={
                fuelType === "gasoline" ? t("entry.searchVehicle") : t("entry.searchEquipment")
              }
            />

            {/* 자동표시 상세 (항목 14·17·29) */}
            {vehicle && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-border pt-4 sm:grid-cols-3">
                <ReadonlyField label={t("entry.controlNo")} value={vehicle.controlNo} />
                {fuelType === "gasoline" ? (
                  <ReadonlyField label={t("entry.driver")} value={vehicle.driverIds.join(" / ")} />
                ) : (
                  <ReadonlyField label={t("entry.capacity")} value={vehicle.capacity} />
                )}
                <ReadonlyField label={t("entry.team")} value={vehicle.team} />
                {fuelType === "gasoline" ? (
                  <ReadonlyField label={t("entry.part")} value={vehicle.part} />
                ) : (
                  <ReadonlyField label={t("entry.teamCode")} value={vehicle.teamCode} />
                )}
                <ReadonlyField
                  label={t("entry.vehicleType")}
                  value={fuelType === "gasoline" ? vehicle.vehicleType : vehicle.equipmentName}
                />
                <ReadonlyField label={t("entry.company")} value={vehicle.company} />
              </div>
            )}
          </Card>

          {vehicle && (
            <Card className="space-y-4 p-4">
              {/* 주유 일시 */}
              <label className="block">
                <span className="text-xs text-gray-500">{t("entry.fuelDatetime")}</span>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-border px-3 py-2.5 outline-none focus:border-hanwha"
                />
              </label>

              {/* 가솔린 전용 주행거리 */}
              {fuelType === "gasoline" && (
                <div className="grid grid-cols-2 gap-3">
                  <ReadonlyField
                    label={t("entry.previousMileage")}
                    value={formatKm(previousMileage)}
                  />
                  <label className="block">
                    <span className="text-xs text-gray-500">{t("entry.currentMileage")}</span>
                    <input
                      inputMode="decimal"
                      value={currentMileage}
                      onChange={(e) => setCurrentMileage(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="125850"
                      className="mt-1 w-full rounded-lg border border-neutral-border px-3 py-2.5 outline-none focus:border-hanwha"
                    />
                  </label>
                  <ReadonlyField
                    label={t("entry.distance")}
                    value={distance != null ? formatKm(distance) : "—"}
                  />
                </div>
              )}

              {mileageLow && (
                <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning">
                  ⚠ {t("entry.mileageWarning")}
                  <label className="mt-2 flex items-center gap-2 text-gray-700">
                    <input
                      type="checkbox"
                      checked={allowException}
                      onChange={(e) => setAllowException(e.target.checked)}
                    />
                    {t("entry.mileageException")}
                  </label>
                </div>
              )}

              {/* 주유량 (필수) */}
              <label className="block">
                <span className="text-xs text-gray-500">
                  {t("entry.fuelVolume")} ({t("units.l")})
                </span>
                <input
                  inputMode="decimal"
                  value={fuelVolume}
                  onChange={(e) => setFuelVolume(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="80"
                  className="mt-1 w-full rounded-lg border border-neutral-border px-3 py-3 text-lg font-bold outline-none focus:border-hanwha"
                />
              </label>

              {/* 비고 */}
              <label className="block">
                <span className="text-xs text-gray-500">{t("entry.remarks")}</span>
                <input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-border px-3 py-2.5 outline-none focus:border-hanwha"
                />
              </label>

              {msg && (
                <p
                  className={`text-sm ${save === "success" ? "text-success" : "text-danger"}`}
                >
                  {msg}
                </p>
              )}

              <button
                type="button"
                disabled={save === "saving" || !fuelVolume || (mileageLow && !allowException)}
                onClick={onSubmit}
                className="w-full rounded-lg bg-hanwha py-3.5 text-lg font-bold text-white transition hover:bg-hanwha/90 disabled:opacity-50"
              >
                {save === "saving" ? t("common.saving") : t("common.save")}
              </button>
              {currentMileage && (
                <p className="text-center text-xs text-gray-400">
                  {formatNumber(Number(currentMileage))} km
                </p>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
