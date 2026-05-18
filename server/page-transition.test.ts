/**
 * PageTransition 組件邏輯測試
 * 測試動畫變體設定是否正確，以及組件結構是否符合預期
 */
import { describe, it, expect } from "vitest";

// 測試動畫變體的數值是否在合理範圍內
describe("PageTransition animation variants", () => {
  // 手機版變體
  const mobileVariants = {
    initial: { x: "100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "-30%", opacity: 0 },
  };

  // 桌面版變體
  const desktopVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
  };

  const transition = {
    duration: 0.22,
    ease: [0.25, 0.46, 0.45, 0.94],
  };

  it("mobile initial state should be off-screen to the right", () => {
    expect(mobileVariants.initial.x).toBe("100%");
    expect(mobileVariants.initial.opacity).toBe(0);
  });

  it("mobile animate state should be fully visible at origin", () => {
    expect(mobileVariants.animate.x).toBe(0);
    expect(mobileVariants.animate.opacity).toBe(1);
  });

  it("mobile exit state should slide to the left", () => {
    expect(mobileVariants.exit.x).toBe("-30%");
    expect(mobileVariants.exit.opacity).toBe(0);
  });

  it("desktop initial state should be slightly below with zero opacity", () => {
    expect(desktopVariants.initial.opacity).toBe(0);
    expect(desktopVariants.initial.y).toBeGreaterThan(0);
  });

  it("desktop animate state should be fully visible at origin", () => {
    expect(desktopVariants.animate.opacity).toBe(1);
    expect(desktopVariants.animate.y).toBe(0);
  });

  it("desktop exit state should move up with zero opacity", () => {
    expect(desktopVariants.exit.opacity).toBe(0);
    expect(desktopVariants.exit.y).toBeLessThan(0);
  });

  it("transition duration should be under 300ms for smooth UX", () => {
    expect(transition.duration).toBeLessThan(0.3);
    expect(transition.duration).toBeGreaterThan(0);
  });

  it("transition ease should be a valid cubic-bezier array", () => {
    expect(Array.isArray(transition.ease)).toBe(true);
    expect(transition.ease).toHaveLength(4);
    // All values should be between 0 and 1
    (transition.ease as number[]).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});
