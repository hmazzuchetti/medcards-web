"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { useReviewStore } from "@/stores/review-store";
import { fetchSubcategoriesWithCards } from "@/services/cards.service";

interface SubcategoryInfo {
  id: string;
  name: string;
  cardIds: string[];
  totalCards: number;
  dueCount: number;
}

interface CategoryInfo {
  id: string;
  name: string;
  subcategories: SubcategoryInfo[];
  totalDue: number;
}

export default function StudySelectorPage() {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const { getDueCount } = useReviewStore();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const subcatsWithCards = await fetchSubcategoriesWithCards();
        if (cancelled) return;

        // Group by category
        const catMap = new Map<string, CategoryInfo>();

        for (const sub of subcatsWithCards) {
          const dueCount = getDueCount(sub.cardIds);
          const existing = catMap.get(sub.category_id);

          const subInfo: SubcategoryInfo = {
            id: sub.id,
            name: sub.name,
            cardIds: sub.cardIds,
            totalCards: sub.totalCards,
            dueCount,
          };

          if (existing) {
            existing.subcategories.push(subInfo);
            existing.totalDue += dueCount;
          } else {
            catMap.set(sub.category_id, {
              id: sub.category_id,
              name: sub.categoryName,
              subcategories: [subInfo],
              totalDue: dueCount,
            });
          }
        }

        const cats = Array.from(catMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        if (!cancelled) {
          setCategories(cats);
          // Auto-expand first category that has due cards
          const firstWithDue = cats.find(c => c.totalDue > 0);
          if (firstWithDue) {
            setExpandedIds(new Set([firstWithDue.id]));
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [getDueCount]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="page-transition flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Link
          href="/"
          className="rounded-lg bg-[#1a1a2e] p-2 text-[#a0a0a0] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-white">Escolher categoria</h1>
          <p className="text-xs text-[#a0a0a0]">Selecione o que estudar</p>
        </div>
      </div>

      {/* Study all button */}
      <div className="px-4 mb-4">
        <Link
          href="/study/all"
          data-testid="study-all-btn"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#252a4a] border border-[#e94560]/30 py-3.5 text-sm font-semibold text-[#e94560]"
        >
          <BookOpen className="h-4 w-4" />
          Estudar tudo
        </Link>
      </div>

      {/* Category list */}
      <div className="flex flex-col gap-2 px-4 pb-8">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-[#1a1a2e] animate-pulse" />
          ))
        ) : (
          categories.map(cat => {
            const isExpanded = expandedIds.has(cat.id);
            return (
              <div key={cat.id} className="overflow-hidden rounded-xl bg-[#1a1a2e]">
                {/* Category row */}
                <div className="flex items-center">
                  <button
                    onClick={() => toggleExpanded(cat.id)}
                    className="flex flex-1 items-center gap-3 px-4 py-3.5"
                  >
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white">{cat.name}</p>
                      <p className="text-[10px] text-[#a0a0a0]">
                        {cat.subcategories.length} subcategorias
                      </p>
                    </div>
                    {cat.totalDue > 0 && (
                      <span className="rounded-full bg-[#e94560]/20 px-2 py-0.5 text-xs font-semibold text-[#e94560]">
                        {cat.totalDue}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[#666]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#666]" />
                    )}
                  </button>

                  {/* Study category button */}
                  <Link
                    href={`/study/${cat.id}`}
                    data-testid={`study-category-${cat.id}`}
                    className="flex items-center pr-4 pl-2 py-3.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="rounded-lg bg-[#e94560]/20 px-3 py-1.5 text-xs font-semibold text-[#e94560]">
                      Estudar
                    </span>
                  </Link>
                </div>

                {/* Subcategories */}
                {isExpanded && (
                  <div className="border-t border-[#252a4a]">
                    {cat.subcategories.map(sub => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-3 border-b border-[#252a4a]/50 px-4 py-2.5 last:border-b-0"
                      >
                        <div className="flex-1">
                          <p className="text-xs text-white">{sub.name}</p>
                          <p className="text-[10px] text-[#a0a0a0]">{sub.totalCards} cards</p>
                        </div>
                        {sub.dueCount > 0 ? (
                          <span className="text-[10px] font-semibold text-[#e94560]">
                            {sub.dueCount} pendentes
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#666]">em dia</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
