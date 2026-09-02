"use client";

import { useMemo, useState } from "react";

export interface Option {
  value: string;
  label: string;
  sub?: string;
}

// 검색 가능한 선택기 (항목 66·48). 터치 친화적 큰 항목.
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(s) || (o.sub ?? "").toLowerCase().includes(s),
    );
  }, [options, q]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-neutral-border bg-white px-4 py-3 text-left outline-none focus:border-hanwha"
      >
        <span className={selected ? "font-medium" : "text-gray-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-gray-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-hidden rounded-lg border border-neutral-border bg-white shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`🔍 ${searchPlaceholder}`}
              className="w-full rounded-md border border-neutral-border px-3 py-2 text-sm outline-none focus:border-hanwha"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full flex-col px-4 py-3 text-left hover:bg-neutral-soft ${
                    o.value === value ? "bg-hanwha/10" : ""
                  }`}
                >
                  <span className="font-medium">{o.label}</span>
                  {o.sub && <span className="text-xs text-gray-500">{o.sub}</span>}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-400">—</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
