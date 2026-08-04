"use client";

interface StatsCardProps {
  label: string;
  value: string | number;
  color?: string;
}

export function StatsCard({ label, value, color = "#ffffff" }: StatsCardProps) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-[#1a1a2e] p-4">
      <span className="text-xs font-medium text-[#a0a0a0]">{label}</span>
      <span
        className="mt-1 text-2xl font-bold"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}
