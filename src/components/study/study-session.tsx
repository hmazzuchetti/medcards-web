"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, CheckCircle, Clock, FolderOpen, Info, X } from "lucide-react";
import { useStudySession, type UseStudySessionOptions } from "@/hooks/useStudySession";
import { CardContentRenderer } from "@/components/common/card-content-renderer";
import { QualityButtons } from "@/components/study/quality-buttons";
import type { ReviewQuality } from "@/types";

interface StudySessionProps extends UseStudySessionOptions {
  /** Optional back link shown in the header (the home tab has none, like Anki) */
  backHref?: string;
  /** Optional title shown under the counter */
  title?: string;
  /** Shown when the queue is empty because no folder is enabled */
  noFoldersSelected?: boolean;
}

/** Maximum finger movement (px) for a pointer gesture to count as a tap, not a scroll. */
const TAP_SLOP_PX = 12;
const TAP_MAX_MS = 600;

function flashColor(quality: ReviewQuality): string {
  return quality >= 3 ? "#00c853" : "#e94560";
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function StudySession({ backHref, title, noFoldersSelected, ...options }: StudySessionProps) {
  const {
    currentCard,
    currentReview,
    isRevealed,
    isLoading,
    isEmpty,
    isDone,
    waitUntil,
    counts,
    sessionCount,
    todayCount,
    previews,
    revealAnswer,
    answerCard,
    showNow,
    reload,
  } = useStudySession(options);

  const [flashQuality, setFlashQuality] = useState<ReviewQuality | null>(null);
  // Per-card UI state is keyed by card id so it resets naturally when the card changes
  const [extraForCard, setExtraForCard] = useState<string | null>(null);
  const [tapSideState, setTapSideState] = useState<{ cardId: string; side: "left" | "right" } | null>(null);
  const pointerStart = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  const showExtra = !!currentCard && extraForCard === currentCard.id;
  const tapSide = currentCard && tapSideState?.cardId === currentCard.id ? tapSideState.side : null;
  const setShowExtra = (open: boolean) => setExtraForCard(open && currentCard ? currentCard.id : null);

  const handleQuality = useCallback(
    async (quality: ReviewQuality) => {
      if (flashQuality !== null) return;
      setFlashQuality(quality);
      await new Promise((r) => setTimeout(r, 180));
      setFlashQuality(null);
      await answerCard(quality);
    },
    [answerCard, flashQuality]
  );

  // ─── Tap anywhere: reveal, then left = Errei / right = Bom (FB-13 / FB-14) ───
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointerStart.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start || start.id !== e.pointerId) return;
      if (!currentCard || flashQuality !== null) return;

      // Ignore scrolls/drags and long presses
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved > TAP_SLOP_PX || Date.now() - start.t > TAP_MAX_MS) return;

      // Ignore taps on controls (buttons, links, extra sheet)
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-tap], a, button, input, textarea, select")) return;

      if (!isRevealed) {
        revealAnswer();
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const isLeft = e.clientX - rect.left < rect.width / 2;
      setTapSideState({ cardId: currentCard.id, side: isLeft ? "left" : "right" });
      void handleQuality(isLeft ? 1 : 3);
    },
    [currentCard, flashQuality, isRevealed, revealAnswer, handleQuality]
  );

  // ─── Keyboard shortcuts (Anki: space/enter reveal, 1-4 answer) ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!currentCard) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!isRevealed) revealAnswer();
        else void handleQuality(3);
      } else if (isRevealed && ["1", "2", "3", "4"].includes(e.key)) {
        void handleQuality(Number(e.key) as ReviewQuality);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentCard, isRevealed, revealAnswer, handleQuality]);

  // ─── Countdown while waiting for a learning card ───
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (waitUntil === null) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waitUntil]);

  // ─── Header (shared) ───
  const header = (
    <div className="flex items-center gap-3 px-4 py-3">
      {backHref && (
        <Link href={backHref} className="rounded-lg bg-[#1a1a2e] p-2 shrink-0" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4 text-[#a0a0a0]" />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        {/* Anki-style counter: new + learning + review */}
        <div className="flex items-center gap-2 text-sm font-bold" data-testid="queue-counter">
          <span className="text-[#2979ff]" data-testid="count-new">{counts.new}</span>
          <span className="text-[#666] text-xs">+</span>
          <span className="text-[#e94560]" data-testid="count-learning">{counts.learning}</span>
          <span className="text-[#666] text-xs">+</span>
          <span className="text-[#00c853]" data-testid="count-review">{counts.review}</span>
        </div>
        <p className="text-[10px] text-[#666] truncate">
          {title ? `${title} • ` : ""}
          <span data-testid="today-count">{todayCount}</span> hoje
        </p>
      </div>
    </div>
  );

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col" data-testid="study-loading">
        {header}
        <div className="flex-1 px-4 flex flex-col gap-4">
          <div className="h-40 rounded-xl bg-[#1a1a2e] animate-pulse" />
        </div>
      </div>
    );
  }

  // ─── Empty ───
  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col" data-testid="study-empty">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center gap-4">
          <div className="rounded-full bg-[#00c853]/10 p-6">
            {noFoldersSelected ? (
              <FolderOpen className="h-12 w-12 text-[#ff9f43]" />
            ) : (
              <CheckCircle className="h-12 w-12 text-[#00c853]" />
            )}
          </div>
          <h2 className="text-xl font-bold text-white">
            {noFoldersSelected ? "Nenhuma pasta selecionada" : "Tudo em dia!"}
          </h2>
          <p className="text-sm text-[#a0a0a0]">
            {noFoldersSelected
              ? "Ative pelo menos uma pasta para começar a estudar."
              : "Nenhum card para revisar agora. Volte mais tarde!"}
          </p>
          <Link
            href="/decks"
            className="mt-2 rounded-xl bg-[#e94560] px-6 py-3 text-sm font-semibold text-white"
          >
            Abrir Pastas
          </Link>
        </div>
      </div>
    );
  }

  // ─── Waiting for a learning card ───
  if (!currentCard && waitUntil !== null) {
    const remaining = waitUntil - nowTick;
    return (
      <div className="flex flex-1 flex-col" data-testid="study-waiting">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center gap-4">
          <div className="rounded-full bg-[#e94560]/10 p-6">
            <Clock className="h-12 w-12 text-[#e94560]" />
          </div>
          <h2 className="text-xl font-bold text-white">Aguardando…</h2>
          <p className="text-sm text-[#a0a0a0]">
            O próximo card em aprendizado volta em{" "}
            <strong className="text-white" data-testid="wait-countdown">{formatCountdown(remaining)}</strong>
          </p>
          <button
            onClick={showNow}
            data-testid="show-now-btn"
            className="mt-2 rounded-xl bg-[#252a4a] px-6 py-3 text-sm font-semibold text-[#e94560]"
          >
            Mostrar agora
          </button>
        </div>
      </div>
    );
  }

  // ─── Done ───
  if (isDone || !currentCard) {
    return (
      <div className="flex flex-1 flex-col" data-testid="study-done">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center gap-4">
          <div className="rounded-full bg-[#00c853]/10 p-6">
            <CheckCircle className="h-12 w-12 text-[#00c853]" />
          </div>
          <h2 className="text-2xl font-bold text-white">Parabéns!</h2>
          <p className="text-sm text-[#a0a0a0]">
            Você revisou <strong className="text-white" data-testid="session-count">{sessionCount}</strong> cards nessa sessão.
          </p>
          <div className="w-full rounded-xl bg-[#1a1a2e] p-4 text-center">
            <p className="text-xs text-[#a0a0a0] mb-1">Cards estudados hoje</p>
            <p className="text-3xl font-bold text-[#00d9ff]" data-testid="done-today-count">{todayCount}</p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={reload}
              data-testid="reload-btn"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1a1a2e] py-3 text-sm font-semibold text-[#a0a0a0]"
            >
              <RotateCcw className="h-4 w-4" />
              Recarregar
            </button>
            <Link
              href="/decks"
              className="flex flex-1 items-center justify-center rounded-xl bg-[#e94560] py-3 text-sm font-semibold text-white"
            >
              Pastas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active card ───
  const color = flashQuality !== null ? flashColor(flashQuality) : null;

  return (
    <div className="flex flex-1 flex-col">
      {header}

      {/* Tap area: whole screen reveals; after reveal left = Errei, right = Bom */}
      <div
        className="relative flex-1 flex flex-col select-none touch-manipulation"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { pointerStart.current = null; }}
        data-testid="tap-area"
      >
        {/* Side hints after reveal */}
        {isRevealed && (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 flex items-end justify-start pb-3 pl-3"
              data-testid="tap-left-hint"
            >
              <span className="text-[10px] font-semibold text-[#e94560]/60">← Errei</span>
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-1/2 flex items-end justify-end pb-3 pr-3"
              data-testid="tap-right-hint"
            >
              <span className="text-[10px] font-semibold text-[#00c853]/60">Bom →</span>
            </div>
          </>
        )}

        <div className="flex-1 px-4 flex flex-col gap-4 overflow-y-auto pb-8">
          <AnimatePresence mode="wait">
            {!isRevealed ? (
              <motion.div
                key={`front-${currentCard.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="rounded-xl bg-[#1a1a2e] p-5"
                style={{ borderLeft: `4px solid ${color ?? "#e94560"}`, transition: "border-color 0.15s ease" }}
                data-testid="card-front"
              >
                <CardContentRenderer html={currentCard.front} />
                <p className="mt-6 text-center text-xs text-[#666]">Toque em qualquer lugar para ver a resposta</p>
              </motion.div>
            ) : (
              <motion.div
                key={`back-${currentCard.id}`}
                initial={{ opacity: 0, rotateX: -8 }}
                animate={{ opacity: 1, rotateX: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-4"
                data-testid="card-back"
              >
                <div
                  className="rounded-xl bg-[#1a1a2e] p-5 opacity-60"
                  style={{ borderLeft: `4px solid ${color ?? "#e94560"}`, transition: "border-color 0.15s ease" }}
                >
                  <CardContentRenderer html={currentCard.front} />
                </div>

                <div
                  className="rounded-xl bg-[#1a1a2e] p-5"
                  style={{ borderLeft: `4px solid ${color ?? "#00d9ff"}`, transition: "border-color 0.15s ease" }}
                  data-testid="card-answer"
                >
                  <CardContentRenderer html={currentCard.back} />
                  {currentReview && currentReview.phase !== "new" && (
                    <p className="mt-3 text-[10px] text-[#666]" data-testid="card-meta">
                      {currentReview.phase === "review"
                        ? `Revisão • intervalo ${currentReview.interval}d • ${currentReview.reps} respostas`
                        : `Aprendendo • ${currentReview.reps} respostas`}
                    </p>
                  )}
                </div>

                {currentCard.extra && (
                  <button
                    type="button"
                    onClick={() => setShowExtra(true)}
                    data-testid="extra-btn"
                    data-no-tap="true"
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#252a4a] py-2.5 text-xs font-semibold text-[#9b59b6]"
                  >
                    <Info className="h-4 w-4" />
                    Ver mais informações
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Quality buttons */}
      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="px-0 pb-4 pt-2"
            data-testid="quality-buttons"
            data-no-tap="true"
          >
            <QualityButtons onSelect={handleQuality} disabled={flashQuality !== null} previews={previews} />
            {tapSide && (
              <p className="sr-only" data-testid="tap-side">{tapSide}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extra sheet (FB-02: extra opens in a separate panel) */}
      <AnimatePresence>
        {showExtra && currentCard.extra && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowExtra(false)}
            data-no-tap="true"
          >
            <motion.div
              className="w-full max-w-[430px] max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-[#1a1a2e] p-5"
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              data-testid="extra-sheet"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-[#9b59b6]">Extra</p>
                <button type="button" onClick={() => setShowExtra(false)} aria-label="Fechar" className="text-[#666]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <CardContentRenderer html={currentCard.extra} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
