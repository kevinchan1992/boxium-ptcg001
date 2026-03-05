/**
 * BrandTabs – Unified tab bar component for BOXIUM PTCG
 *
 * Design:
 *  - Light variant (default): white/light-gray background, deep-blue active pill
 *  - Dark variant: dark background, for Admin pages on dark bg
 *  - Active tab: #06038d background, white text, #FFD700 bottom accent bar
 *  - Inactive tab: transparent bg, muted text, hover lightens bg
 *  - Smooth transition on all states
 */

import { ReactNode, createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FFD700";

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
  /** Wrap tabs into multiple rows when there are many tabs */
  wrap?: boolean;
}
export function BrandTabsList({ children, className, wrap = false }: BrandTabsListProps) {
  const { variant } = useContext(TabsContext);
  return (
    <div
      className={cn(
        "flex items-stretch overflow-x-auto rounded-xl border",
        wrap ? "flex-wrap gap-1 p-1" : "flex-nowrap",
        variant === "dark"
          ? "bg-white/5 border-white/10"
          : "bg-gray-50 border-gray-200",
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

// ─── Tab Trigger ──────────────────────────────────────────────────────────────
interface BrandTabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}
export function BrandTabsTrigger({ value, children, className, icon }: BrandTabsTriggerProps) {
  const { active, setActive, variant } = useContext(TabsContext);
  const isActive = active === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className={cn(
        "relative flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium",
        "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "whitespace-nowrap flex-shrink-0",
        // Rounded only when wrapping (pill style)
        "rounded-lg",
        isActive
          ? "text-white shadow-sm"
          : variant === "dark"
          ? "text-gray-400 hover:text-white hover:bg-white/10"
          : "text-gray-500 hover:text-gray-800 hover:bg-white",
        className
      )}
      style={
        isActive
          ? { background: BRAND_BLUE }
          : undefined
      }
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {/* Yellow accent bar at bottom */}
      {isActive && (
        <span
          className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
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
