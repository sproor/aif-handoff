import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "@/components/ui/label";

describe("Label", () => {
  it("renders children text", () => {
    render(<Label>Username</Label>);
    expect(screen.getByText("Username")).toBeInTheDocument();
  });

  it("renders a <label> element", () => {
    render(<Label>Email</Label>);
    expect(screen.getByText("Email").tagName).toBe("LABEL");
  });

  it("shows red asterisk when required", () => {
    render(<Label required>Password</Label>);
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("*")).toHaveClass("text-destructive");
  });

  it("does not show asterisk when not required", () => {
    render(<Label>Optional field</Label>);
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("passes htmlFor prop to the label element", () => {
    render(<Label htmlFor="email-input">Email</Label>);
    expect(screen.getByText("Email")).toHaveAttribute("for", "email-input");
  });

  it("merges custom className", () => {
    render(<Label className="custom-class">Name</Label>);
    expect(screen.getByText("Name")).toHaveClass("custom-class");
    expect(screen.getByText("Name")).toHaveClass("text-xs");
  });
});
