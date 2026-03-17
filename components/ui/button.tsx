"use client";

import * as React from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
        "border border-white/10 backdrop-blur",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        "disabled:opacity-50 disabled:pointer-events-none",
        variant === "primary" &&
          "bg-white/10 hover:bg-white/15 text-white shadow-sm",
        variant === "secondary" &&
          "bg-black/20 hover:bg-black/30 text-white",
        variant === "ghost" && "bg-transparent hover:bg-white/10 text-white",
        className
      )}
      {...props}
    />
  );
}

