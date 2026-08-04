"use client";

import { useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { fetchLeaderboard } from "@/services/ranking.service";
import type { LeaderboardEntry } from "@/types";

function getMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

const podiumColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

export default function RankingPage() {
  const { user } = useAuthStore();
  const currentUserId = user?.id;

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [fallback, setFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      const result = await fetchLeaderboard(currentUserId);
      if (cancelled) return;
      setLeaderboard(result.leaderboard);
      setFallback(result.fallback);
      if (result.error) setError(result.error);
      setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [currentUserId]);

  const userEntry = leaderboard.find((e) => e.user_id === currentUserId);

  return (
    <div className="page-transition flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4">
        <Trophy className="h-5 w-5 text-[#ff9f43]" />
        <h1 className="text-xl font-bold text-white">Ranking</h1>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#e94560]" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && leaderboard.length === 0 && (
        <div className="mx-4 rounded-xl bg-[#1a1a2e] p-6 text-center">
          <p className="text-sm text-[#a0a0a0]">{error}</p>
        </div>
      )}

      {/* Fallback notice */}
      {!isLoading && fallback && leaderboard.length > 0 && (
        <div className="mx-4 mb-3 rounded-xl bg-[#1a1a2e] px-4 py-3">
          <p className="text-center text-xs text-[#a0a0a0]">
            Ranking global disponível em breve. Mostrando seus dados.
          </p>
        </div>
      )}

      {!isLoading && leaderboard.length > 0 && (
        <>
          {/* Your position card */}
          {userEntry && (
            <div className="mx-4 mb-4 rounded-xl bg-[#252a4a] p-4">
              <p className="text-xs text-[#a0a0a0]">Sua posição</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-2xl font-bold text-[#e94560]">
                  #{userEntry.rank}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-white">
                    {userEntry.display_name}
                  </span>
                  <span className="text-xs text-[#00d9ff]">
                    {userEntry.points.toLocaleString()} pts
                  </span>
                </div>
                <div className="text-right text-[10px] text-[#a0a0a0]">
                  <p>{userEntry.cards_done} cards</p>
                  {userEntry.best_streak > 0 && (
                    <p>melhor dia: {userEntry.best_streak}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard table */}
          <div className="flex flex-col px-4 pb-8">
            <div className="rounded-xl bg-[#1a1a2e] overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-2 border-b border-[#252a4a] px-4 py-2 text-[10px] font-semibold text-[#666]">
                <span className="w-8">#</span>
                <span className="flex-1">Jogador</span>
                <span className="w-14 text-right">Cards</span>
                <span className="w-16 text-right">Pontos</span>
              </div>

              {/* Rows */}
              {leaderboard.map((entry) => {
                const isCurrentUser = entry.user_id === currentUserId;

                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-2 border-b border-[#252a4a]/30 px-4 py-2.5 last:border-b-0 ${
                      isCurrentUser ? "bg-[#e94560]/10" : ""
                    }`}
                  >
                    {/* Rank */}
                    <span className="w-8 text-center text-xs font-bold">
                      {entry.rank <= 3 ? (
                        <span className="text-sm">{getMedal(entry.rank)}</span>
                      ) : (
                        <span className="text-[#a0a0a0]">{entry.rank}</span>
                      )}
                    </span>

                    {/* Avatar */}
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{
                        backgroundColor:
                          entry.rank <= 3
                            ? podiumColors[entry.rank - 1]
                            : "#252a4a",
                      }}
                    >
                      {getInitial(entry.display_name)}
                    </div>

                    {/* Name */}
                    <span
                      className={`flex-1 truncate text-xs ${
                        isCurrentUser
                          ? "font-bold text-[#e94560]"
                          : "text-white"
                      }`}
                    >
                      {entry.display_name}
                      {isCurrentUser && " (você)"}
                    </span>

                    {/* Cards */}
                    <span className="w-14 text-right text-xs text-[#a0a0a0]">
                      {entry.cards_done}
                    </span>

                    {/* Points */}
                    <span className="w-16 text-right text-xs font-semibold text-[#00d9ff]">
                      {entry.points.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Empty state when no stats yet */}
      {!isLoading && !error && leaderboard.length === 0 && (
        <div className="mx-4 rounded-xl bg-[#1a1a2e] p-8 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-[#ff9f43]/50" />
          <p className="text-sm text-[#a0a0a0]">
            Nenhum dado de ranking ainda.
          </p>
          <p className="mt-1 text-xs text-[#666]">
            Estude cards para aparecer aqui!
          </p>
        </div>
      )}
    </div>
  );
}
