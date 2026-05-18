/**
 * PageTransition
 * 路由切換動畫組件
 *
 * 策略：
 * - 手機版（< md）：使用 iOS 風格的橫向滑入（右→左進入，左→右離開）
 * - 桌面版（>= md）：使用輕量淡入（避免大面積位移造成視覺干擾）
 * - 使用 location 作為 AnimatePresence 的 key，確保每次路由切換都觸發動畫
 * - 動畫時長控制在 220ms 以內，不影響操作流暢度
 * - overflow-hidden 防止動畫過程中出現橫向捲軸
 */
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import type { ReactNode } from "react";

// 手機版：iOS 風格橫向滑入
const mobileVariants = {
  initial: { x: "100%", opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: "-30%", opacity: 0 },
};

// 桌面版：輕量淡入上移
const desktopVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const transition = {
  duration: 0.22,
  ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], // ease-out-quart
};

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();

  // 用 CSS media query 判斷是否為手機版
  // 在 SSR 或初始渲染時預設為桌面版（避免 hydration mismatch）
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;

  const variants = isMobile ? mobileVariants : desktopVariants;

  return (
    <div className="overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          style={{ willChange: "transform, opacity" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
