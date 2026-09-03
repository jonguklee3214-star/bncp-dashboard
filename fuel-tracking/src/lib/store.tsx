"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { FuelLog, Vehicle } from "@/types";

interface StoreState {
  vehicles: Vehicle[];
  logs: FuelLog[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vRes, lRes] = await Promise.all([fetch("/api/vehicles"), fetch("/api/logs")]);
      const vData = await vRes.json();
      const lData = await lRes.json();
      if (!vRes.ok) throw new Error(vData?.message || "vehicles load failed");
      if (!lRes.ok) throw new Error(lData?.message || "logs load failed");
      setVehicles(vData.vehicles ?? []);
      setLogs(lData.logs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ vehicles, logs, loading, error, refresh }),
    [vehicles, logs, loading, error, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
