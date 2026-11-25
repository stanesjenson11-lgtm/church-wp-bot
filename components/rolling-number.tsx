"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useState } from "react";

/**
 * A figure that rolls to its value: up from zero when the page arrives, and
 * from the old value to the new one when a filter changes it. Number Flow
 * keeps it still for anyone who asked their system for less motion.
 */
export function RollingNumber({
  value,
  money = false,
  className,
}: {
  value: number;
  /** Rupees, with paise. */
  money?: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    // A frame after mount, so the first paint is 0 and the roll is visible.
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <NumberFlow
      value={shown}
      locales="en-IN"
      format={money ? { style: "currency", currency: "INR", maximumFractionDigits: 2 } : undefined}
      className={className}
    />
  );
}
