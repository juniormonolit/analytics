import type { Metadata } from "next";
import "./globals.css";

import { AppShellGate } from "@/components/shell/AppShellGate";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { inlineThemeScript } from "@/lib/theme/inlineThemeScript";

export const metadata: Metadata = {
  title: "Смекалочная",
  description: "Смекалочная: аналитика продаж, отчёты, drill down.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Pre-hydration theme bootstrap — must run before React mounts to avoid FOUC. */}
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: inlineThemeScript }}
        />
      </head>
      <body className="h-screen overflow-hidden bg-bg-primary text-text-primary antialiased">
        <ThemeProvider>
          <QueryProvider>
            <AppShellGate>{children}</AppShellGate>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
