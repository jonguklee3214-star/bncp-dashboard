"use client";

import { useEffect, useMemo, useState } from "react";
import type { FuelType, Vehicle } from "@/types";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { formatKm, formatNumber, siteNowLocalInput } from "@/lib/format";
import { SearchableSelect, type Option } from "./SearchableSelect";
import { Card, ReadonlyField } from "./ui";

type SaveState = "idle" | "saving" | "success" | "error";
const MISC = "__misc__";

export function FuelEntryForm() {
  const { t } = useI18n();
  const { vehicles, refresh } = useStore();

  // 1) 제일 먼저 유종 선택
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [datetime, setDatetime] = useState("");
  const [currentMileage, setCurrentMileage] = useState("");
  const [fuelVolume, setFuelVolume] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reason, setReason] = useState(""); // 말통 급유 사유
  const [previousMileage, setPreviousMileage] = useState<number | null>(null);
  const [allowException, setAllowException] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => setDatetime(siteNowLocalInput()), []);

  const pool = useMemo(
    () => vehicles.filter((v) => v.fuelType === fuelType && v.status === "active"),
    [vehicles, fuelType],
  );

  // 맨 위에 "기타·말통 급유" 옵션 + 차량/장비 목록
  const options: Option[] = useMemo(() => {
    const misc: Option = { value: MISC, label: `⛱ ${t("entry.misc")}`, sub: t("entry.miscSub") };
    const list = pool.map((v) =>
      fuelType === "gasoline"
        ? { value: v.vehicleId, label: v.mainVehicleNo, sub: `${v.controlNo} · ${v.driverIds.join(" / ")}` }
        : { value: v.vehicleId, label: `${v.controlNo} · ${v.equipmentName}`, sub: v.capacity },
    );
    return [misc, ...list];
  }, [pool, fuelType, t]);

  const isMisc = vehicleId === MISC;
  const vehicle: Vehicle | undefined = pool.find((v) => v.vehicleId === vehicleId);
  const tracksMileage = !!vehicle?.tracksMileage;

  // 주행거리 관리 대상만 previous mileage 자동 조회 (CONTROL N° 기준, 항목 32)
  useEffect(() => {
    setPreviousMileage(null);
    setAllowException(false);
    if (vehicle && vehicle.tracksMileage && vehicle.controlNo) {
      fetch(`/api/previous-mileage?controlNo=${encodeURIComponent(vehicle.controlNo)}`)
        .then((r) => r.json())
        .then((d) => setPreviousMileage(d.previousMileageKm ?? null))
        .catch(() => setPreviousMileage(null));
    }
  }, [vehicle]);

  const distance =
    tracksMileage && previousMileage != null && currentMileage !== ""
      ? Number(currentMileage) - previousMileage
      : null;

  const mileageLow =
    tracksMileage &&
    previousMileage != null &&
    currentMileage !== "" &&
    Number(currentMileage) < previousMileage;

  function resetAfterSave() {
    setVehicleId("");
    setCurrentMileage("");
    setFuelVolume("");
    setRemarks("");
    setReason("");
    setPreviousMileage(null);
    setAllowException(false);
    setDatetime(siteNowLocalInput());
  }

  const newRecordId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  async function onSubmit() {
    if (save === "saving") return; // 중복 저장 방지 (항목 55)
    const volume = Number(fuelVolume);
    if (!volume || volume <= 0) {
      setSave("error");
      setMsg(t("common.saveFail"));
      return;
    }
    if (isMisc && !reason.trim()) {
      setSave("error");
      setMsg(t("common.saveFail"));
      return;
    }
    if (!isMisc && !vehicle) {
      setSave("error");
      setMsg(t("common.saveFail"));
      return;
    }
    if (mileageLow && !allowException) return;

    setSave("saving");
    setMsg("");
    try {
      const body = isMisc
        ? {
            recordId: newRecordId(),
            fuelType,
            misc: true,
            reason,
            fuelVolume: volume,
            fuelDatetime: datetime ? new Date(datetime).toISOString() : undefined,
          }
        : {
            recordId: newRecordId(),
            fuelType,
            mainVehicleNo: vehicle!.mainVehicleNo,
            controlNo: vehicle!.controlNo,
            currentMileage: tracksMileage && currentMileage !== "" ? Number(currentMileage) : null,
            fuelVolume: volume,
            remarks,
            fuelDatetime: datetime ? new Date(datetime).toISOString() : undefined,
            allowMileageException: allowException,
          };
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const showInputs = isMisc || !!vehicle;
  const saveDisabled =
    save === "saving" || !fuelVolume || (isMisc && !reason.trim()) || (mileageLow && !allowException);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Step 1 — 유종 */}
      <Card className="p-4">
        <div className="mb-2 text-xs font-medium text-gray-600">{t("fuelType.label")}</div>
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
        <p className="py-6 text-center text-sm text-gray-500">{t("fuelType.selectPrompt")}</p>
      )}

      {/* Step 2 — 차량/장비 (또는 기타) + 입력 */}
      {fuelType && (
        <>
          <Card className="p-4">
            <div className="mb-2 text-xs font-medium text-gray-600">
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

            {isMisc && (
              <div className="mt-3 rounded-lg bg-hanwha/5 p-3 text-xs text-gray-600">
                {t("entry.miscSub")}
              </div>
            )}
          </Card>

          {showInputs && (
            <Card className="space-y-4 p-4">
              {/* 주유 일시 */}
              <label className="block">
                <span className="text-xs font-medium text-gray-600">{t("entry.fuelDatetime")}</span>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-border px-3 py-2.5 outline-none focus:border-hanwha"
                />
              </label>

              {/* 기타·말통: 사유 (수동 입력, 필수) */}
              {isMisc && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">{t("entry.reason")} *</span>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t("entry.reasonPlaceholder")}
                    className="mt-1 w-full rounded-lg border border-neutral-border px-3 py-2.5 outline-none focus:border-hanwha"
                  />
                </label>
              )}

              {/* 주행거리 관리 대상만 (트럭류·가솔린) */}
              {!isMisc && tracksMileage && (
                <div className="grid grid-cols-2 gap-3">
                  <ReadonlyField label={t("entry.previousMileage")} value={formatKm(previousMileage)} />
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">{t("entry.currentMileage")}</span>
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
                <span className="text-xs font-medium text-gray-600">
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

              {/* 비고 (기타 급유는 사유가 대신함) */}
              {!isMisc && (
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">{t("entry.remarks")}</span>
                  <input
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-border px-3 py-2.5 outline-none focus:border-hanwha"
                  />
                </label>
              )}

              {msg && (
                <p className={`text-sm ${save === "success" ? "text-success" : "text-danger"}`}>{msg}</p>
              )}

              <button
                type="button"
                disabled={saveDisabled}
                onClick={onSubmit}
                className="w-full rounded-lg bg-hanwha py-3.5 text-lg font-bold text-white transition hover:bg-hanwha/90 disabled:opacity-50"
              >
                {save === "saving" ? t("common.saving") : t("common.save")}
              </button>
              {!isMisc && tracksMileage && currentMileage && (
                <p className="text-center text-xs text-gray-500">
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
