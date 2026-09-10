"use client";

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from "react";
import { Search as SearchIcon, X, ChevronDown, ChevronUp, BookOpen, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SEARCH_MIN_CHARS, SEARCH_DEBOUNCE_MS } from "@/config/theme";
import { createClient } from "@/lib/supabase/client";
import { CardContentRenderer } from "@/components/common/card-content-renderer";
import { fetchSubcategoriesWithCards, type SubcategoryWithCards } from "@/services/cards.service";
import { useReviewStore } from "@/stores/review-store";
import { bucketOf, formatDays, MS_PER_DAY } from "@/lib/scheduler";
import type { CardReview } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  front: string;
  back: string;
  extra: string | null;
  subcategoryId: string;
  subcategoryName: string;
  categoryName: string;
}

interface SearchQuery {
  text: string;
  subcategoryIds: string[] | null;
  offset: number;
  limit: number;
}

const PAGE_SIZE = 50;

// ─── Data ─────────────────────────────────────────────────────────────────────

function escapeLike(value: string): string {
  return value.replace(/[%_,()]/g, " ").trim();
}

async function searchCards(q: SearchQuery): Promise<{ results: SearchResult[]; total: number }> {
  const supabase = createClient();

  let query = supabase
    .from("cards")
    .select("id, front, back, extra, subcategory_id, subcategories(id, name, categories(id, name))", { count: "exact" })
    .eq("is_active", true);

  if (q.subcategoryIds) {
    if (q.subcategoryIds.length === 0) return { results: [], total: 0 };
    query = query.in("subcategory_id", q.subcategoryIds);
  }

  const text = escapeLike(q.text);
  if (text.length >= SEARCH_MIN_CHARS) {
    query = query.or(`front.ilike.%${text}%,back.ilike.%${text}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: true })
    .range(q.offset, q.offset + q.limit - 1);

  if (error) {
    console.error("searchCards error:", error);
    return { results: [], total: 0 };
  }

  const results = (data ?? []).map((row: Record<string, unknown>) => {
    const sub = row.subcategories as { id: string; name: string; categories?: { id: string; name: string } | null } | null;
    return {
      id: row.id as string,
      front: row.front as string,
      back: row.back as string,
      extra: (row.extra as string | null) ?? null,
      subcategoryId: (row.subcategory_id as string) ?? sub?.id ?? "",
      subcategoryName: sub?.name ?? "",
      categoryName: sub?.categories?.name ?? "",
    };
  });

  return { results, total: count ?? results.length };
}

// ─── Card state badge ─────────────────────────────────────────────────────────

function StateBadge({ review, now }: { review: CardReview | undefined; now: number }) {
  const bucket = bucketOf(review);
  if (bucket === "new") {
    return <span className="rounded-md bg-[#2979ff]/15 px-2 py-0.5 text-[10px] font-semibold text-[#2979ff]">Novo</span>;
  }
  const dueMs = new Date(review!.due).getTime() - now;
  const dueLabel = dueMs <= 0 ? "agora" : dueMs < MS_PER_DAY ? "hoje" : `em ${formatDays(dueMs / MS_PER_DAY)}`;
  if (bucket === "learning") {
    return <span className="rounded-md bg-[#e94560]/15 px-2 py-0.5 text-[10px] font-semibold text-[#e94560]">Aprendendo • {dueLabel}</span>;
  }
  return <span className="rounded-md bg-[#00c853]/15 px-2 py-0.5 text-[10px] font-semibold text-[#00c853]">Revisão • {dueLabel}</span>;
}

// ─── Card Result Item ─────────────────────────────────────────────────────────

function SearchResultCard({ result, review, now }: { result: SearchResult; review: CardReview | undefined; now: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      data-testid="search-result"
      className="w-full text-left rounded-xl border-l-4 border-l-[#e94560] bg-[#1a1a2e] overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {result.subcategoryName && (
              <span className="inline-block rounded-md bg-[#252a4a] px-2 py-0.5 text-[10px] text-[#a0a0a0]">
                {result.subcategoryName}
              </span>
            )}
            <StateBadge review={review} now={now} />
          </div>
          <div className="text-sm font-medium text-white">
            <CardContentRenderer html={result.front} />
          </div>
        </div>
        <div className="shrink-0 mt-1 text-[#666]">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#252a4a]">
          <div className="p-4 border-l-4 border-l-[#00d9ff] bg-[#16213e]">
            <p className="text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-2">Resposta</p>
            <div className="text-sm text-white">
              <CardContentRenderer html={result.back} />
            </div>
          </div>
          {result.extra && (
            <div className="p-4 border-l-4 border-l-[#9b59b6] bg-[#16213e]">
              <p className="text-[10px] uppercase tracking-widest text-[#a0a0a0] mb-2">Extra</p>
              <div className="text-sm text-white">
                <CardContentRenderer html={result.extra} />
              </div>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Inner Component (uses useSearchParams) ───────────────────────────────────

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const folderId = searchParams.get("folder");
  const categoryId = searchParams.get("category");

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [subcategories, setSubcategories] = useState<SubcategoryWithCards[] | null>(null);
  /** Timestamp of the last search, used to render "vence em X" without reading the clock during render */
  const [searchedAt, setSearchedAt] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const requestRef = useRef(0);

  const reviews = useReviewStore((s) => s.reviews);

  // Folder metadata (names + which subcategories a category filter covers)
  useEffect(() => {
    let cancelled = false;
    fetchSubcategoriesWithCards().then((subs) => {
      if (!cancelled) setSubcategories(subs);
    });
    return () => { cancelled = true; };
  }, []);

  const filter = useMemo(() => {
    if (!folderId && !categoryId) return null;
    if (subcategories === null) return undefined; // still loading
    if (folderId) {
      const sub = subcategories.find((s) => s.id === folderId);
      return { label: sub ? `Pasta: ${sub.name}` : "Pasta", ids: [folderId], studyHref: `/study/folder/${folderId}` };
    }
    const subs = subcategories.filter((s) => s.category_id === categoryId);
    return {
      label: subs[0] ? `Categoria: ${subs[0].categoryName}` : "Categoria",
      ids: subs.map((s) => s.id),
      studyHref: `/study/${categoryId}`,
    };
  }, [folderId, categoryId, subcategories]);

  const runSearch = useCallback(
    async (text: string, append: boolean) => {
      if (filter === undefined) return; // waiting for folder metadata
      const trimmed = text.trim();
      if (!filter && trimmed.length < SEARCH_MIN_CHARS) {
        setResults([]);
        setTotal(0);
        setHasSearched(false);
        return;
      }

      const requestId = ++requestRef.current;
      setIsSearching(true);
      try {
        const { results: found, total: count } = await searchCards({
          text: trimmed,
          subcategoryIds: filter ? filter.ids : null,
          offset: append ? results.length : 0,
          limit: PAGE_SIZE,
        });
        if (requestId !== requestRef.current) return;
        setResults((prev) => (append ? [...prev, ...found] : found));
        setTotal(count);
        setHasSearched(true);
        setSearchedAt(Date.now());
      } finally {
        if (requestId === requestRef.current) setIsSearching(false);
      }
    },
    [filter, results.length]
  );

  // Search on query / filter change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query, false), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter]);

  const clearFilter = () => {
    router.replace(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  };

  const hasFilter = !!filter;

  return (
    <div className="page-transition flex flex-col">
      {/* Header */}
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-white">Buscar</h1>
      </div>

      {/* Search input */}
      <div className="relative px-4">
        <SearchIcon className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={hasFilter ? "Filtrar dentro da pasta..." : "Pesquisar cards..."}
          data-testid="search-input"
          className="h-10 w-full rounded-xl bg-[#252a4a] pl-10 pr-10 text-sm text-white placeholder:text-[#666] outline-none focus:ring-1 focus:ring-[#e94560]/50"
          autoFocus={!!initialQ}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-[#666]"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Folder chip (FB-11) */}
      {(folderId || categoryId) && (
        <div className="mt-3 flex items-center gap-2 px-4">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-[#e94560]/15 px-3 py-1 text-xs font-semibold text-[#e94560]"
            data-testid="folder-chip"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {filter ? filter.label : "Pasta"}
            <button onClick={clearFilter} aria-label="Remover filtro" className="ml-1 text-[#e94560]/70 hover:text-[#e94560]">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
          {filter && (
            <Link
              href={filter.studyHref}
              data-testid="study-folder-btn"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#e94560] px-3 py-1 text-xs font-semibold text-white"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Estudar
            </Link>
          )}
        </div>
      )}

      {/* Results */}
      <div className="mt-4 flex flex-col gap-2 px-4 pb-8">
        {isSearching && results.length === 0 ? (
          [1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-[#1a1a2e]" />)
        ) : hasSearched ? (
          results.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="text-4xl">🔍</span>
              <p className="mt-3 text-sm text-[#a0a0a0]">Nenhum card encontrado</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-[#a0a0a0]" data-testid="result-count">
                {total} {total === 1 ? "card" : "cards"}
              </p>
              {results.map((r) => (
                <SearchResultCard key={r.id} result={r} review={reviews[r.id]} now={searchedAt} />
              ))}
              {results.length < total && (
                <button
                  onClick={() => runSearch(query, true)}
                  disabled={isSearching}
                  data-testid="load-more-btn"
                  className="mt-2 rounded-xl bg-[#252a4a] py-2.5 text-xs font-semibold text-[#a0a0a0] disabled:opacity-50"
                >
                  {isSearching ? "Carregando..." : `Carregar mais (${total - results.length})`}
                </button>
              )}
            </>
          )
        ) : (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-4xl">💡</span>
            <p className="mt-3 text-sm text-[#a0a0a0]">
              Digite pelo menos {SEARCH_MIN_CHARS} caracteres para buscar
            </p>
            <p className="mt-1 text-xs text-[#666]">
              Ou toque no nome de uma pasta em <Link href="/decks" className="text-[#00d9ff]">Pastas</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page (Suspense boundary for useSearchParams) ─────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="px-4 py-4 text-sm text-[#a0a0a0]">Carregando...</div>}>
      <SearchInner />
    </Suspense>
  );
}
