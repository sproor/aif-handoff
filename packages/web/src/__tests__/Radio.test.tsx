import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Radio } from "@/components/ui/radio";

describe("Radio", () => {
  it("renders a radio input", () => {
    render(<Radio aria-label="Option A" />);
    const radio = screen.getByRole("radio", { name: "Option A" });
    expect(radio).toBeInTheDocument();
    expect(radio).toHaveAttribute("type", "radio");
  });

  it("is unchecked by default", () => {
    render(<Radio aria-label="Option A" />);
    expect(screen.getByRole("radio", { name: "Option A" })).not.toBeChecked();
  });

  it("renders as checked when checked prop is true", () => {
    render(<Radio aria-label="Option A" checked readOnly />);
    expect(screen.getByRole("radio", { name: "Option A" })).toBeChecked();
  });

  it("renders as disabled", () => {
    render(<Radio aria-label="Option A" disabled />);
    expect(screen.getByRole("radio", { name: "Option A" })).toBeDisabled();
  });

  it("calls onChange handler", () => {
    const handleChange = vi.fn();
    render(<Radio aria-label="Option A" onChange={handleChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Option A" }));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("merges custom className", () => {
    render(<Radio aria-label="Option A" className="extra" />);
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveClass("extra");
    expect(screen.getByRole("radio", { name: "Option A" })).toHaveClass("h-4");
  });
});
