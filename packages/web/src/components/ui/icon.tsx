import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const iconVariants = cva("rounded-none", {
  variants: {
    size: {
      xs: "h-3 w-3",
      sm: "h-3.5 w-3.5",
      default: "h-4 w-4",
      lg: "h-5 w-5",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface IconProps extends VariantProps<typeof iconVariants> {
  icon: React.ElementType;
  className?: string;
}

function Icon({ icon: IconComponent, size, className }: IconProps) {
  return <IconComponent className={cn(iconVariants({ size }), className)} />;
}

export { Icon, iconVariants };
