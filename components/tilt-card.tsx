"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

const MAX_DEG = 8;

/**
 * A card that leans toward the mouse with light catching it, like a card in
 * Apple Wallet. Mouse only: a finger has no hover, and a phone already tilts.
 * The transform is written straight onto the element, not through a CSS
 * variable on a parent, so nothing else restyles while the pointer moves.
 */
export function TiltCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const glare = useRef<HTMLDivElement>(null);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = card.current!;
    const box = el.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    el.style.transition = "transform 80ms linear";
    el.style.transform = `perspective(800px) rotateX(${(0.5 - y) * 2 * MAX_DEG}deg) rotateY(${(x - 0.5) * 2 * MAX_DEG}deg)`;
    glare.current!.style.opacity = "1";
    glare.current!.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgb(255 255 255 / 0.28), transparent 55%)`;
  }

  function leave() {
    card.current!.style.transition = "transform 450ms cubic-bezier(0.23, 1, 0.32, 1)";
    card.current!.style.transform = "";
    glare.current!.style.opacity = "0";
  }

  return (
    <div ref={card} onPointerMove={move} onPointerLeave={leave} className={cn("will-change-transform", className)}>
      {children}
      <div
        ref={glare}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 ease-out"
      />
    </div>
  );
}
