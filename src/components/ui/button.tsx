import type { ComponentProps } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("button", {
  variants: {
    variant: {
      default: "button-primary",
      outline: "button-outline",
      ghost: "button-ghost",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Button({
  className,
  variant = "default",
  ...props
}: ComponentProps<"button"> & { variant?: "default" | "outline" | "ghost" }) {
  return <button className={cn(variants({ variant }), className)} {...props} />;
}
