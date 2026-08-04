"use client";

import type { ReviewQuality } from "@/types";

interface QualityButtonsProps {
  onSelect: (quality: ReviewQuality) => void;
  disabled?: boolean;
}

const qualities = [
  { value: 1 as ReviewQuality, label: "Errei", color: "#e94560", bgColor: "rgba(233,69,96,0.15)" },
  { value: 2 as ReviewQuality, label: "Difícil", color: "#ff9f43", bgColor: "rgba(255,159,67,0.15)" },
  { value: 3 as ReviewQuality, label: "Bom", color: "#00d9ff", bgColor: "rgba(0,217,255,0.15)" },
  { value: 4 as ReviewQuality, label: "Fácil", color: "#00c853", bgColor: "rgba(0,200,83,0.15)" },
] as const;

export function QualityButtons({ onSelect, disabled = false }: QualityButtonsProps) {
  return (
    <div className="flex gap-2 px-4">
      {qualities.map((q) => (
        <button
          key={q.value}
          onClick={() => onSelect(q.value)}
          disabled={disabled}
          className="flex flex-1 flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
          style={{
            backgroundColor: q.bgColor,
            color: q.color,
            border: `1px solid ${q.color}33`,
          }}
        >
          <span className="text-base font-bold">{q.value}</span>
          <span>{q.label}</span>
        </button>
      ))}
    </div>
  );
}
