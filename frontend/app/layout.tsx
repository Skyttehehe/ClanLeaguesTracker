import type { Metadata } from "next";

import "./globals.css";
import ThemeToggle from "./theme-toggle";
import { TimeFormatProvider } from "@/lib/time-format-context";

export const metadata: Metadata = {
  title: "Clan Leagues Tracker",
  description: "Check whether a player is in a clan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(() => { try { const stored = localStorage.getItem('theme'); const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; const theme = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light'); if (theme === 'dark') { document.documentElement.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); } } catch (_) {} })();",
          }}
        />
        <TimeFormatProvider>
          <ThemeToggle />
          {children}
        </TimeFormatProvider>
      </body>
    </html>
  );
}
