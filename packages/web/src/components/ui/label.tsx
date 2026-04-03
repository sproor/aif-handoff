import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => {
    return (
      <label
        className={cn("text-xs font-medium text-foreground tracking-wide", className)}
        ref={ref}
        {...props}
      >
        {children}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
    );
  },
);
Label.displayName = "Label";

export { Label };
