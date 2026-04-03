import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Avatar } from "@/components/ui/avatar";

describe("Avatar", () => {
  it("shows initial from name", () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("uppercases the initial", () => {
    render(<Avatar name="bob" />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("shows User icon when no name", () => {
    const { container } = render(<Avatar />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies sm size variant", () => {
    const { container } = render(<Avatar name="X" size="sm" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("h-6", "w-6");
  });

  it("applies default size variant", () => {
    const { container } = render(<Avatar name="X" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("h-8", "w-8");
  });

  it("applies lg size variant", () => {
    const { container } = render(<Avatar name="X" size="lg" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("h-10", "w-10");
  });
});
