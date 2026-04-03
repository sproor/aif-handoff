import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const switchVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        default: "h-5 w-9",
        sm: "h-4 w-7",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const thumbVariants = cva(
  "pointer-events-none block rounded-full bg-foreground transition-transform",
  {
    variants: {
      size: {
        default: "h-3.5 w-3.5",
        sm: "h-2.5 w-2.5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface SwitchProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    VariantProps<typeof switchVariants> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, size, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    const translateClass =
      size === "sm"
        ? checked
          ? "translate-x-3.5"
          : "translate-x-0.5"
        : checked
          ? "translate-x-4.5"
          : "translate-x-0.5";

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cn(switchVariants({ size }), checked ? "bg-primary" : "bg-input", className)}
        onClick={() => onCheckedChange?.(!checked)}
        ref={ref}
        {...props}
      >
        <span className={cn(thumbVariants({ size }), translateClass)} />
      </button>
    );
  },
);
Switch.displayName = "Switch";

export { Switch, switchVariants };
