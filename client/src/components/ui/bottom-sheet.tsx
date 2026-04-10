/**
 * BottomSheet component
 * - Mobile & Tablet (< 1024px / lg): slides up from the bottom (native sheet UX) with swipe-to-dismiss gesture
 * - Desktop (lg+, ≥ 1024px): renders as a centered Dialog
 *
 * Breakpoint rationale:
 *   - iPhone: ~375-430px viewport → bottom sheet
 *   - iPad (portrait): ~768px viewport → bottom sheet
 *   - iPad (landscape): ~1024px viewport → bottom sheet
 *   - Desktop: ≥ 1024px → centered dialog
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

/** Hook to detect if we're in desktop mode (≥ 1024px) */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024
  );

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    setIsDesktop(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isDesktop;
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
  const panelRef = React.useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

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
      if (isDesktop) return; // no drag on desktop
      dragState.current = {
        startY: clientY,
        startTime: performance.now(),
        currentY: clientY,
        isDragging: true,
      };
      setIsDragging(true);
    },
    [isDesktop]
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
  // Only apply drag transform on mobile/tablet (not desktop)
  const panelStyle: React.CSSProperties = React.useMemo(() => {
    if (isDesktop) {
      // Desktop: use CSS for centering (no JS transform override)
      return {};
    }
    if (dragOffset > 0) {
      return {
        transform: `translateY(${dragOffset}px)`,
        transition: "none",
      };
    }
    return {};
  }, [isDesktop, dragOffset]);

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
          style={
            !isDesktop && dragOffset > 0
              ? { opacity: Math.max(0, 1 - dragOffset / 300) }
              : undefined
          }
        />

        {/* Content panel */}
        <DialogPrimitive.Content
          ref={panelRef}
          style={panelStyle}
          className={cn(
            // ── Mobile & Tablet (< lg): bottom sheet — full width, anchored to bottom ──
            "fixed bottom-0 left-0 right-0 z-50",
            "w-full",
            "overflow-hidden",
            "bg-background border-t border-border",
            "rounded-t-2xl shadow-2xl",
            "max-h-[90dvh] flex flex-col",
            // Slide-up animation
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            isDragging ? "duration-0" : "duration-300 ease-out",
            // ── Desktop (lg+, ≥ 1024px): centered dialog ──
            "lg:bottom-auto lg:left-1/2 lg:right-auto lg:top-1/2",
            "lg:w-full lg:max-w-lg",
            "lg:rounded-xl lg:border lg:border-border",
            "lg:-translate-x-1/2 lg:-translate-y-1/2",
            "lg:data-[state=closed]:zoom-out-95 lg:data-[state=open]:zoom-in-95",
            "lg:data-[state=closed]:fade-out-0 lg:data-[state=open]:fade-in-0",
            "lg:data-[state=closed]:slide-out-to-bottom-0 lg:data-[state=open]:slide-in-from-bottom-0",
            className
          )}
        >
          {/* ── Drag handle (mobile/tablet only) — touch/mouse target for swipe ── */}
          <div
            className="flex justify-center pt-3 pb-1 lg:hidden flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
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

          {/* Header — also draggable on mobile/tablet */}
          {(title || showCloseButton) && (
            <div
              className={cn(
                "flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-border/50 min-w-0",
                "lg:cursor-default cursor-grab active:cursor-grabbing touch-none select-none lg:select-auto lg:touch-auto"
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
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <XIcon className="w-5 h-5" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
            </div>
          )}

          {/* Scrollable body */}
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 min-w-0 lg:pb-4"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))', overscrollBehavior: 'contain' }}
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
