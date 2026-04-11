"use client";

import { useEffect, useState } from "react";
import { useTimeFormat, type TimeFormat } from "@/lib/time-format-context";

type ThemeMode = "light" | "dark";

const applyTheme = (theme: ThemeMode): void => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const { timeFormat, setTimeFormat } = useTimeFormat();

  useEffect(() => {
    const stored = localStorage.getItem("theme") as ThemeMode | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      applyTheme(stored);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const detected: ThemeMode = media.matches ? "dark" : "light";
    setTheme(detected);
    applyTheme(detected);

    const onChange = (event: MediaQueryListEvent) => {
      if (localStorage.getItem("theme")) {
        return;
      }
      const next: ThemeMode = event.matches ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("theme", next);
  };

  const toggleTimeFormat = () => {
    const next: TimeFormat = timeFormat === "12h" ? "24h" : "12h";
    setTimeFormat(next);
  };

  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
      <button
        type="button"
        onClick={toggleTimeFormat}
        title={timeFormat === "12h" ? "Switch to 24-hour format" : "Switch to 12-hour format"}
        aria-label="Toggle time format"
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-vscode-border dark:bg-vscode-surface dark:text-slate-100 dark:hover:bg-vscode-raised"
      >
        {timeFormat === "12h" ? "12h" : "24h"}
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle dark mode"
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-vscode-border dark:bg-vscode-surface dark:text-slate-100 dark:hover:bg-vscode-raised"
      >
        {theme === "dark" ? "Dark" : "Light"}
      </button>
    </div>
  );
}
