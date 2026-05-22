"use client";

/**
 * App-wide TanStack Query provider.
 *
 * Mounted between `<ThemeProvider>` and `<AppShell>` so every client
 * subtree can use `useQuery`. The default `staleTime` of 5 minutes
 * matches the catalog endpoints (teams, metrics) which we expect to
 * change far less often than the user navigates.
 *
 * `QueryClient` is created lazily on first render via `useState` so
 * each browser tab keeps a stable instance across re-renders, and
 * server renders never accidentally share a client between requests.
 */
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FIVE_MINUTES_MS,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
