import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-text text-bg hover:opacity-80 active:opacity-70",
  secondary: "border border-border-strong text-text hover:border-text active:opacity-70",
  ghost: "text-muted hover:text-text active:opacity-70",
};

/** Shared by <Button> and link-styled buttons so both look identical. */
export function buttonClasses(variant: ButtonVariant = "primary", className?: string): string {
  return cn(
    "inline-flex h-11 items-center justify-center rounded-base px-4 text-sm font-medium",
    "transition-[color,border-color,opacity] duration-(--duration-hover) ease-(--ease-out)",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
