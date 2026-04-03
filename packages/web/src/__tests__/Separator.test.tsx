import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Separator } from "@/components/ui/separator";

describe("Separator", () => {
  it("renders horizontal by default", () => {
    render(<Separator />);
    const el = screen.getByRole("separator");
    expect(el).toHaveClass("h-px", "w-full");
  });

  it("renders vertical variant", () => {
    render(<Separator orientation="vertical" />);
    const el = screen.getByRole("separator");
    expect(el).toHaveClass("w-px", "h-full");
  });

  it("has role separator", () => {
    render(<Separator />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("has aria-orientation horizontal by default", () => {
    render(<Separator />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("has aria-orientation vertical when vertical", () => {
    render(<Separator orientation="vertical" />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical");
  });
});
