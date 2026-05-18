import { useEffect, useRef, useState, useCallback } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;    // px to trigger refresh (default: 70)
  maxPull?: number;      // max px to pull (default: 120)
  disabled?: boolean;    // disable on desktop
}

interface UsePullToRefreshResult {
  pullDistance: number;  // 0..maxPull
  isRefreshing: boolean;
  isPulling: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * usePullToRefresh – attaches touch listeners to a container ref.
 * Only activates when the container is scrolled to the very top.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  maxPull = 120,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(threshold); // hold at threshold while refreshing
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
      setIsPulling(false);
    }
  }, [onRefresh, threshold]);

  useEffect(() => {
    if (disabled) return;
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      // Only activate when scrolled to top
      const scrollTop = el.scrollTop ?? window.scrollY;
      if (scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      isActiveRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      if (isRefreshing) return;

      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        startYRef.current = null;
        return;
      }

      // Check scroll position again (user might have scrolled before we caught it)
      const scrollTop = el.scrollTop ?? window.scrollY;
      if (scrollTop > 2) {
        startYRef.current = null;
        return;
      }

      isActiveRef.current = true;
      setIsPulling(true);

      // Apply rubber-band damping: distance = maxPull * (1 - e^(-dy/maxPull))
      const damped = maxPull * (1 - Math.exp(-dy / maxPull));
      setPullDistance(Math.min(damped, maxPull));

      // Prevent default scroll only when actively pulling
      if (dy > 5) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!isActiveRef.current) return;
      isActiveRef.current = false;
      startYRef.current = null;

      if (pullDistance >= threshold) {
        triggerRefresh();
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [disabled, isRefreshing, maxPull, pullDistance, threshold, triggerRefresh]);

  return { pullDistance, isRefreshing, isPulling, containerRef };
}
