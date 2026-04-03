import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Icon } from "@/components/ui/icon";
import { Star } from "lucide-react";

describe("Icon", () => {
  it("renders the icon component", () => {
    const { container } = render(<Icon icon={Star} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies xs size variant", () => {
    const { container } = render(<Icon icon={Star} size="xs" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-3", "w-3");
  });

  it("applies sm size variant", () => {
    const { container } = render(<Icon icon={Star} size="sm" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-3.5", "w-3.5");
  });

  it("applies default size variant", () => {
    const { container } = render(<Icon icon={Star} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-4", "w-4");
  });

  it("applies lg size variant", () => {
    const { container } = render(<Icon icon={Star} size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-5", "w-5");
  });

  it("merges custom className", () => {
    const { container } = render(<Icon icon={Star} className="text-red-500" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("text-red-500");
  });
});
