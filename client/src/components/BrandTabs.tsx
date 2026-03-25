/**
 * BrandTabs – Unified tab bar component for BOXIUM PTCG
 *
 * Responsive behaviour:
 *  - xs (<480px): icon only, tooltip via aria-label
 *  - sm+ (≥480px): icon + full label
 *
 * Variants:
 *  - light: gray-50 bg, for white-background pages (Profile, AdminMarketplace)
 *  - dark:  white/5 bg, for dark-background pages (Admin)
 *
 * Active state: #06038d pill + #FEDD00 bottom accent bar
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
}
export function BrandTabsList({ children, className, wrap = false }: BrandTabsListProps) {
  const { variant } = useContext(TabsContext);
  return (
    <div
      className={cn(
        // Horizontal scroll on very small screens, wrap on larger when requested
        "flex items-center gap-1 p-1 rounded-xl border",
        wrap
          ? "flex-wrap"
          : "flex-nowrap overflow-x-auto",
        variant === "dark"
          ? "bg-white/5 border-white/10"
          : "bg-gray-100 border-gray-200",
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
  /** Label text shown beside the icon */
  children: ReactNode;
  className?: string;
  /** Icon element rendered before the label */
  icon?: ReactNode;
  /** Accessible label for icon-only display on very small screens */
  label?: string;
}
export function BrandTabsTrigger({ value, children, className, icon, label }: BrandTabsTriggerProps) {
  const { active, setActive, variant } = useContext(TabsContext);
  const isActive = active === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-label={label}
      onClick={() => setActive(value)}
      className={cn(
        // Layout: icon + text always visible; on very small screens text hidden
        "relative flex items-center justify-center gap-1.5",
        // Padding: tighter on mobile, comfortable on desktop
        "px-2.5 py-2 xs:px-3.5 xs:py-2.5 sm:px-4",
        "text-sm font-medium rounded-lg",
        "transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "whitespace-nowrap flex-shrink-0",
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

      {/* Label: always visible, children control responsive text via sm:hidden/hidden sm:inline */}
      <span className="leading-none flex items-center gap-1">{children}</span>

      {/* Yellow accent bar at bottom of active tab */}
      {isActive && (
        <span
          className="absolute bottom-0.5 left-3 right-3 h-0.5 rounded-full"
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
