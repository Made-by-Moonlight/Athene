"use client";

import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";

interface ThemeToggleProps {
  className?: string;
  label?: string;
}

const CYCLE: Record<string, string> = {
  dark: "aurora",
  aurora: "light",
  light: "dark",
};

const ICONS: Record<string, ReactNode> = {
  dark: (
    // Sun icon — switching away from dark
    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  aurora: (
    // Aurora / stars icon — switching away from aurora
    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 3C8 3 4 6 4 10c0 3 1.5 5.5 4 7l1 4h6l1-4c2.5-1.5 4-4 4-7 0-4-4-7-8-7z" />
      <path d="M9 17h6" />
    </svg>
  ),
  light: (
    // Moon icon — switching away from light
    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
};

const LABELS: Record<string, string> = {
  dark: "aurora",
  aurora: "light",
  light: "dark",
};

export function ThemeToggle({ className, label }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={className ?? "h-9 w-9"} />;

  const theme = resolvedTheme ?? "dark";
  const next = CYCLE[theme] ?? "dark";

  return (
    <button
      onClick={() => setTheme(next)}
      className={
        className ??
        "flex h-9 w-9 items-center justify-center border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-elevated-hover)]"
      }
      aria-label={`Switch to ${LABELS[theme] ?? "dark"} mode`}
      title={`Switch to ${LABELS[theme] ?? "dark"} mode`}
    >
      {ICONS[theme] ?? ICONS.dark}
      {label ? <span>{label}</span> : null}
    </button>
  );
}
