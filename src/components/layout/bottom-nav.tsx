"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BookOpen, FolderOpen, Search, Trophy, User } from "lucide-react";

const tabs = [
  { label: "Estudar", icon: BookOpen, href: "/" },
  { label: "Pastas", icon: FolderOpen, href: "/decks" },
  { label: "Buscar", icon: Search, href: "/search" },
  { label: "Ranking", icon: Trophy, href: "/ranking" },
  { label: "Perfil", icon: User, href: "/profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#252a4a] bg-[#1a1a2e] safe-area-bottom">
      <div className="mx-auto flex max-w-[430px] items-center justify-around">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-[#e94560]" : "text-[#666]"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
