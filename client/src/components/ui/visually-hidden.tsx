import * as React from "react";

/**
 * VisuallyHidden - renders content that is visually hidden but accessible to screen readers.
 * Use this to wrap DialogTitle when you have a custom visual header inside DialogContent.
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}
