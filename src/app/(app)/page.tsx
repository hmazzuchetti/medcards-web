"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { useCategoryDueCounts } from "@/hooks/useCategoryDueCounts";
import { useDailyStats } from "@/hooks/useDailyStats";
import { LogOut, BookOpen, Flame, ChevronRight, Loader2 } from "lucide-react";

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, displayName, isLoading: authLoading, signOut } = useAuthStore();
  const { categories, totalDue, isLoading: catsLoading } = useCategoryDueCounts();
  const { todayCount, streak, isLoading: statsLoading } = useDailyStats();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const name = displayName ?? user?.email ?? "usuário";
  const isLoading = catsLoading || statsLoading;

  return (
    <div className="page-transition flex flex-col min-h-full px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#e94560]">MedCards</h1>
        <button
          onClick={handleLogout}
          disabled={authLoading}
          className="flex items-center gap-1.5 rounded-lg bg-[#1a1a2e] px-3 py-2 text-xs font-medium text-[#a0a0a0] hover:text-white transition-colors disabled:opacity-50"
          aria-label="Sair"
        >
          {authLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          Sair
        </button>
      </div>

      {/* Welcome + Stats */}
      <motion.div
        className="rounded-2xl bg-[#1a1a2e] p-5 mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <p className="text-xs text-[#a0a0a0] mb-0.5">Bem-vindo,</p>
        <h2 className="text-xl font-bold text-white truncate mb-4">{name}</h2>

        <motion.div
          className="flex gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Today count */}
          <motion.div variants={itemVariants} className="flex flex-col">
            <span className="text-2xl font-bold text-[#00d9ff]">{todayCount}</span>
            <span className="text-[10px] text-[#a0a0a0]">hoje</span>
          </motion.div>
          <div className="w-px bg-[#252a4a]" />
          {/* Streak */}
          <motion.div variants={itemVariants} className="flex flex-col">
            <div className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-[#ff9f43]" />
              <span className="text-2xl font-bold text-[#ff9f43]">{streak}</span>
            </div>
            <span className="text-[10px] text-[#a0a0a0]">dias seguidos</span>
          </motion.div>
          <div className="w-px bg-[#252a4a]" />
          {/* Total due */}
          <motion.div variants={itemVariants} className="flex flex-col">
            <span className="text-2xl font-bold text-[#e94560]">{totalDue}</span>
            <span className="text-[10px] text-[#a0a0a0]">pendentes</span>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Study Now button */}
      <AnimatePresence>
        {totalDue > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mb-6"
          >
            <motion.div
              animate={{ scale: [1, 1.015, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Link
                href="/study"
                data-testid="study-now-btn"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#e94560] py-4 text-sm font-bold text-white active:scale-95 transition-transform"
              >
                <BookOpen className="h-5 w-5" />
                Estudar agora — {totalDue} cards
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category list */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide mb-1">
          Categorias
        </p>

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-[#1a1a2e] animate-pulse"
            />
          ))
        ) : categories.length === 0 ? (
          <div className="rounded-xl bg-[#1a1a2e] p-5 text-center">
            <p className="text-sm text-[#a0a0a0]">Nenhuma categoria encontrada</p>
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-2"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {categories.map((cat) => (
              <motion.div key={cat.category.id} variants={itemVariants}>
                <Link
                  href={`/study/${cat.category.id}`}
                  data-testid={`category-card-${cat.category.id}`}
                  className="flex items-center gap-3 rounded-xl bg-[#1a1a2e] p-4 active:bg-[#252a4a] transition-colors"
                >
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold text-white">
                      {cat.category.name}
                    </span>
                    <span className="text-[11px] text-[#a0a0a0] mt-0.5">
                      {cat.totalCards} cards
                    </span>
                  </div>

                  {cat.dueCount > 0 ? (
                    <span className="rounded-full bg-[#e94560]/20 px-2.5 py-0.5 text-xs font-semibold text-[#e94560]">
                      {cat.dueCount}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#252a4a] px-2.5 py-0.5 text-xs text-[#666]">
                      em dia
                    </span>
                  )}

                  <ChevronRight className="h-4 w-4 text-[#666]" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
