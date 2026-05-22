// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrendingUp } from "lucide-react";

import { SidebarItem } from "../SidebarItem";

describe("<SidebarItem /> — disabled", () => {
  it("renders a non-link element with aria-disabled='true' and disabled token classes", () => {
    render(<SidebarItem icon={TrendingUp} label="Найм" disabled />);

    const labelNode = screen.getByText("Найм");
    expect(labelNode.tagName).not.toBe("A");

    const disabledHost = screen.getByText("Найм").closest('[aria-disabled="true"]');
    expect(disabledHost).not.toBeNull();
    expect(disabledHost?.tagName).toBe("DIV");
    expect(disabledHost?.className).toMatch(/text-disabled-text/);
    expect(disabledHost?.className).toMatch(/cursor-not-allowed/);

    expect(screen.queryByRole("link", { name: /Найм/ })).toBeNull();
  });
});

describe("<SidebarItem /> — link", () => {
  it("renders a next/link <a> when not disabled and href is provided", () => {
    render(
      <SidebarItem icon={TrendingUp} label="Продажи" href="/sales" />,
    );

    const link = screen.getByRole("link", { name: /Продажи/ });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/sales");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("marks aria-current='page' when active is true", () => {
    render(
      <SidebarItem
        icon={TrendingUp}
        label="Продажи"
        href="/sales"
        active
      />,
    );

    const link = screen.getByRole("link", { name: /Продажи/ });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toMatch(/text-accent-primary/);
    const wrapper = link.parentElement;
    expect(wrapper?.className).toMatch(/bg-accent-soft/);
  });
});

describe("<SidebarItem /> — collapsed mode", () => {
  it("hides the label text and exposes a tooltip via title attr", () => {
    render(
      <SidebarItem
        icon={TrendingUp}
        label="Продажи"
        href="/sales"
        collapsed
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("title", "Продажи");
    expect(screen.queryByText("Продажи")).toBeNull();
  });
});

describe("<SidebarItem /> — expandable chevron", () => {
  it("renders a chevron toggle button only when expandable, not collapsed, and onExpandToggle is provided", () => {
    const onExpandToggle = vi.fn();
    render(
      <SidebarItem
        icon={TrendingUp}
        label="Продажи"
        href="/sales"
        expandable
        expanded={false}
        onExpandToggle={onExpandToggle}
      />,
    );

    const button = screen.getByRole("button", { name: /Развернуть «Продажи»/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("invokes onExpandToggle when the chevron is clicked", async () => {
    const onExpandToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <SidebarItem
        icon={TrendingUp}
        label="Продажи"
        href="/sales"
        expandable
        expanded={false}
        onExpandToggle={onExpandToggle}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Развернуть/ }));
    expect(onExpandToggle).toHaveBeenCalledTimes(1);
  });

  it("flips aria-expanded and the accessible label when expanded=true", () => {
    render(
      <SidebarItem
        icon={TrendingUp}
        label="Продажи"
        href="/sales"
        expandable
        expanded
        onExpandToggle={() => {}}
      />,
    );

    const button = screen.getByRole("button", { name: /Свернуть «Продажи»/ });
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("does not render the chevron when collapsed even if expandable", () => {
    render(
      <SidebarItem
        icon={TrendingUp}
        label="Продажи"
        href="/sales"
        collapsed
        expandable
        expanded
        onExpandToggle={() => {}}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Свернуть|Развернуть/ }),
    ).toBeNull();
  });
});
