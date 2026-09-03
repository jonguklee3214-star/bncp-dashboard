"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "fts.adminpin";

// 관리자 PIN 기반 잠금 해제. PIN 은 sessionStorage 에만 두고 수정 요청 헤더로 전송.
export function useAdmin() {
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(KEY);
      if (s) setPin(s);
    } catch {
      /* ignore */
    }
  }, []);

  const unlock = useCallback(async (candidate: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: candidate }),
      });
      const data = await res.json();
      if (data.ok) {
        setPin(candidate);
        try {
          sessionStorage.setItem(KEY, candidate);
        } catch {
          /* ignore */
        }
        return { ok: true };
      }
      return { ok: false, message: data.message };
    } catch {
      return { ok: false };
    }
  }, []);

  const lock = useCallback(() => {
    setPin(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { isAdmin: !!pin, pin, unlock, lock };
}
