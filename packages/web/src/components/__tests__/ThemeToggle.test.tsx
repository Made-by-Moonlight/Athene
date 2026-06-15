import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type * as ReactType from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

const mockSetTheme = vi.fn();
let mockResolvedTheme = "dark";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: mockResolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

// Bypass the mounted guard by mocking useState
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof ReactType>("react");
  return {
    ...actual,
    useState: (init: unknown) => {
      // Return true for the `mounted` state so the component renders immediately
      if (init === false) return [true, vi.fn()];
      return actual.useState(init);
    },
  };
});

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockResolvedTheme = "dark";
  });

  it("renders a button", () => {
    const { getByRole } = render(<ThemeToggle />);
    expect(getByRole("button")).toBeInTheDocument();
  });

  it("cycles dark → aurora on click", () => {
    mockResolvedTheme = "dark";
    const { getByRole } = render(<ThemeToggle />);
    fireEvent.click(getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("aurora");
  });

  it("cycles aurora → light on click", () => {
    mockResolvedTheme = "aurora";
    const { getByRole } = render(<ThemeToggle />);
    fireEvent.click(getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("cycles light → dark on click", () => {
    mockResolvedTheme = "light";
    const { getByRole } = render(<ThemeToggle />);
    fireEvent.click(getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("shows the correct aria-label for each theme", () => {
    const cases: Array<[string, string]> = [
      ["dark", "Switch to aurora mode"],
      ["aurora", "Switch to light mode"],
      ["light", "Switch to dark mode"],
    ];
    for (const [theme, label] of cases) {
      mockResolvedTheme = theme;
      const { getByRole, unmount } = render(<ThemeToggle />);
      expect(getByRole("button").getAttribute("aria-label")).toBe(label);
      unmount();
    }
  });

  it("accepts a custom className", () => {
    const { getByRole } = render(<ThemeToggle className="custom-class" />);
    expect(getByRole("button").className).toBe("custom-class");
  });

  it("renders an optional label", () => {
    const { getByText } = render(<ThemeToggle label="Theme" />);
    expect(getByText("Theme")).toBeInTheDocument();
  });
});
