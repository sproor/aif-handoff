import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  it("renders a checkbox input", () => {
    render(<Checkbox aria-label="Accept" />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept" });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("type", "checkbox");
  });

  it("is unchecked by default", () => {
    render(<Checkbox aria-label="Accept" />);
    expect(screen.getByRole("checkbox", { name: "Accept" })).not.toBeChecked();
  });

  it("renders as checked when checked prop is true", () => {
    render(<Checkbox aria-label="Accept" checked readOnly />);
    expect(screen.getByRole("checkbox", { name: "Accept" })).toBeChecked();
  });

  it("renders as disabled", () => {
    render(<Checkbox aria-label="Accept" disabled />);
    expect(screen.getByRole("checkbox", { name: "Accept" })).toBeDisabled();
  });

  it("calls onChange handler", () => {
    const handleChange = vi.fn();
    render(<Checkbox aria-label="Accept" onChange={handleChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Accept" }));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("merges custom className", () => {
    render(<Checkbox aria-label="Accept" className="extra" />);
    expect(screen.getByRole("checkbox", { name: "Accept" })).toHaveClass("extra");
    expect(screen.getByRole("checkbox", { name: "Accept" })).toHaveClass("h-4");
  });
});
