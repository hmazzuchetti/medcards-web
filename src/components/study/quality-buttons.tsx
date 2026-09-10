"use client";

import { motion } from "framer-motion";
import type { ReviewQuality } from "@/types";

interface QualityButtonsProps {
  onSelect: (quality: ReviewQuality) => void;
  disabled?: boolean;
  nextIntervals?: Record<ReviewQuality, number>;
}

const qualities = [
  { value: 1 as ReviewQuality, label: "Errei", color: "#e94560", bgColor: "rgba(233,69,96,0.15)" },
  { value: 2 as ReviewQuality, label: "Difícil", color: "#ff9f43", bgColor: "rgba(255,159,67,0.15)" },
  { value: 3 as ReviewQuality, label: "Bom", color: "#00d9ff", bgColor: "rgba(0,217,255,0.15)" },
  { value: 4 as ReviewQuality, label: "Fácil", color: "#00c853", bgColor: "rgba(0,200,83,0.15)" },
] as const;

function formatInterval(days: number): string {
  if (days <= 1) return "1d";
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}m`;
}

export function QualityButtons({ onSelect, disabled = false, nextIntervals }: QualityButtonsProps) {
  return (
    <div className="flex gap-2 px-4">
      {qualities.map((q, i) => (
        <motion.button
          key={q.value}
          onClick={() => onSelect(q.value)}
          disabled={disabled}
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
          {nextIntervals && (
            <span className="text-[10px] opacity-70">
              {formatInterval(nextIntervals[q.value])}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
