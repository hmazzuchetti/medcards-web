"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Card, ReviewQuality } from "@/types";
import { CardContentRenderer } from "@/components/common/card-content-renderer";
import { QualityButtons } from "./quality-buttons";

interface StudyCardProps {
  card: Card;
  isRevealed: boolean;
  onReveal: () => void;
  onQuality: (quality: ReviewQuality) => void;
  repetitions?: number;
  interval?: number;
}

export function StudyCard({
  card,
  isRevealed,
  onReveal,
  onQuality,
  repetitions = 0,
  interval = 0,
}: StudyCardProps) {
  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence mode="wait">
        {!isRevealed ? (
          <motion.div
            key="front"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            onClick={onReveal}
            className="cursor-pointer rounded-xl border-l-4 border-l-[#e94560] bg-[#1a1a2e] p-5"
          >
            <CardContentRenderer html={card.front} />
            <p className="mt-6 text-center text-xs text-[#666]">
              Toque para revelar
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            initial={{ opacity: 0, rotateX: -10 }}
            animate={{ opacity: 1, rotateX: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4"
          >
            {/* Question recap */}
            <div className="rounded-xl border-l-4 border-l-[#e94560] bg-[#1a1a2e] p-5 opacity-60">
              <CardContentRenderer html={card.front} />
            </div>

            {/* Answer */}
            <div className="rounded-xl border-l-4 border-l-[#00d9ff] bg-[#1a1a2e] p-5">
              <CardContentRenderer html={card.back} />
              {(repetitions > 0 || interval > 0) && (
                <div className="mt-4 flex gap-4 border-t border-[#252a4a] pt-3 text-[10px] text-[#666]">
                  <span>Repetições: {repetitions}</span>
                  <span>Intervalo: {interval}d</span>
                </div>
              )}
            </div>

            {/* Quality buttons */}
            <QualityButtons onSelect={onQuality} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
