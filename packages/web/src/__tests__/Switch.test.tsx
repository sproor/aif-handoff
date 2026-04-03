import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("renders with role switch", () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole("switch", { name: "Toggle" })).toBeInTheDocument();
  });

  it("has aria-checked false by default", () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole("switch", { name: "Toggle" })).toHaveAttribute("aria-checked", "false");
  });

  it("has aria-checked true when checked", () => {
    render(<Switch aria-label="Toggle" checked />);
    expect(screen.getByRole("switch", { name: "Toggle" })).toHaveAttribute("aria-checked", "true");
  });

  it("toggles on click", () => {
    const handleChange = vi.fn();
    render(<Switch aria-label="Toggle" checked={false} onCheckedChange={handleChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Toggle" }));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("toggles off on click when checked", () => {
    const handleChange = vi.fn();
    render(<Switch aria-label="Toggle" checked onCheckedChange={handleChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Toggle" }));
    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it("does not toggle when disabled", () => {
    const handleChange = vi.fn();
    render(<Switch aria-label="Toggle" disabled onCheckedChange={handleChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Toggle" }));
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("renders sm size variant", () => {
    render(<Switch aria-label="Toggle" size="sm" />);
    const el = screen.getByRole("switch", { name: "Toggle" });
    expect(el).toHaveClass("h-4");
    expect(el).toHaveClass("w-7");
  });

  it("renders default size variant", () => {
    render(<Switch aria-label="Toggle" />);
    const el = screen.getByRole("switch", { name: "Toggle" });
    expect(el).toHaveClass("h-5");
    expect(el).toHaveClass("w-9");
  });

  it("applies checked styles", () => {
    render(<Switch aria-label="Toggle" checked />);
    expect(screen.getByRole("switch", { name: "Toggle" })).toHaveClass("bg-primary");
  });

  it("applies unchecked styles", () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole("switch", { name: "Toggle" })).toHaveClass("bg-input");
  });
});
