"use client";

import { Trophy } from "lucide-react";
import type { LeaderboardEntry } from "@/types";

// --- Mock Data ---
const CURRENT_USER_ID = "user-me";

function generateMockLeaderboard(): LeaderboardEntry[] {
  const names = [
    "Ana Silva", "Carlos Mendes", "Juliana Costa", "Pedro Almeida",
    "Mariana Souza", "Lucas Oliveira", "Beatriz Santos", "Rafael Lima",
    "Fernanda Rocha", "Gustavo Reis", "Camila Araújo", "Thiago Nascimento",
    "Isabela Ferreira", "Rodrigo Barbosa", "Larissa Cardoso", "Bruno Correia",
    "Amanda Dias", "Diego Moreira", "Patrícia Nunes", "Felipe Vieira",
    "Letícia Gomes", "Mateus Ribeiro", "Gabriela Martins", "André Pereira",
    "Natália Carvalho", "Henrique Teixeira", "Vanessa Freitas", "Leonardo Campos",
    "Renata Farias", "Vinícius Monteiro", "Carolina Ramos", "Eduardo Castro",
    "Priscila Pinto", "Marcos Duarte", "Daniela Lopes", "José Melo",
    "Aline Azevedo", "Paulo Borges", "Tatiana Cruz", "Roberto Cunha",
    "Cristina Fontes", "Wagner Guedes", "Débora Henrique", "Fábio Jardim",
    "Sandra Lacerda", "Antônio Machado", "Elaine Nogueira", "Sérgio Ortega",
    "Cláudia Pacheco", "Alexandre Queiroz",
  ];

  return names.map((name, i) => ({
    rank: i + 1,
    user_id: i === 7 ? CURRENT_USER_ID : `user-${i}`,
    display_name: name,
    avatar_url: null,
    points: Math.max(50, 5000 - i * 95 + Math.floor(Math.random() * 30)),
    cards_done: Math.max(10, 800 - i * 15 + Math.floor(Math.random() * 20)),
    best_streak: Math.max(1, 60 - i + Math.floor(Math.random() * 5)),
  }));
}

const MOCK_LEADERBOARD = generateMockLeaderboard();

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
  const userEntry = MOCK_LEADERBOARD.find((e) => e.user_id === CURRENT_USER_ID);

  return (
    <div className="page-transition flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4">
        <Trophy className="h-5 w-5 text-[#ff9f43]" />
        <h1 className="text-xl font-bold text-white">Ranking</h1>
      </div>

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
              <p>{userEntry.best_streak}d sequência</p>
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
            <span className="w-10 text-right">Seq.</span>
            <span className="w-16 text-right">Pontos</span>
          </div>

          {/* Rows */}
          {MOCK_LEADERBOARD.map((entry) => {
            const isCurrentUser = entry.user_id === CURRENT_USER_ID;

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

                {/* Streak */}
                <span className="w-10 text-right text-xs text-[#a0a0a0]">
                  {entry.best_streak}d
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
    </div>
  );
}
