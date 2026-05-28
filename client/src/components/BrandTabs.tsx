/**
 * BrandTabs – Unified tab bar component for BOXIUM TCG
 *
 * Responsive behaviour:
 *  - xs (<480px): icon + short mobileLabel stacked vertically (grid mode)
 *  - sm+ (≥480px): icon + full label side by side
 *
 * Variants:
 *  - light: gray-50 bg, for white-background pages (Profile, AdminMarketplace)
 *  - dark:  white/5 bg, for dark-background pages (Admin)
 *
 * Active state: #06038d pill + #FEDD00 bottom accent bar
 *
 * Grid mode (grid={true}):
 *  - Equal-width columns, mobile-first
 *  - Set --tab-count CSS var via style on BrandTabsList for correct column count
 */

import { ReactNode, createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";

// ─── Context ─────────────────────────────────────────────────────────────────
interface TabsCtx {
  active: string;
  setActive: (v: string) => void;
  variant: "light" | "dark";
}
const TabsContext = createContext<TabsCtx>({ active: "", setActive: () => {}, variant: "light" });

// ─── Root ─────────────────────────────────────────────────────────────────────
interface BrandTabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: "light" | "dark";
  children: ReactNode;
  className?: string;
}
export function BrandTabs({
  defaultValue,
  value,
  onValueChange,
  variant = "light",
  children,
  className,
}: BrandTabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const active = value ?? internal;
  const setActive = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ active, setActive, variant }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

// ─── Tab List ─────────────────────────────────────────────────────────────────
interface BrandTabsListProps {
  children: ReactNode;
  className?: string;
  /** Allow tabs to wrap onto multiple lines (for many tabs like Admin) */
  wrap?: boolean;
  /** Grid layout: equal-width columns (mobile-first, matches Profile tab style) */
  grid?: boolean;
  /** Number of tabs for grid column calculation */
  tabCount?: number;
}
export function BrandTabsList({ children, className, wrap = false, grid = false, tabCount = 4 }: BrandTabsListProps) {
  const { variant } = useContext(TabsContext);
  return (
    <div
      className={cn(
        "p-1 rounded-xl border",
        grid
          ? "grid"
          : wrap
          ? "flex flex-wrap items-center gap-1"
          : "flex items-center gap-1 flex-nowrap overflow-x-auto",
        variant === "dark"
          ? "bg-white/5 border-white/10"
          : "bg-gray-100 border-gray-200",
        className
      )}
      style={grid ? { gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` } : undefined}
      role="tablist"
    >
      {children}
    </div>
  );
}

// ─── Tab Trigger ──────────────────────────────────────────────────────────────
interface BrandTabsTriggerProps {
  value: string;
  /** Full label text (shown on desktop) */
  children: ReactNode;
  className?: string;
  /** Icon element rendered before/above the label */
  icon?: ReactNode;
  /** Accessible label for screen readers */
  label?: string;
  /** Short label shown below icon on mobile (grid mode) */
  mobileLabel?: string;
}
export function BrandTabsTrigger({ value, children, className, icon, label, mobileLabel }: BrandTabsTriggerProps) {
  const { active, setActive, variant } = useContext(TabsContext);
  const isActive = active === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-label={label}
      onClick={() => setActive(value)}
      className={cn(
        // Mobile: column layout (icon on top, label below); Desktop: row layout
        "relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5",
        "py-2 px-1 sm:px-4",
        "text-xs sm:text-sm font-medium rounded-lg",
        "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "whitespace-nowrap",
        isActive
          ? "text-white shadow-sm"
          : variant === "dark"
          ? "text-gray-400 hover:text-white hover:bg-white/10"
          : "text-gray-500 hover:text-gray-800 hover:bg-white",
        className
      )}
      style={isActive ? { background: BRAND_BLUE } : undefined}
    >
      {/* Icon: always visible */}
      {icon && <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>}

      {/* Mobile: short label below icon; Desktop: full label beside icon */}
      {mobileLabel ? (
        <>
          <span className="sm:hidden text-[10px] leading-none">{mobileLabel}</span>
          <span className="hidden sm:flex leading-none items-center gap-1">{children}</span>
        </>
      ) : (
        <span className="leading-none flex items-center gap-1">{children}</span>
      )}

      {/* Yellow accent bar at bottom of active tab */}
      {isActive && (
        <span
          className="absolute bottom-0.5 left-2 right-2 h-0.5 rounded-full"
          style={{ background: BRAND_YELLOW }}
        />
      )}
    </button>
  );
}

// ─── Tab Content ──────────────────────────────────────────────────────────────
interface BrandTabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}
export function BrandTabsContent({ value, children, className }: BrandTabsContentProps) {
  const { active } = useContext(TabsContext);
  if (active !== value) return null;
  return <div className={cn("mt-4", className)}>{children}</div>;
}
