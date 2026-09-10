"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface StatsCardProps {
  label: string;
  value: string | number;
  color?: string;
  delay?: number;
  testId?: string;
}

function AnimatedNumber({ target, color, testId }: { target: number; color: string; testId?: string }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const duration = 600;

  useEffect(() => {
    const start = () => {
      startRef.current = performance.now();
      const step = (now: number) => {
        const elapsed = now - (startRef.current ?? now);
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * target));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };

    start();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return (
    <span className="mt-1 text-2xl font-bold" style={{ color }} data-testid={testId}>
      {display}
    </span>
  );
}

export function StatsCard({ label, value, color = "#ffffff", delay = 0, testId }: StatsCardProps) {
  const isNumber = typeof value === "number";

  return (
    <motion.div
      className="flex flex-col items-center rounded-xl bg-[#1a1a2e] p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay }}
    >
      <span className="text-xs font-medium text-[#a0a0a0]">{label}</span>
      {isNumber ? (
        <AnimatedNumber target={value as number} color={color} testId={testId} />
      ) : (
        <span className="mt-1 text-2xl font-bold" style={{ color }} data-testid={testId}>
          {value}
        </span>
      )}
    </motion.div>
  );
}
