"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, CheckCircle } from "lucide-react";
import { useStudySession } from "@/hooks/useStudySession";
import { CardContentRenderer } from "@/components/common/card-content-renderer";
import { QualityButtons } from "@/components/study/quality-buttons";
import { useReviewStore } from "@/stores/review-store";
import { calculateSM2 } from "@/lib/sm2";
import type { ReviewQuality, CardReview } from "@/types";

interface StudyPageProps {
  params: Promise<{ categoryId: string }>;
}

/** Returns a color for border flash based on quality rating */
function getFlashColor(quality: ReviewQuality): string {
  if (quality >= 3) return "#00c853"; // good / easy → green
  return "#e94560";                   // wrong / hard → red
}

export default function StudyPage({ params }: StudyPageProps) {
  const { categoryId } = use(params);

  const {
    queue,
    currentIndex,
    currentCard,
    isRevealed,
    isLoading,
    isDone,
    classified,
    sessionCount,
    todayCount,
    revealAnswer,
    answerCard,
    reload,
  } = useStudySession({ categoryId: categoryId === "all" ? undefined : categoryId });

  const { reviews } = useReviewStore();

  // Computa próximos intervalos para cada qualidade com base no estado atual do card
  const nextIntervals = currentCard ? (() => {
    const r = reviews[currentCard.id] as CardReview | undefined;
    const sm2Input = r ? { ease: r.ease, interval: r.interval, repetitions: r.repetitions } : undefined;
    return {
      1: calculateSM2(sm2Input, 1).interval,
      2: calculateSM2(sm2Input, 2).interval,
      3: calculateSM2(sm2Input, 3).interval,
      4: calculateSM2(sm2Input, 4).interval,
    } as Record<ReviewQuality, number>;
  })() : undefined;

  // Flash state: null = no flash, otherwise the quality chosen
  const [flashQuality, setFlashQuality] = useState<ReviewQuality | null>(null);

  const handleQuality = useCallback(async (quality: ReviewQuality) => {
    setFlashQuality(quality);
    // Brief delay so the flash is visible before the card transitions
    await new Promise((r) => setTimeout(r, 220));
    setFlashQuality(null);
    await answerCard(quality);
  }, [answerCard]);

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link href={categoryId === "all" ? "/study" : "/"} className="rounded-lg bg-[#1a1a2e] p-2">
            <ArrowLeft className="h-4 w-4 text-[#a0a0a0]" />
          </Link>
          <div className="h-5 w-32 rounded bg-[#1a1a2e] animate-pulse" />
        </div>
        <div className="flex-1 px-4 flex flex-col gap-4">
          <div className="h-2 rounded bg-[#1a1a2e] animate-pulse" />
          <div className="h-40 rounded-xl bg-[#1a1a2e] animate-pulse" />
        </div>
      </div>
    );
  }

  // ─── Empty queue ─────────────────────────────────────────────────────────────
  if (queue.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link href="/" className="rounded-lg bg-[#1a1a2e] p-2">
            <ArrowLeft className="h-4 w-4 text-[#a0a0a0]" />
          </Link>
          <h1 className="text-lg font-bold text-white">Estudo</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center gap-4">
          <div className="rounded-full bg-[#00c853]/10 p-6">
            <CheckCircle className="h-12 w-12 text-[#00c853]" />
          </div>
          <h2 className="text-xl font-bold text-white">Tudo em dia!</h2>
          <p className="text-sm text-[#a0a0a0]">
            Nenhum card para revisar nessa categoria. Volte amanhã!
          </p>
          <Link
            href="/"
            className="mt-2 rounded-xl bg-[#e94560] px-6 py-3 text-sm font-semibold text-white"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  // ─── Session complete ─────────────────────────────────────────────────────────
  if (isDone) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link href="/" className="rounded-lg bg-[#1a1a2e] p-2">
            <ArrowLeft className="h-4 w-4 text-[#a0a0a0]" />
          </Link>
          <h1 className="text-lg font-bold text-white">Sessão completa</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center gap-4">
          <div className="rounded-full bg-[#00c853]/10 p-6">
            <CheckCircle className="h-12 w-12 text-[#00c853]" />
          </div>
          <h2 className="text-2xl font-bold text-white">Parabéns!</h2>
          <p className="text-sm text-[#a0a0a0]">
            Você revisou <strong className="text-white">{sessionCount}</strong> cards nessa sessão.
          </p>
          <div className="w-full rounded-xl bg-[#1a1a2e] p-4 text-center">
            <p className="text-xs text-[#a0a0a0] mb-1">Cards estudados hoje</p>
            <p className="text-3xl font-bold text-[#00d9ff]">{todayCount}</p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={reload}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1a1a2e] py-3 text-sm font-semibold text-[#a0a0a0]"
            >
              <RotateCcw className="h-4 w-4" />
              Repetir
            </button>
            <Link
              href="/"
              className="flex flex-1 items-center justify-center rounded-xl bg-[#e94560] py-3 text-sm font-semibold text-white"
            >
              Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active session ───────────────────────────────────────────────────────────
  const progress = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;

  const flashColor = flashQuality !== null ? getFlashColor(flashQuality) : null;

  return (
    <div className="flex flex-col min-h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href="/" className="rounded-lg bg-[#1a1a2e] p-2 shrink-0">
          <ArrowLeft className="h-4 w-4 text-[#a0a0a0]" />
        </Link>
        <div className="flex-1 min-w-0">
          {/* Anki-style counter: new + learning + review */}
          <div className="flex items-center gap-2 text-sm font-bold" data-testid="queue-counter">
            <span className="text-[#2979ff]">{classified.new.length}</span>
            <span className="text-[#666] text-xs">+</span>
            <span className="text-[#e94560]">{classified.learning.length}</span>
            <span className="text-[#666] text-xs">+</span>
            <span className="text-[#00c853]">{classified.review.length}</span>
          </div>
          <p className="text-[10px] text-[#666]">
            {currentIndex + 1} / {queue.length} • {todayCount} hoje
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-4 h-1.5 rounded-full bg-[#252a4a]">
        <div
          className="h-full rounded-full bg-[#e94560] transition-all duration-300"
          style={{ width: `${progress}%` }}
          data-testid="progress-bar"
        />
      </div>

      {/* Card area */}
      <div className="flex-1 px-4 flex flex-col gap-4 overflow-y-auto pb-4">
        <AnimatePresence mode="wait">
          {!isRevealed && currentCard ? (
            <motion.div
              key={`front-${currentCard.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              onClick={revealAnswer}
              className="cursor-pointer rounded-xl bg-[#1a1a2e] p-5"
              style={{
                borderLeft: `4px solid ${flashColor ?? "#e94560"}`,
                transition: "border-color 0.15s ease",
              }}
              data-testid="card-front"
            >
              <p className="text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-3">
                Pergunta
              </p>
              <CardContentRenderer html={currentCard.front} />
              <p className="mt-6 text-center text-xs text-[#666]">
                Toque para revelar
              </p>
            </motion.div>
          ) : currentCard ? (
            <motion.div
              key={`back-${currentCard.id}`}
              initial={{ opacity: 0, rotateX: -8 }}
              animate={{ opacity: 1, rotateX: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
              data-testid="card-back"
            >
              {/* Question recap (dimmed) */}
              <div
                className="rounded-xl bg-[#1a1a2e] p-5 opacity-50"
                style={{
                  borderLeft: `4px solid ${flashColor ?? "#e94560"}`,
                  transition: "border-color 0.15s ease",
                }}
              >
                <p className="text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-3">
                  Pergunta
                </p>
                <CardContentRenderer html={currentCard.front} />
              </div>

              {/* Answer */}
              <div
                className="rounded-xl bg-[#1a1a2e] p-5"
                style={{
                  borderLeft: `4px solid ${flashColor ?? "#00d9ff"}`,
                  transition: "border-color 0.15s ease",
                }}
              >
                <p className="text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-3">
                  Resposta
                </p>
                <CardContentRenderer html={currentCard.back} />
              </div>

              {/* Extra / Resumo */}
              {currentCard.extra && (
                <div
                  className="rounded-xl bg-[#1a1a2e] p-5"
                  style={{
                    borderLeft: `4px solid #9b59b6`,
                  }}
                >
                  <p className="text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-3">
                    Extra
                  </p>
                  <CardContentRenderer html={currentCard.extra} />
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Quality buttons (only shown when answer is revealed) */}
      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 pt-2"
            data-testid="quality-buttons"
          >
            <QualityButtons onSelect={handleQuality} disabled={flashQuality !== null} nextIntervals={nextIntervals} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
