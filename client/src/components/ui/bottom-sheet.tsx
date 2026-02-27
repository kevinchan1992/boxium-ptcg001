/**
 * BottomSheet component
 * - Mobile: slides up from the bottom (native sheet UX)
 * - Desktop (sm+): renders as a centered Dialog
 *
 * Usage:
 *   <BottomSheet open={open} onOpenChange={setOpen} title="Title">
 *     {children}
 *   </BottomSheet>
 */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes applied to the content panel */
  className?: string;
  /** Whether to show the close button (default: true) */
  showCloseButton?: boolean;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showCloseButton = true,
}: BottomSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-300"
          )}
        />

        {/* Content panel */}
        <DialogPrimitive.Content
          style={{ transform: "none" }} // override any Radix transform that may shift the panel
          className={cn(
            // ── Mobile: bottom sheet (full width, anchored to bottom) ──
            "fixed bottom-0 left-0 z-50",
            "w-screen max-w-full", // force full viewport width, never exceed it
            "overflow-hidden",     // clip any child overflow at the panel boundary
            "bg-background border-t border-border",
            "rounded-t-2xl shadow-2xl",
            "max-h-[90dvh] flex flex-col",
            // Slide-up animation
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "duration-300 ease-out",
            // ── Desktop (sm+): centered dialog ──
            "sm:bottom-auto sm:left-1/2 sm:top-1/2",
            "sm:w-full sm:max-w-lg",
            "sm:rounded-xl sm:border",
            "sm:[transform:translate(-50%,-50%)]", // explicit translate for desktop only
            "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
            "sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0",
            className
          )}
        >
          {/* Drag handle (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-border/50 min-w-0">
              <div className="flex-1 min-w-0 overflow-hidden">
                {title && (
                  <DialogPrimitive.Title className="text-base font-semibold text-foreground leading-tight truncate">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="text-sm text-muted-foreground mt-0.5 truncate">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              {showCloseButton && (
                <DialogPrimitive.Close className="ml-2 flex-shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <XIcon className="w-5 h-5" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
            </div>
          )}

          {/* Scrollable body — overflow-x-hidden prevents horizontal bleed */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 min-w-0">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
