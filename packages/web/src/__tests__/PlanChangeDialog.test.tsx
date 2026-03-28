import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanChangeDialog } from "@/components/task/PlanChangeDialog";

const defaultProps = {
  open: true,
  mode: "replanning" as const,
  comment: "",
  onCommentChange: vi.fn(),
  files: [] as File[],
  onFilesChange: vi.fn(),
  isSubmitting: false,
  error: null,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe("PlanChangeDialog", () => {
  it("should render replanning mode title and placeholder", () => {
    render(<PlanChangeDialog {...defaultProps} />);
    expect(screen.getByText("Request Replanning")).toBeDefined();
    expect(
      screen.getByPlaceholderText("Describe what needs to be changed in the plan..."),
    ).toBeDefined();
  });

  it("should render fast_fix mode title", () => {
    render(<PlanChangeDialog {...defaultProps} mode="fast_fix" />);
    expect(screen.getByText("Fast Fix")).toBeDefined();
    expect(screen.getByText("Apply fast fix")).toBeDefined();
  });

  it("should render request_changes mode title", () => {
    render(<PlanChangeDialog {...defaultProps} mode="request_changes" />);
    expect(screen.getByText("Request Changes")).toBeDefined();
    expect(screen.getByText("Request changes")).toBeDefined();
  });

  it("should call onCommentChange when typing", () => {
    const onCommentChange = vi.fn();
    render(<PlanChangeDialog {...defaultProps} onCommentChange={onCommentChange} />);
    fireEvent.change(
      screen.getByPlaceholderText("Describe what needs to be changed in the plan..."),
      { target: { value: "test" } },
    );
    expect(onCommentChange).toHaveBeenCalledWith("test");
  });

  it("should disable submit when comment is empty", () => {
    render(<PlanChangeDialog {...defaultProps} comment="" />);
    const sendBtn = screen.getByText("Send");
    expect(sendBtn.closest("button")!.hasAttribute("disabled")).toBe(true);
  });

  it("should enable submit when comment has text", () => {
    const onSubmit = vi.fn();
    render(<PlanChangeDialog {...defaultProps} comment="fix this" onSubmit={onSubmit} />);
    const sendBtn = screen.getByText("Send");
    expect(sendBtn.closest("button")!.hasAttribute("disabled")).toBe(false);
    fireEvent.click(sendBtn);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("should show loading state when submitting", () => {
    render(<PlanChangeDialog {...defaultProps} isSubmitting />);
    expect(screen.getByText("Submitting replanning request...")).toBeDefined();
    expect(screen.getByText("Sending...")).toBeDefined();
  });

  it("should show fast_fix loading text", () => {
    render(<PlanChangeDialog {...defaultProps} mode="fast_fix" isSubmitting />);
    expect(screen.getByText("Applying fast fix to current plan...")).toBeDefined();
  });

  it("should show error message", () => {
    render(<PlanChangeDialog {...defaultProps} error="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("should call onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<PlanChangeDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("should show file list when files are provided", () => {
    const files = [new File(["a"], "doc.txt", { type: "text/plain" })];
    Object.defineProperty(files[0], "size", { value: 42 });
    render(<PlanChangeDialog {...defaultProps} files={files} />);
    expect(screen.getByText(/doc\.txt/)).toBeDefined();
  });
});
