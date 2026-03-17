"use client";

import * as React from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { cn } from "./cn";

export function AuroraBackground({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn(
        "relative min-h-dvh w-full overflow-hidden bg-zinc-950",
        className
      )}
    >
      <LazyMotion features={domAnimation} strict>
        <div className="pointer-events-none absolute inset-0">
          <m.div
            aria-hidden
            className="absolute -top-24 left-1/2 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full blur-3xl will-change-transform"
            style={{
              background:
                "radial-gradient(closest-side, rgba(56,189,248,0.25), rgba(56,189,248,0) 70%)"
            }}
            animate={
              reduce ? undefined : { x: ["-10%", "10%", "-10%"], opacity: [0.7, 1, 0.7] }
            }
            transition={
              reduce ? undefined : { duration: 12, repeat: Infinity, ease: "easeInOut" }
            }
          />
          <m.div
            aria-hidden
            className="absolute top-40 left-1/4 h-[26rem] w-[40rem] rounded-full blur-3xl will-change-transform"
            style={{
              background:
                "radial-gradient(closest-side, rgba(167,139,250,0.22), rgba(167,139,250,0) 70%)"
            }}
            animate={
              reduce ? undefined : { y: ["-8%", "8%", "-8%"], opacity: [0.6, 0.95, 0.6] }
            }
            transition={
              reduce ? undefined : { duration: 14, repeat: Infinity, ease: "easeInOut" }
            }
          />
          <m.div
            aria-hidden
            className="absolute bottom-24 right-0 h-[30rem] w-[42rem] rounded-full blur-3xl will-change-transform"
            style={{
              background:
                "radial-gradient(closest-side, rgba(34,197,94,0.18), rgba(34,197,94,0) 70%)"
            }}
            animate={
              reduce ? undefined : { x: ["8%", "-6%", "8%"], opacity: [0.55, 0.85, 0.55] }
            }
            transition={
              reduce ? undefined : { duration: 16, repeat: Infinity, ease: "easeInOut" }
            }
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_45%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.2),rgba(0,0,0,0.85))]" />
        </div>
      </LazyMotion>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

