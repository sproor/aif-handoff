import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Spinner } from "@/components/ui/spinner";

describe("Spinner", () => {
  it("renders with animate-spin class", () => {
    render(<Spinner />);
    const el = screen.getByRole("status");
    expect(el).toHaveClass("animate-spin");
  });

  it("has aria-label Loading", () => {
    render(<Spinner />);
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("has role status", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("applies sm size variant", () => {
    render(<Spinner size="sm" />);
    const el = screen.getByRole("status");
    expect(el).toHaveClass("h-3", "w-3");
  });

  it("applies default size variant", () => {
    render(<Spinner />);
    const el = screen.getByRole("status");
    expect(el).toHaveClass("h-4", "w-4");
  });

  it("applies lg size variant", () => {
    render(<Spinner size="lg" />);
    const el = screen.getByRole("status");
    expect(el).toHaveClass("h-6", "w-6");
  });
});
