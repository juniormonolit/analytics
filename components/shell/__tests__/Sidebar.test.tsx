// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/sales/by-managers"),
  redirect: vi.fn(),
}));

import { usePathname } from "next/navigation";

import { Sidebar } from "../Sidebar";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

function renderSidebar(
  options: { collapsed?: boolean; onToggle?: () => void } = {},
) {
  return render(
    <ThemeProvider>
      <Sidebar
        collapsed={options.collapsed ?? false}
        onToggle={options.onToggle ?? (() => {})}
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/sales/by-managers");
});

describe("<Sidebar /> — main sections", () => {
  it("renders all four main section labels in Russian", () => {
    renderSidebar();

    for (const label of ["Найм", "Маркетинг", "Продажи", "Реализация"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders disabled sections (Найм, Маркетинг, Реализация) as aria-disabled, non-link rows", () => {
    renderSidebar();

    for (const label of ["Найм", "Маркетинг", "Реализация"]) {
      const labelNode = screen.getByText(label);
      const disabledHost = labelNode.closest('[aria-disabled="true"]');
      expect(disabledHost).not.toBeNull();
      expect(disabledHost?.tagName).toBe("DIV");
    }

    expect(screen.queryByRole("link", { name: /Найм/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Маркетинг/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Реализация/ })).toBeNull();
  });

  it("highlights the active 'Продажи' section when the pathname is inside /sales", () => {
    renderSidebar();

    const salesLink = screen.getByRole("link", { name: /^Продажи$/ });
    expect(salesLink).toHaveAttribute("aria-current", "page");
    expect(salesLink.className).toMatch(/text-accent-primary/);

    const wrapper = salesLink.parentElement;
    expect(wrapper?.className).toMatch(/bg-accent-soft/);
  });
});

describe("<Sidebar /> — Sales submenu", () => {
  it("auto-expands the Sales submenu when the URL is in /sales/*", () => {
    renderSidebar();

    expect(screen.getByText("По менеджерам")).toBeInTheDocument();
    expect(screen.getByText("По товарным группам")).toBeInTheDocument();
  });

  it("exposes the active sub-report with aria-current='page'", () => {
    renderSidebar();

    const activeSubLink = screen.getByRole("link", { name: "По менеджерам" });
    expect(activeSubLink).toHaveAttribute("aria-current", "page");

    const inactiveSubLink = screen.getByRole("link", {
      name: "По товарным группам",
    });
    expect(inactiveSubLink).not.toHaveAttribute("aria-current");
  });

  it("collapses the submenu when the chevron is clicked, and re-expands on a second click", async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByText("По менеджерам")).toBeInTheDocument();

    const chevron = screen.getByRole("button", {
      name: /Свернуть «Продажи»/,
    });

    await user.click(chevron);

    expect(screen.queryByText("По менеджерам")).toBeNull();
    expect(screen.queryByText("По товарным группам")).toBeNull();

    const reChevron = screen.getByRole("button", {
      name: /Развернуть «Продажи»/,
    });
    await user.click(reChevron);

    expect(screen.getByText("По менеджерам")).toBeInTheDocument();
    expect(screen.getByText("По товарным группам")).toBeInTheDocument();
  });

  it("does not auto-expand the Sales submenu when the URL is outside /sales", () => {
    vi.mocked(usePathname).mockReturnValue("/");

    renderSidebar();

    expect(screen.queryByText("По менеджерам")).toBeNull();
    expect(screen.queryByText("По товарным группам")).toBeNull();
  });
});

describe("<Sidebar /> — chrome", () => {
  it("renders the brand label when expanded", () => {
    renderSidebar();
    expect(screen.getByText("Смекалочная")).toBeInTheDocument();
  });

  it("renders the collapse toggle with the correct aria-label and aria-pressed when expanded", () => {
    renderSidebar();
    const toggle = screen.getByRole("button", { name: "Свернуть меню" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the collapse toggle with the correct aria-label and aria-pressed when collapsed", () => {
    renderSidebar({ collapsed: true });
    const toggle = screen.getByRole("button", { name: "Развернуть меню" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onToggle when the collapse toggle is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderSidebar({ onToggle });

    await user.click(screen.getByRole("button", { name: "Свернуть меню" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the theme toggle", () => {
    renderSidebar();
    expect(
      screen.getByRole("button", {
        name: /Включить (тёмную|светлую) тему/,
      }),
    ).toBeInTheDocument();
  });

  it("renders the Настройки entry as a link at the bottom", () => {
    renderSidebar();
    const settingsLink = screen.getByRole("link", { name: /Настройки/ });
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });
});

describe("<Sidebar /> — collapsed mode", () => {
  it("hides the brand label, the section text labels, and the submenu when collapsed", () => {
    renderSidebar({ collapsed: true });

    expect(screen.queryByText("Смекалочная")).toBeNull();
    expect(screen.queryByText("Продажи")).toBeNull();
    expect(screen.queryByText("По менеджерам")).toBeNull();
  });

  it("still exposes section icons via the title attribute on the Sales link", () => {
    renderSidebar({ collapsed: true });
    const salesLink = screen.getByRole("link", { name: "Продажи" });
    expect(salesLink).toHaveAttribute("title", "Продажи");
  });
});

describe("<Sidebar /> — nav structure", () => {
  it("wraps the section list in a nav with aria-label='Разделы'", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Разделы" });
    expect(nav).toBeInTheDocument();
    // The top-level <ul> inside this nav must contain exactly four direct
    // section <li>'s; report sub-<li>'s are nested inside the Sales <li>.
    const topUl = nav.querySelector(":scope > ul");
    expect(topUl).not.toBeNull();
    const directLis = topUl?.querySelectorAll(":scope > li") ?? [];
    expect(directLis.length).toBe(4);
  });
});
