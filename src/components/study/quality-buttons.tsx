"use client";

import { motion } from "framer-motion";
import { formatPreview, type IntervalPreview } from "@/lib/scheduler";
import type { ReviewQuality } from "@/types";

interface QualityButtonsProps {
  onSelect: (quality: ReviewQuality) => void;
  disabled?: boolean;
  previews?: Record<ReviewQuality, IntervalPreview> | null;
}

export const QUALITY_OPTIONS = [
  { value: 1 as ReviewQuality, key: "again", label: "Errei", color: "#e94560", bgColor: "rgba(233,69,96,0.15)" },
  { value: 2 as ReviewQuality, key: "hard", label: "Difícil", color: "#ff9f43", bgColor: "rgba(255,159,67,0.15)" },
  { value: 3 as ReviewQuality, key: "good", label: "Bom", color: "#00d9ff", bgColor: "rgba(0,217,255,0.15)" },
  { value: 4 as ReviewQuality, key: "easy", label: "Fácil", color: "#00c853", bgColor: "rgba(0,200,83,0.15)" },
] as const;

export function QualityButtons({ onSelect, disabled = false, previews }: QualityButtonsProps) {
  return (
    <div className="flex gap-2 px-4" data-no-tap="true">
      {QUALITY_OPTIONS.map((q, i) => (
        <motion.button
          key={q.value}
          type="button"
          onClick={() => onSelect(q.value)}
          disabled={disabled}
          data-testid={`quality-${q.key}`}
          aria-label={q.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut", delay: i * 0.05 }}
          whileTap={{ scale: 0.92 }}
          className="flex flex-1 flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold transition-colors disabled:opacity-40"
          style={{
            backgroundColor: q.bgColor,
            color: q.color,
            border: `1px solid ${q.color}33`,
          }}
        >
          <span className="text-base font-bold">{q.value}</span>
          <span>{q.label}</span>
          {previews && (
            <span className="text-[10px] opacity-70" data-testid={`interval-${q.key}`}>
              {formatPreview(previews[q.value])}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
