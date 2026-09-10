"use client";

import { BottomNav } from "./bottom-nav";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#16213e]">
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col safe-area-top">
        <main className="flex flex-1 flex-col pb-16">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
