"use client";

import { useEffect, useState } from "react";

// Google Sheets 미연결(데모) 상태를 알려주는 배너.
export function DemoBanner() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setDemo(!d.configured))
      .catch(() => setDemo(false));
  }, []);

  if (!demo) return null;
  return (
    <div className="no-print bg-warning/15 px-4 py-1.5 text-center text-xs text-warning">
      데모 모드 · Google Sheets 미연결 (저장은 임시 · 새로고침 시 초기화). 설정에서 연결하세요.
    </div>
  );
}
