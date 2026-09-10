"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { Search as SearchIcon, X, ChevronDown, ChevronUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { SEARCH_MIN_CHARS, SEARCH_DEBOUNCE_MS } from "@/config/theme";
import { createClient } from "@/lib/supabase/client";
import { CardContentRenderer } from "@/components/common/card-content-renderer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  front: string;
  back: string;
  extra: string | null;
  subcategoryId: string;
  subcategoryName: string;
  categoryId: string;
  categoryName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function searchCards(query: string): Promise<SearchResult[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cards")
    .select(`
      id, front, back, extra,
      subcategories!inner(
        id, name,
        categories!inner(id, name)
      )
    `)
    .or(`front.ilike.%${query}%,back.ilike.%${query}%,subcategories.name.ilike.%${query}%,subcategories.categories.name.ilike.%${query}%`)
    .eq("is_active", true)
    .limit(30);

  if (error) {
    console.error("searchCards error:", error);
    // fallback: search only front/back
    const { data: fallback, error: fallbackError } = await supabase
      .from("cards")
      .select("id, front, back, extra, subcategories(id, name, category_id, categories(id, name))")
      .or(`front.ilike.%${query}%,back.ilike.%${query}%`)
      .eq("is_active", true)
      .limit(30);

    if (fallbackError || !fallback) return [];

    return (fallback ?? []).map((row: Record<string, unknown>) => {
      const sub = row.subcategories as { id: string; name: string; category_id: string; categories?: { id: string; name: string } } | null;
      return {
        id: row.id as string,
        front: row.front as string,
        back: row.back as string,
        extra: (row.extra as string | null) ?? null,
        subcategoryId: sub?.id ?? "",
        subcategoryName: sub?.name ?? "",
        categoryId: sub?.category_id ?? "",
        categoryName: sub?.categories?.name ?? "",
      };
    });
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const sub = row.subcategories as { id: string; name: string; categories?: { id: string; name: string } } | null;
    return {
      id: row.id as string,
      front: row.front as string,
      back: row.back as string,
      extra: (row.extra as string | null) ?? null,
      subcategoryId: sub?.id ?? "",
      subcategoryName: sub?.name ?? "",
      categoryId: (sub?.categories as { id?: string })?.id ?? "",
      categoryName: sub?.categories?.name ?? "",
    };
  });
}

// ─── Card Result Item ─────────────────────────────────────────────────────────

function SearchResultCard({ result }: { result: SearchResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="w-full text-left rounded-xl border-l-4 border-l-[#e94560] bg-[#1a1a2e] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          {result.subcategoryName && (
            <span className="inline-block rounded-md bg-[#252a4a] px-2 py-0.5 text-[10px] text-[#666] mb-2">
              {result.subcategoryName}
            </span>
          )}
          <div className="text-sm font-medium text-white">
            <CardContentRenderer html={result.front} />
          </div>
        </div>
        <div className="shrink-0 mt-1 text-[#666]">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expanded answer */}
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
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < SEARCH_MIN_CHARS) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    try {
      const found = await searchCards(q);
      setResults(found);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Run initial search if URL has ?q=
  useEffect(() => {
    if (initialQ.length >= SEARCH_MIN_CHARS) {
      doSearch(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

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
          placeholder="Pesquisar cards..."
          className="h-10 w-full rounded-xl bg-[#252a4a] pl-10 pr-10 text-sm text-white placeholder:text-[#666] outline-none focus:ring-1 focus:ring-[#e94560]/50"
          autoFocus={!!initialQ}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-[#666]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="mt-4 flex flex-col gap-2 px-4 pb-8">
        {isSearching && (
          <p className="text-center text-xs text-[#a0a0a0]">Buscando...</p>
        )}

        {!isSearching && hasSearched && results.length > 0 && (
          <>
            <p className="text-xs text-[#a0a0a0]">
              {results.length} resultado{results.length !== 1 ? "s" : ""}
            </p>
            {results.map((r) => (
              <SearchResultCard key={r.id} result={r} />
            ))}
          </>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-4xl">🔍</span>
            <p className="mt-3 text-sm text-[#a0a0a0]">
              Nenhum resultado encontrado
            </p>
          </div>
        )}

        {!isSearching && !hasSearched && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-4xl">💡</span>
            <p className="mt-3 text-sm text-[#a0a0a0]">
              Digite pelo menos {SEARCH_MIN_CHARS} caracteres para buscar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="page-transition flex flex-col">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-white">Buscar</h1>
        </div>
      </div>
    }>
      <SearchInner />
    </Suspense>
  );
}
