import { ViewTransition } from "react";

/**
 * A template remounts on every navigation (a layout does not), so the page
 * inside fades out and the next one rises in while the shell stays still.
 * Classes are in app/globals.css; `default="none"` keeps refreshes and
 * in-page updates from animating.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
