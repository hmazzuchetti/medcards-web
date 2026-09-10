"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronRight, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { fetchSubcategoriesWithCards, type SubcategoryWithCards } from "@/services/cards.service";
import { useReviewStore } from "@/stores/review-store";
import { useDeckStore } from "@/stores/deck-store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryGroup {
  id: string;
  name: string;
  subcategories: SubcategoryWithCards[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DecksPage() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { getDueCount } = useReviewStore();
  const { isSubcategoryEnabled, toggleSubcategory, toggleCategory, getNewCardsPerDay, setNewCardsPerDay } = useDeckStore();

  // Load subcategories from Supabase
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const subcats = await fetchSubcategoriesWithCards();

        if (cancelled) return;

        // Group by category_id — preserve category name from categoryName field
        const groupMap: Record<string, CategoryGroup> = {};
        for (const sub of subcats) {
          if (!groupMap[sub.category_id]) {
            groupMap[sub.category_id] = {
              id: sub.category_id,
              name: sub.categoryName,
              subcategories: [],
            };
          }
          groupMap[sub.category_id].subcategories.push(sub);
        }

        const sorted = Object.values(groupMap).sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR")
        );

        setGroups(sorted);

        // Auto-expand first category
        if (sorted.length > 0) {
          setExpandedIds(new Set([sorted[0].id]));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleCategory = useCallback(
    (subcategoryIds: string[]) => {
      toggleCategory(subcategoryIds);
    },
    [toggleCategory]
  );

  const changeNewCards = useCallback(
    (subcategoryId: string, delta: number) => {
      const current = getNewCardsPerDay(subcategoryId);
      setNewCardsPerDay(subcategoryId, current + delta);
    },
    [getNewCardsPerDay, setNewCardsPerDay]
  );

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="page-transition flex flex-col">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-white">Pastas</h1>
          <p className="mt-1 text-xs text-[#a0a0a0]">
            Gerencie suas categorias e cards por dia
          </p>
        </div>
        <div className="flex flex-col gap-2 px-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-[#1a1a2e]"
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Empty ───────────────────────────────────────────────────────────────────

  if (groups.length === 0) {
    return (
      <div className="page-transition flex flex-col">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-white">Pastas</h1>
        </div>
        <div className="flex flex-col items-center py-16 text-center">
          <span className="text-4xl">📚</span>
          <p className="mt-3 text-sm text-[#a0a0a0]">
            Nenhuma subcategoria encontrada
          </p>
        </div>
      </div>
    );
  }

  // ─── Main ────────────────────────────────────────────────────────────────────

  return (
    <div className="page-transition flex flex-col">
      {/* Header */}
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-white">Pastas</h1>
        <p className="mt-1 text-xs text-[#a0a0a0]">
          Gerencie suas categorias e cards por dia
        </p>
      </div>

      {/* Category List */}
      <div className="flex flex-col gap-2 px-4 pb-8">
        {groups.map((category, groupIndex) => {
          const isExpanded = expandedIds.has(category.id);
          const subcatIds = category.subcategories.map((s) => s.id);
          const enabledCount = subcatIds.filter((id) => isSubcategoryEnabled(id)).length;
          const allEnabled = enabledCount === subcatIds.length;
          const totalDue = category.subcategories.reduce(
            (sum, s) => sum + getDueCount(s.cardIds),
            0
          );

          return (
            <motion.div
              key={category.id}
              className="overflow-hidden rounded-xl bg-[#1a1a2e]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: groupIndex * 0.07 }}
            >
              {/* Category Header */}
              <div className="flex items-center gap-3 p-4">
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex flex-1 flex-col items-start">
                    <Link
                      href={`/search?category=${category.id}`}
                      data-testid={`category-link-${category.id}`}
                      className="text-sm font-semibold text-white hover:text-[#00d9ff] transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {category.name}
                    </Link>
                    <button
                      onClick={() => toggleExpanded(category.id)}
                      className="text-[10px] text-[#a0a0a0] text-left"
                    >
                      {enabledCount}/{subcatIds.length} ativas
                      {totalDue > 0 && (
                        <span className="ml-2 text-[#e94560]">
                          {totalDue} pendentes
                        </span>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={() => toggleExpanded(category.id)}
                    data-testid={`category-expand-${category.id}`}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Recolher" : "Expandir"}
                    className="p-1"
                  >
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="h-4 w-4 text-[#666]" />
                    </motion.div>
                  </button>
                </div>

                {/* Toggle all */}
                <button
                  onClick={() => handleToggleCategory(subcatIds)}
                  data-testid={`category-toggle-${category.id}`}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    allEnabled
                      ? "bg-[#e94560]/20 text-[#e94560]"
                      : "bg-[#252a4a] text-[#666]"
                  }`}
                >
                  {allEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {/* Subcategories — AnimatePresence for height animation */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="subcats"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                    className="border-t border-[#252a4a]"
                  >
                    {category.subcategories.map((sub, subIndex) => {
                      const enabled = isSubcategoryEnabled(sub.id);
                      const dueCount = getDueCount(sub.cardIds);
                      const newPerDay = getNewCardsPerDay(sub.id);

                      return (
                        <motion.div
                          key={sub.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.22,
                            ease: "easeOut",
                            delay: subIndex * 0.04,
                          }}
                          className="flex items-center gap-3 border-b border-[#252a4a]/50 px-4 py-3 last:border-b-0"
                        >
                          {/* Toggle */}
                          <button
                            onClick={() => toggleSubcategory(sub.id)}
                            data-testid={`subcategory-toggle-${sub.id}`}
                            aria-pressed={enabled}
                            aria-label={`${enabled ? "Desativar" : "Ativar"} ${sub.name}`}
                            className={`h-5 w-9 rounded-full transition-colors ${
                              enabled ? "bg-[#e94560]" : "bg-[#252a4a]"
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                                enabled ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>

                          {/* Name & info */}
                          <div className="flex flex-1 flex-col">
                            <Link
                              href={`/search?folder=${sub.id}`}
                              data-testid={`subcategory-link-${sub.id}`}
                              className={`text-sm hover:text-[#00d9ff] transition-colors ${
                                enabled ? "text-white" : "text-[#666]"
                              }`}
                            >
                              {sub.name}
                            </Link>
                            <div className="flex gap-2 text-[10px]">
                              <span className="text-[#a0a0a0]">
                                {sub.totalCards} cards
                              </span>
                              {dueCount > 0 && (
                                <span className="text-[#e94560]">
                                  {dueCount} pendentes
                                </span>
                              )}
                            </div>
                          </div>

                          {/* New cards stepper */}
                          {enabled && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => changeNewCards(sub.id, -5)}
                                data-testid={`new-cards-minus-${sub.id}`}
                                aria-label="Menos 5 cards novos por dia"
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-[#252a4a] text-[#a0a0a0] active:bg-[#252a4a]/70"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center text-xs font-medium text-white" data-testid={`new-cards-value-${sub.id}`}>
                                {newPerDay}
                              </span>
                              <button
                                onClick={() => changeNewCards(sub.id, 5)}
                                data-testid={`new-cards-plus-${sub.id}`}
                                aria-label="Mais 5 cards novos por dia"
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-[#252a4a] text-[#a0a0a0] active:bg-[#252a4a]/70"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
