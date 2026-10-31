import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "@/components/portfolio/reveal";

describe("Reveal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders its children and starts pending when IntersectionObserver exists", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(<Reveal>Hello</Reveal>);
    expect(screen.getByText("Hello")).toHaveAttribute("data-reveal", "pending");
  });

  it("becomes visible when the element intersects", () => {
    let trigger: (entries: Array<{ isIntersecting: boolean }>) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: typeof trigger) {
          trigger = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    render(<Reveal>Hello</Reveal>);
    // act() is handled by Testing Library's async utilities for state updates outside events.
    return vi.waitFor(() => {
      trigger([{ isIntersecting: true }]);
      expect(screen.getByText("Hello")).toHaveAttribute("data-reveal", "visible");
    });
  });

  it("falls back to visible when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Reveal>Hello</Reveal>);
    await waitFor(() => expect(screen.getByText("Hello")).toHaveAttribute("data-reveal", "visible"));
  });
});
