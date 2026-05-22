"use client";

import { Suspense, type ReactNode } from "react";

import { useCollapsedSidebar } from "@/lib/hooks/useCollapsedSidebar";
import { AccountBootstrap } from "@/components/auth/AccountBootstrap";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  children: ReactNode;
};

/**
 * Root chrome of the app: a two-column flex with a collapsible Sidebar on
 * the left and a `<main>` content area on the right. Owns the collapse
 * state so the layout can persist it via `useCollapsedSidebar`.
 */
export function AppShell({ children }: AppShellProps) {
  const { collapsed, toggle } = useCollapsedSidebar();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-primary">
      <AccountBootstrap />
      <Suspense fallback={null}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </Suspense>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
