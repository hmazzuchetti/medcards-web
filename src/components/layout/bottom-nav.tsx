"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, FolderOpen, Search, Trophy, User } from "lucide-react";

const tabs = [
  { label: "Estudar", icon: BookOpen, href: "/" },
  { label: "Pastas", icon: FolderOpen, href: "/decks" },
  { label: "Buscar", icon: Search, href: "/search" },
  { label: "Ranking", icon: Trophy, href: "/ranking" },
  { label: "Perfil", icon: User, href: "/profile" },
] as const;

const STUDY_PREFIXES = ["/study"];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#252a4a] bg-[#1a1a2e] safe-area-bottom">
      <div className="mx-auto flex max-w-[430px] items-center justify-around">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/" || STUDY_PREFIXES.some(p => pathname.startsWith(p))
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors"
              style={{ color: isActive ? "#e94560" : "#666" }}
            >
              {/* Sliding background indicator */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-x-1 top-0 h-0.5 rounded-full bg-[#e94560]"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
