"use client";

import * as React from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from "./cn";

export function WavyBackground({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative min-h-dvh w-full overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-0">
        <m.div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 20% 10%, rgba(56,189,248,0.16), transparent 45%), radial-gradient(circle at 70% 30%, rgba(167,139,250,0.14), transparent 50%), radial-gradient(circle at 40% 80%, rgba(34,197,94,0.10), transparent 55%)",
            willChange: "opacity"
          }}
          animate={reduce ? undefined : { opacity: [0.55, 0.85, 0.55] }}
          transition={
            reduce ? undefined : { duration: 10, repeat: Infinity, ease: "easeInOut" }
          }
        />

        <svg
          className="absolute -bottom-24 left-0 h-[28rem] w-[120%] opacity-35"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <path
            fill="rgba(255,255,255,0.08)"
            d="M0,224L48,202.7C96,181,192,139,288,144C384,149,480,203,576,213.3C672,224,768,192,864,176C960,160,1056,160,1152,181.3C1248,203,1344,245,1392,266.7L1440,288L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>

        <m.div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(circle at 50% 30%, rgba(0,0,0,1), rgba(0,0,0,0) 65%)",
            willChange: "opacity"
          }}
          animate={reduce ? undefined : { opacity: [0.12, 0.22, 0.12] }}
          transition={
            reduce ? undefined : { duration: 8, repeat: Infinity, ease: "easeInOut" }
          }
        />

        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35),rgba(0,0,0,0.88))]" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

