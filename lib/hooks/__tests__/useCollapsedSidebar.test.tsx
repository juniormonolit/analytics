// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useCollapsedSidebar } from "../useCollapsedSidebar";

const STORAGE_KEY = "bi.sidebar.collapsed";

/**
 * Tiny consumer component that exposes the hook's surface to the DOM so the
 * tests can introspect state via `data-collapsed` and trigger transitions
 * through real user interactions.
 */
function CollapsedConsumer() {
  const { collapsed, toggle, setCollapsed } = useCollapsedSidebar();
  return (
    <div>
      <span data-testid="state" data-collapsed={collapsed ? "true" : "false"}>
        {collapsed ? "collapsed" : "expanded"}
      </span>
      <button type="button" onClick={toggle}>
        toggle
      </button>
      <button type="button" onClick={() => setCollapsed(true)}>
        set-true
      </button>
      <button type="button" onClick={() => setCollapsed(false)}>
        set-false
      </button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("useCollapsedSidebar()", () => {
  it("defaults to expanded (collapsed === false) when localStorage is empty", () => {
    render(<CollapsedConsumer />);
    expect(screen.getByTestId("state")).toHaveAttribute(
      "data-collapsed",
      "false",
    );
    expect(screen.getByTestId("state")).toHaveTextContent("expanded");
  });

  it("toggle() flips state and persists 'true'/'false' to localStorage under the canonical key", async () => {
    const user = userEvent.setup();
    render(<CollapsedConsumer />);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    await user.click(screen.getByText("toggle"));

    expect(screen.getByTestId("state")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");

    await user.click(screen.getByText("toggle"));

    expect(screen.getByTestId("state")).toHaveAttribute(
      "data-collapsed",
      "false",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
  });

  it("setCollapsed(true) persists collapsed state", async () => {
    const user = userEvent.setup();
    render(<CollapsedConsumer />);

    await user.click(screen.getByText("set-true"));

    expect(screen.getByTestId("state")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("setCollapsed(false) persists expanded state", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, "true");
    render(<CollapsedConsumer />);

    await user.click(screen.getByText("set-false"));

    expect(screen.getByTestId("state")).toHaveAttribute(
      "data-collapsed",
      "false",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
  });

  it("hydrates from a pre-existing 'true' in localStorage on initial render", () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    render(<CollapsedConsumer />);
    expect(screen.getByTestId("state")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
  });

  it("propagates updates across tabs via the 'storage' event", () => {
    render(<CollapsedConsumer />);

    expect(screen.getByTestId("state")).toHaveAttribute(
      "data-collapsed",
      "false",
    );

    act(() => {
      window.localStorage.setItem(STORAGE_KEY, "true");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: "true",
          oldValue: null,
          storageArea: window.localStorage,
        }),
      );
    });

    expect(screen.getByTestId("state")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
  });

  it("ignores 'storage' events for unrelated keys", () => {
    render(<CollapsedConsumer />);

    act(() => {
      window.localStorage.setItem("some.other.key", "true");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "some.other.key",
          newValue: "true",
          oldValue: null,
        }),
      );
    });

    expect(screen.getByTestId("state")).toHaveAttribute(
      "data-collapsed",
      "false",
    );
  });
});
