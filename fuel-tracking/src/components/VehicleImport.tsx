"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { downloadCsv, parseCsv } from "@/lib/csv";

// 헤더 별칭 → 표준 키 매핑 (한/영 혼용 허용)
const ALIASES: Record<string, string> = {
  fuel_type: "fuelType",
  유종: "fuelType",
  fueltype: "fuelType",
  main_vehicle_no: "mainVehicleNo",
  차량번호: "mainVehicleNo",
  control_no: "controlNo",
  관리번호: "controlNo",
  vehicle_type: "vehicleType",
  equipment_name: "vehicleType",
  차량종류: "vehicleType",
  장비: "vehicleType",
  capacity: "capacity",
  용량: "capacity",
  team_code: "teamCode",
  팀코드: "teamCode",
  part: "part",
  파트: "part",
  drivers: "drivers",
  driver: "drivers",
  운전자: "drivers",
  status: "status",
  상태: "status",
};

const TEMPLATE = [
  "fuel_type,main_vehicle_no,control_no,vehicle_type,capacity,team_code,part,drivers,status",
  "diesel,,EX-200,Excavator (Wheel),0.7m3,CLDS,,,active",
  "gasoline,공사-30,LSU-200,Sorento,,,토목,홍길동,active",
].join("\n");

export function VehicleImport({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const text = await file.text();
      const raw = parseCsv(text);
      const rows = raw.map((o) => {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(o)) {
          const std = ALIASES[k.toLowerCase().trim()];
          if (std) mapped[std] = v;
        }
        return mapped;
      });
      const res = await fetch("/api/vehicles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "import failed");
      const errTxt = data.errors?.length ? ` · ${data.errors.length} err` : "";
      setMsg(`${t("vehicles.importDone")}: +${data.created} / ~${data.updated}${errTxt}`);
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={fileRef} type="file" accept=".csv" onChange={onFile} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="rounded-lg border border-neutral-border px-3 py-1.5 text-sm hover:border-hanwha disabled:opacity-50"
      >
        {busy ? "..." : `⬆ ${t("vehicles.import")}`}
      </button>
      <button
        onClick={() => downloadCsv("vehicle-template.csv", TEMPLATE)}
        className="rounded-lg border border-neutral-border px-3 py-1.5 text-sm text-gray-500 hover:border-hanwha"
      >
        {t("vehicles.template")}
      </button>
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
    </div>
  );
}
