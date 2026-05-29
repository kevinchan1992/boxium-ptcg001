import React from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

/**
 * PullToRefreshIndicator – shows a pull indicator at the top of the page.
 * Animates from arrow → spinner when threshold is crossed.
 */
export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 70,
}: PullToRefreshIndicatorProps) {
  const { t } = useTranslation();
  const progress = Math.min(pullDistance / threshold, 1);
  const isTriggered = pullDistance >= threshold;
  const isVisible = pullDistance > 4 || isRefreshing;

  if (!isVisible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.min(pullDistance * 0.6, 56)}px)`,
        transition: isRefreshing ? "transform 0.2s ease" : "none",
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-semibold"
        style={{
          backgroundColor: "#06038D",
          color: "#FEDD00",
          opacity: Math.min(progress * 2, 1),
          transform: `scale(${0.7 + progress * 0.3})`,
          transition: isRefreshing ? "all 0.2s ease" : "opacity 0.1s, transform 0.1s",
        }}
      >
        {isRefreshing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t("common.refreshing")}</span>
          </>
        ) : (
          <>
            <ArrowDown
              className="w-4 h-4 transition-transform duration-200"
              style={{
                transform: isTriggered ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
            <span>{isTriggered ? t("common.releaseToRefresh") : t("common.pullToRefresh")}</span>
          </>
        )}
      </div>
    </div>
  );
}
