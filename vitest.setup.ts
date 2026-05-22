/**
 * Vitest setup — runs before every test file.
 *
 * Test convention for this project:
 *   - Place tests under `__tests__/` directories next to the source they cover.
 *   - File names: `*.test.ts` for plain TS, `*.test.tsx` for React components.
 *   - Use Vitest globals (`describe`, `it`, `expect`) — `test.globals: true` is on.
 *   - Use jsdom for DOM-dependent tests (default environment).
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("server-only", () => ({}));

process.env.ORG_SUPABASE_URL ??= "https://test-org.supabase.co";
process.env.ORG_SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

function orgQueryChain(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const method of ["select", "in", "eq", "order"]) {
    chain[method] = () => chain;
  }
  chain.then = (
    onFulfilled?: (value: typeof result) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

vi.mock("@/lib/org/client", () => ({
  createOrgServerClient: () => ({
    from: () => orgQueryChain(),
  }),
}));

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  if (typeof document !== "undefined") {
    delete document.documentElement.dataset.theme;
  }
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});

afterEach(() => {
  cleanup();
});
