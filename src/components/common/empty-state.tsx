"use client";

interface EmptyStateProps {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ emoji, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <span className="text-5xl">{emoji}</span>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      {subtitle && (
        <p className="mt-2 text-sm text-[#a0a0a0]">{subtitle}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 rounded-lg bg-[#e94560] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#e94560]/80"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
