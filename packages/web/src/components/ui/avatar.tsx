import { cva, type VariantProps } from "class-variance-authority";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground border border-border",
  {
    variants: {
      size: {
        sm: "h-6 w-6 text-[10px]",
        default: "h-8 w-8 text-xs",
        lg: "h-10 w-10 text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const iconSizeMap = {
  sm: "h-3 w-3",
  default: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name?: string;
  className?: string;
}

function Avatar({ name, size, className }: AvatarProps) {
  return (
    <div className={cn(avatarVariants({ size }), className)}>
      {name ? (
        <span className="font-medium leading-none">{name.charAt(0).toUpperCase()}</span>
      ) : (
        <User className={iconSizeMap[size ?? "default"]} />
      )}
    </div>
  );
}

export { Avatar, avatarVariants };
