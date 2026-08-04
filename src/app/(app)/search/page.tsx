"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { SEARCH_MIN_CHARS, SEARCH_DEBOUNCE_MS } from "@/config/theme";

// --- Mock Data ---
interface SearchResult {
  id: string;
  front: string;
  back: string;
  subcategoryName: string;
}

const MOCK_RESULTS: SearchResult[] = [
  {
    id: "1",
    front: "<b>Qual o principal neurotransmissor excitatório do SNC?</b>",
    back: "Glutamato — age nos receptores NMDA, AMPA e Cainato.",
    subcategoryName: "Neurofisiologia",
  },
  {
    id: "2",
    front: "<b>Qual a tríade de Virchow?</b>",
    back: "Estase venosa, lesão endotelial e hipercoagulabilidade.",
    subcategoryName: "Patologia Geral",
  },
  {
    id: "3",
    front: "<b>Quais são os nervos cranianos motores puros?</b>",
    back: "III (Oculomotor), IV (Troclear), VI (Abducente), XI (Acessório) e XII (Hipoglosso).",
    subcategoryName: "Anatomia do SNC",
  },
  {
    id: "4",
    front: "<b>Qual o mecanismo de ação dos beta-bloqueadores?</b>",
    back: "Antagonismo competitivo dos receptores beta-adrenérgicos, reduzindo frequência cardíaca e contratilidade.",
    subcategoryName: "Anti-hipertensivos",
  },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback((q: string) => {
    if (q.length < SEARCH_MIN_CHARS) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const lower = q.toLowerCase();
    const filtered = MOCK_RESULTS.filter(
      (r) =>
        stripHtml(r.front).toLowerCase().includes(lower) ||
        stripHtml(r.back).toLowerCase().includes(lower)
    );
    setResults(filtered);
    setHasSearched(true);
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
        {hasSearched && results.length > 0 && (
          <>
            <p className="text-xs text-[#a0a0a0]">
              {results.length} resultado{results.length !== 1 ? "s" : ""}
            </p>

            {results.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border-l-4 border-l-[#e94560] bg-[#1a1a2e] p-4"
              >
                <p className="text-sm font-medium text-white">
                  {stripHtml(r.front)}
                </p>
                <p className="mt-1 text-xs text-[#a0a0a0] line-clamp-2">
                  {stripHtml(r.back)}
                </p>
                <span className="mt-2 inline-block rounded-md bg-[#252a4a] px-2 py-0.5 text-[10px] text-[#666]">
                  {r.subcategoryName}
                </span>
              </div>
            ))}

            <button className="mt-2 w-full rounded-xl bg-[#e94560] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e94560]/80 active:scale-[0.98]">
              Estudar resultados ({results.length})
            </button>
          </>
        )}

        {hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-4xl">🔍</span>
            <p className="mt-3 text-sm text-[#a0a0a0]">
              Nenhum resultado encontrado
            </p>
          </div>
        )}

        {!hasSearched && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-4xl">💡</span>
            <p className="mt-3 text-sm text-[#a0a0a0]">
              Digite pelo menos {SEARCH_MIN_CHARS} caracteres para buscar
            </p>
            <div className="mt-4 flex flex-col gap-1 text-xs text-[#666]">
              <p>Exemplos de busca:</p>
              <p className="text-[#a0a0a0]">&quot;neurotransmissor&quot;</p>
              <p className="text-[#a0a0a0]">&quot;tríade de Virchow&quot;</p>
              <p className="text-[#a0a0a0]">&quot;beta-bloqueador&quot;</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
