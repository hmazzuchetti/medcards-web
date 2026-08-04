"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Loader2, LogOut, BookOpen } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, displayName, isLoading, signOut } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const name = displayName ?? user?.email ?? "usuário";

  return (
    <div className="page-transition flex flex-col min-h-full px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold text-[#e94560]">MedCards</h1>
        <button
          onClick={handleLogout}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg bg-[#1a1a2e] px-3 py-2 text-xs font-medium text-[#a0a0a0] hover:text-white transition-colors disabled:opacity-50"
          aria-label="Sair"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          Sair
        </button>
      </div>

      {/* Welcome card */}
      <div className="rounded-2xl bg-[#1a1a2e] p-6 mb-6">
        <p className="text-sm text-[#a0a0a0] mb-1">Bem-vindo,</p>
        <h2 className="text-2xl font-bold text-white truncate">{name}</h2>
      </div>

      {/* Placeholder content — Etapa 1 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center py-12">
        <div className="rounded-full bg-[#1a1a2e] p-6">
          <BookOpen className="h-12 w-12 text-[#e94560]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Em construção
          </h3>
          <p className="text-sm text-[#a0a0a0] max-w-xs">
            O conteúdo de estudo estará disponível na próxima etapa. A
            autenticação está funcionando!
          </p>
        </div>

        {user && (
          <div className="mt-4 rounded-xl bg-[#252a4a] px-4 py-3 text-left w-full">
            <p className="text-[10px] font-mono text-[#666] mb-1">
              Sessão ativa
            </p>
            <p className="text-xs text-[#a0a0a0] truncate">{user.email}</p>
          </div>
        )}
      </div>
    </div>
  );
}
