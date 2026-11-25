"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Opens the print dialog once the page (photos included) has loaded. `ready`
 * holds it back until the page's data has arrived from the API.
 */
export function AutoPrint({ ready = true }: { ready?: boolean }) {
  useEffect(() => {
    if (!ready) return;
    const print = () => window.print();
    // A timer rather than a direct call, so the cleanup can cancel it: React
    // runs effects twice in development, and that would be two dialogs.
    if (document.readyState === "complete") {
      const timer = setTimeout(print, 0);
      return () => clearTimeout(timer);
    }
    window.addEventListener("load", print, { once: true });
    return () => window.removeEventListener("load", print);
  }, [ready]);

  return (
    <div className="flex items-center justify-end gap-2 border-b px-4 py-3 print:hidden">
      <p className="mr-auto text-sm text-neutral-600">
        Choose &ldquo;Save as PDF&rdquo; as the printer to download this.
      </p>
      <Button size="sm" onClick={() => window.print()}>
        Save as PDF
      </Button>
      <Button size="sm" variant="ghost" onClick={() => window.close()}>
        Close
      </Button>
    </div>
  );
}
