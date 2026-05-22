// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/sales/by-managers"),
  redirect: vi.fn(),
}));

import { usePathname } from "next/navigation";

import { ReportTabs } from "../ReportTabs";

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/sales/by-managers");
});

describe("<ReportTabs />", () => {
  it("renders both report tabs as next/link <a> with the canonical hrefs", () => {
    render(<ReportTabs />);

    const byManagers = screen.getByRole("link", { name: "По менеджерам" });
    const byProductGroups = screen.getByRole("link", {
      name: "По товарным группам",
    });

    expect(byManagers.tagName).toBe("A");
    expect(byProductGroups.tagName).toBe("A");

    expect(byManagers).toHaveAttribute("href", "/sales/by-managers");
    expect(byProductGroups).toHaveAttribute("href", "/sales/by-product-groups");
  });

  it("marks the tab matching the current pathname with aria-current='page'", () => {
    render(<ReportTabs />);

    const byManagers = screen.getByRole("link", { name: "По менеджерам" });
    const byProductGroups = screen.getByRole("link", {
      name: "По товарным группам",
    });

    expect(byManagers).toHaveAttribute("aria-current", "page");
    expect(byProductGroups).not.toHaveAttribute("aria-current");
  });

  it("flips aria-current when the pathname switches to the other report", () => {
    vi.mocked(usePathname).mockReturnValue("/sales/by-product-groups");
    render(<ReportTabs />);

    const byManagers = screen.getByRole("link", { name: "По менеджерам" });
    const byProductGroups = screen.getByRole("link", {
      name: "По товарным группам",
    });

    expect(byProductGroups).toHaveAttribute("aria-current", "page");
    expect(byManagers).not.toHaveAttribute("aria-current");
  });

  it("highlights neither tab when the pathname is outside /sales/*", () => {
    cleanup();
    vi.mocked(usePathname).mockReturnValue("/marketing");
    render(<ReportTabs />);

    expect(
      screen.getByRole("link", { name: "По менеджерам" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("link", { name: "По товарным группам" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("wraps the tabs in a nav with aria-label='Отчёты раздела'", () => {
    render(<ReportTabs />);
    expect(
      screen.getByRole("navigation", { name: "Отчёты раздела" }),
    ).toBeInTheDocument();
  });
});
