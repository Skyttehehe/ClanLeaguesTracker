"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type TimeFormat = "12h" | "24h";

type TimeFormatContextType = {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
};

const TimeFormatContext = createContext<TimeFormatContextType>({
  timeFormat: "12h",
  setTimeFormat: () => undefined,
});

const detectSystemFormat = (): TimeFormat => {
  try {
    const sample = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date());
    return /AM|PM/i.test(sample) ? "12h" : "24h";
  } catch {
    return "12h";
  }
};

export function TimeFormatProvider({ children }: { children: ReactNode }) {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>("12h");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("timeFormat") as TimeFormat | null;
      if (stored === "12h" || stored === "24h") {
        setTimeFormatState(stored);
      } else {
        setTimeFormatState(detectSystemFormat());
      }
    } catch {
      setTimeFormatState(detectSystemFormat());
    }
  }, []);

  const setTimeFormat = (format: TimeFormat) => {
    setTimeFormatState(format);
    try {
      localStorage.setItem("timeFormat", format);
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <TimeFormatContext.Provider value={{ timeFormat, setTimeFormat }}>
      {children}
    </TimeFormatContext.Provider>
  );
}

export function useTimeFormat() {
  return useContext(TimeFormatContext);
}

export function formatTime(date: Date, format: TimeFormat): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: format === "12h",
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
  }).format(date);
}
