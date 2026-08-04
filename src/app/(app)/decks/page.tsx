"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";

// --- Mock Data ---
interface MockSubcategory {
  id: string;
  name: string;
  cardCount: number;
  dueCount: number;
  enabled: boolean;
  newCardsPerDay: number;
}

interface MockCategory {
  id: string;
  name: string;
  icon: string;
  subcategories: MockSubcategory[];
}

const INITIAL_CATEGORIES: MockCategory[] = [
  {
    id: "c1",
    name: "Neurologia",
    icon: "🧠",
    subcategories: [
      { id: "s1", name: "Anatomia do SNC", cardCount: 45, dueCount: 8, enabled: true, newCardsPerDay: 20 },
      { id: "s2", name: "Neurofisiologia", cardCount: 62, dueCount: 0, enabled: true, newCardsPerDay: 15 },
      { id: "s3", name: "Neuropatologias", cardCount: 38, dueCount: 12, enabled: false, newCardsPerDay: 20 },
    ],
  },
  {
    id: "c2",
    name: "Cardiologia",
    icon: "❤️",
    subcategories: [
      { id: "s4", name: "Anatomia Cardíaca", cardCount: 30, dueCount: 5, enabled: true, newCardsPerDay: 20 },
      { id: "s5", name: "Arritmias", cardCount: 55, dueCount: 0, enabled: true, newCardsPerDay: 10 },
      { id: "s6", name: "Valvulopatias", cardCount: 28, dueCount: 3, enabled: true, newCardsPerDay: 20 },
    ],
  },
  {
    id: "c3",
    name: "Farmacologia",
    icon: "💊",
    subcategories: [
      { id: "s7", name: "Farmacocinética", cardCount: 40, dueCount: 0, enabled: false, newCardsPerDay: 20 },
      { id: "s8", name: "Antibióticos", cardCount: 72, dueCount: 15, enabled: false, newCardsPerDay: 20 },
      { id: "s9", name: "Anti-hipertensivos", cardCount: 35, dueCount: 0, enabled: false, newCardsPerDay: 20 },
    ],
  },
];

export default function DecksPage() {
  const [categories, setCategories] = useState<MockCategory[]>(INITIAL_CATEGORIES);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["c1"]));

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCategoryAll = useCallback((categoryId: string, enabled: boolean) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              subcategories: cat.subcategories.map((sub) => ({
                ...sub,
                enabled,
              })),
            }
          : cat
      )
    );
  }, []);

  const toggleSubcategory = useCallback((subcategoryId: string) => {
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        subcategories: cat.subcategories.map((sub) =>
          sub.id === subcategoryId ? { ...sub, enabled: !sub.enabled } : sub
        ),
      }))
    );
  }, []);

  const changeNewCards = useCallback((subcategoryId: string, delta: number) => {
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        subcategories: cat.subcategories.map((sub) =>
          sub.id === subcategoryId
            ? { ...sub, newCardsPerDay: Math.max(0, Math.min(999, sub.newCardsPerDay + delta)) }
            : sub
        ),
      }))
    );
  }, []);

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
        {categories.map((category) => {
          const isExpanded = expandedIds.has(category.id);
          const enabledCount = category.subcategories.filter((s) => s.enabled).length;
          const allEnabled = enabledCount === category.subcategories.length;
          const totalDue = category.subcategories.reduce((sum, s) => sum + s.dueCount, 0);

          return (
            <div key={category.id} className="overflow-hidden rounded-xl bg-[#1a1a2e]">
              {/* Category Header */}
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => toggleExpanded(category.id)}
                  className="flex flex-1 items-center gap-3"
                >
                  <span className="text-xl">{category.icon}</span>
                  <div className="flex flex-1 flex-col items-start">
                    <span className="text-sm font-semibold text-white">
                      {category.name}
                    </span>
                    <span className="text-[10px] text-[#a0a0a0]">
                      {enabledCount}/{category.subcategories.length} ativas
                      {totalDue > 0 && (
                        <span className="ml-2 text-[#e94560]">
                          {totalDue} pendentes
                        </span>
                      )}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-[#666]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[#666]" />
                  )}
                </button>

                {/* Toggle all */}
                <button
                  onClick={() => toggleCategoryAll(category.id, !allEnabled)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    allEnabled
                      ? "bg-[#e94560]/20 text-[#e94560]"
                      : "bg-[#252a4a] text-[#666]"
                  }`}
                >
                  {allEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {/* Subcategories */}
              {isExpanded && (
                <div className="border-t border-[#252a4a]">
                  {category.subcategories.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 border-b border-[#252a4a]/50 px-4 py-3 last:border-b-0"
                    >
                      {/* Toggle */}
                      <button
                        onClick={() => toggleSubcategory(sub.id)}
                        className={`h-5 w-9 rounded-full transition-colors ${
                          sub.enabled ? "bg-[#e94560]" : "bg-[#252a4a]"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full bg-white transition-transform ${
                            sub.enabled ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>

                      {/* Name & info */}
                      <div className="flex flex-1 flex-col">
                        <span
                          className={`text-sm ${
                            sub.enabled ? "text-white" : "text-[#666]"
                          }`}
                        >
                          {sub.name}
                        </span>
                        <div className="flex gap-2 text-[10px]">
                          <span className="text-[#a0a0a0]">
                            {sub.cardCount} cards
                          </span>
                          {sub.dueCount > 0 && (
                            <span className="text-[#e94560]">
                              {sub.dueCount} pendentes
                            </span>
                          )}
                        </div>
                      </div>

                      {/* New cards stepper */}
                      {sub.enabled && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => changeNewCards(sub.id, -5)}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-[#252a4a] text-[#a0a0a0] active:bg-[#252a4a]/70"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-medium text-white">
                            {sub.newCardsPerDay}
                          </span>
                          <button
                            onClick={() => changeNewCards(sub.id, 5)}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-[#252a4a] text-[#a0a0a0] active:bg-[#252a4a]/70"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
