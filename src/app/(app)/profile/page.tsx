"use client";

import { useState, useCallback } from "react";
import { Trophy, LogOut, Pencil, Check, X, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { StatsCard } from "@/components/common/stats-card";

// --- Mock Data ---
const MOCK_USER = {
  id: "user-me",
  displayName: "Rafael Lima",
  email: "rafael.lima@email.com",
  avatarUrl: null as string | null,
  syncStatus: "synced" as "synced" | "pending" | "offline",
};

const MOCK_STATS = {
  today: 23,
  streak: 14,
  learned: 342,
  total: 1250,
  points: 2840,
  averageEase: 2.65,
};

function getEaseColor(ease: number): string {
  if (ease >= 3.0) return "#00c853";
  if (ease >= 2.5) return "#00d9ff";
  if (ease >= 2.0) return "#ff9f43";
  return "#e94560";
}

function getEaseLabel(ease: number): string {
  if (ease >= 3.0) return "Excelente";
  if (ease >= 2.5) return "Bom";
  if (ease >= 2.0) return "Regular";
  return "Difícil";
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState(MOCK_USER.displayName);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleSaveName = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed.length >= 2 && trimmed.length <= 30) {
      setDisplayName(trimmed);
      setIsEditing(false);
    }
  }, [editValue]);

  const handleCancelEdit = useCallback(() => {
    setEditValue(displayName);
    setIsEditing(false);
  }, [displayName]);

  const syncIcon =
    MOCK_USER.syncStatus === "synced" ? (
      <Wifi className="h-3.5 w-3.5 text-[#00c853]" />
    ) : (
      <WifiOff className="h-3.5 w-3.5 text-[#ff9f43]" />
    );

  const syncLabel =
    MOCK_USER.syncStatus === "synced"
      ? "Sincronizado"
      : MOCK_USER.syncStatus === "pending"
        ? "Sincronizando..."
        : "Offline";

  return (
    <div className="page-transition flex flex-col pb-8">
      {/* Header */}
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-white">Perfil</h1>
      </div>

      {/* Avatar & name */}
      <div className="flex flex-col items-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e94560] text-3xl font-bold text-white">
          {getInitial(displayName)}
        </div>

        {/* Name */}
        {isEditing ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 w-40 rounded-lg bg-[#252a4a] px-3 text-center text-sm text-white outline-none focus:ring-1 focus:ring-[#e94560]/50"
              maxLength={30}
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00c853]/20 text-[#00c853]"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e94560]/20 text-[#e94560]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditValue(displayName);
              setIsEditing(true);
            }}
            className="mt-3 flex items-center gap-1.5 text-lg font-semibold text-white"
          >
            {displayName}
            <Pencil className="h-3.5 w-3.5 text-[#666]" />
          </button>
        )}

        {/* Email */}
        <p className="mt-1 text-xs text-[#a0a0a0]">{MOCK_USER.email}</p>

        {/* Sync status */}
        <div className="mt-2 flex items-center gap-1.5">
          {syncIcon}
          <span className="text-[10px] text-[#a0a0a0]">{syncLabel}</span>
        </div>
      </div>

      {/* Points card */}
      <Link
        href="/ranking"
        className="mx-4 mt-6 flex items-center gap-3 rounded-xl bg-[#1a1a2e] p-4"
      >
        <Trophy className="h-8 w-8 text-[#ff9f43]" />
        <div className="flex flex-1 flex-col">
          <span className="text-xs text-[#a0a0a0]">Seus pontos</span>
          <span className="text-xl font-bold text-[#00d9ff]">
            {MOCK_STATS.points.toLocaleString()}
          </span>
        </div>
        <span className="text-xs text-[#666]">Ver ranking →</span>
      </Link>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-4">
        <StatsCard label="Hoje" value={MOCK_STATS.today} color="#e94560" />
        <StatsCard label="Sequência" value={`${MOCK_STATS.streak}d`} color="#ff9f43" />
        <StatsCard label="Aprendidos" value={MOCK_STATS.learned} color="#00d9ff" />
        <StatsCard label="Total" value={MOCK_STATS.total} color="#2979ff" />
      </div>

      {/* Average ease */}
      <div className="mx-4 mt-4 rounded-xl bg-[#1a1a2e] p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#a0a0a0]">Facilidade média</span>
          <span
            className="text-xs font-medium"
            style={{ color: getEaseColor(MOCK_STATS.averageEase) }}
          >
            {getEaseLabel(MOCK_STATS.averageEase)}
          </span>
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span
            className="text-2xl font-bold"
            style={{ color: getEaseColor(MOCK_STATS.averageEase) }}
          >
            {MOCK_STATS.averageEase.toFixed(2)}
          </span>
          <span className="mb-0.5 text-xs text-[#666]">/ 4.00</span>
        </div>
        {/* Ease bar */}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#252a4a]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(MOCK_STATS.averageEase / 4) * 100}%`,
              backgroundColor: getEaseColor(MOCK_STATS.averageEase),
            }}
          />
        </div>
      </div>

      {/* Logout */}
      <div className="mt-8 px-4">
        {showLogoutConfirm ? (
          <div className="rounded-xl bg-[#1a1a2e] p-4">
            <p className="text-center text-sm text-white">
              Tem certeza que deseja sair?
            </p>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-lg bg-[#252a4a] py-2.5 text-sm font-medium text-[#a0a0a0] transition-colors hover:bg-[#252a4a]/70"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  // Will connect to Supabase auth signOut
                  setShowLogoutConfirm(false);
                }}
                className="flex-1 rounded-lg bg-[#e94560] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#e94560]/80"
              >
                Sair
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a1a2e] py-3 text-sm font-medium text-[#e94560] transition-colors hover:bg-[#e94560]/10"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        )}
      </div>
    </div>
  );
}
