/**
 * BottomSheet component
 * - Mobile: slides up from the bottom (native sheet UX) with swipe-to-dismiss gesture
 * - Desktop (sm+): renders as a centered Dialog
 *
 * Swipe-to-dismiss:
 *   - Drag the sheet downward ≥ 80px OR with velocity ≥ 0.5px/ms → closes the sheet
 *   - Visual rubber-band feedback during drag
 *   - Tap the overlay to close (Radix default)
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

/** Minimum downward drag distance (px) to trigger dismiss */
const DISMISS_THRESHOLD = 80;
/** Minimum drag velocity (px/ms) to trigger dismiss regardless of distance */
const DISMISS_VELOCITY = 0.5;

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showCloseButton = true,
}: BottomSheetProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  // ── Swipe-to-dismiss state ──────────────────────────────────────────────
  const dragState = React.useRef<{
    startY: number;
    startTime: number;
    currentY: number;
    isDragging: boolean;
  } | null>(null);

  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  // Reset drag state when sheet opens/closes
  React.useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setIsDragging(false);
      dragState.current = null;
    }
  }, [open]);

  // ── Pointer / Touch handlers ────────────────────────────────────────────
  const handleDragStart = React.useCallback(
    (clientY: number) => {
      dragState.current = {
        startY: clientY,
        startTime: performance.now(),
        currentY: clientY,
        isDragging: true,
      };
      setIsDragging(true);
    },
    []
  );

  const handleDragMove = React.useCallback(
    (clientY: number) => {
      if (!dragState.current?.isDragging) return;
      dragState.current.currentY = clientY;
      const delta = clientY - dragState.current.startY;
      // Only allow downward drag (positive delta); clamp upward to 0
      setDragOffset(Math.max(0, delta));
    },
    []
  );

  const handleDragEnd = React.useCallback(() => {
    if (!dragState.current?.isDragging) return;

    const delta = dragState.current.currentY - dragState.current.startY;
    const elapsed = performance.now() - dragState.current.startTime;
    const velocity = elapsed > 0 ? delta / elapsed : 0;

    dragState.current.isDragging = false;
    setIsDragging(false);

    if (delta >= DISMISS_THRESHOLD || velocity >= DISMISS_VELOCITY) {
      // Animate out then close
      setDragOffset(window.innerHeight);
      setTimeout(() => {
        setDragOffset(0);
        onOpenChange(false);
      }, 200);
    } else {
      // Snap back
      setDragOffset(0);
    }
  }, [onOpenChange]);

  // ── Touch events ────────────────────────────────────────────────────────
  const onTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      // Only start drag from the handle or header area
      handleDragStart(e.touches[0].clientY);
    },
    [handleDragStart]
  );

  const onTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (!dragState.current?.isDragging) return;
      handleDragMove(e.touches[0].clientY);
      // Prevent page scroll while dragging the sheet
      if (dragOffset > 0) {
        e.preventDefault();
      }
    },
    [handleDragMove, dragOffset]
  );

  const onTouchEnd = React.useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // ── Mouse events (for desktop testing) ─────────────────────────────────
  const onMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      handleDragStart(e.clientY);
    },
    [handleDragStart]
  );

  React.useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const onMouseUp = () => handleDragEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ── Derived styles ──────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties =
    dragOffset > 0
      ? {
          transform: `translateY(${dragOffset}px)`,
          transition: "none", // no transition while dragging
        }
      : {
          transform: "none",
        };

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
          style={dragOffset > 0 ? { opacity: Math.max(0, 1 - dragOffset / 300) } : undefined}
        />

        {/* Content panel */}
        <DialogPrimitive.Content
          ref={panelRef}
          style={panelStyle}
          className={cn(
            // ── Mobile: bottom sheet (full width, anchored to bottom) ──
            "fixed bottom-0 left-0 z-50",
            "w-screen max-w-full",
            "overflow-hidden",
            "bg-background border-t border-border",
            "rounded-t-2xl shadow-2xl",
            "max-h-[90dvh] flex flex-col",
            // Slide-up animation (only when not dragging)
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            isDragging ? "duration-0" : "duration-300 ease-out",
            // ── Desktop (md+): centered dialog ──
            "md:bottom-auto md:left-1/2 md:top-1/2",
            "md:w-full md:max-w-lg",
            "md:rounded-xl md:border",
            "md:[transform:translate(-50%,-50%)]",
            "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
            "md:data-[state=closed]:fade-out-0 md:data-[state=open]:fade-in-0",
            className
          )}
        >
          {/* ── Drag handle (mobile only) — touch/mouse target for swipe ── */}
          <div
            className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            aria-hidden="true"
          >
            <div
              className={cn(
                "w-10 h-1 rounded-full transition-colors duration-150",
                isDragging ? "bg-muted-foreground/60" : "bg-muted-foreground/30"
              )}
            />
          </div>

          {/* Header — also draggable on mobile */}
          {(title || showCloseButton) && (
            <div
              className={cn(
                "flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-border/50 min-w-0",
                "md:cursor-default cursor-grab active:cursor-grabbing touch-none select-none md:select-auto md:touch-auto"
              )}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onMouseDown={onMouseDown}
            >
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
                <DialogPrimitive.Close
                  className="ml-2 flex-shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onMouseDown={(e) => e.stopPropagation()} // prevent drag from close button
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <XIcon className="w-5 h-5" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
            </div>
          )}

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 min-w-0">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
