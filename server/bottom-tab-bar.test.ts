import { describe, it, expect } from "vitest";

// Unit tests for BottomTabBar logic (isTabActive function)
// We test the logic directly without rendering the component

function isTabActive(
  tab: { path: string; matchPaths?: string[] },
  location: string
): boolean {
  if (tab.path === "/" && location === "/") return true;
  if (tab.path === "/" && location !== "/") return false;
  return (tab.matchPaths ?? [tab.path]).some((p) =>
    p.endsWith("/")
      ? location.startsWith(p)
      : location === p ||
        location.startsWith(p + "/") ||
        location.startsWith(p + "?")
  );
}

const TABS = [
  { path: "/", matchPaths: ["/"] },
  { path: "/research", matchPaths: ["/research", "/search", "/card/", "/pricing"] },
  { path: "/marketplace", matchPaths: ["/marketplace", "/auction", "/cart", "/seller"] },
  { path: "/grading", matchPaths: ["/grading"] },
  { path: "/profile", matchPaths: ["/profile", "/orders", "/notifications", "/wishlist"] },
];

describe("BottomTabBar - isTabActive", () => {
  it("home tab is active only at /", () => {
    expect(isTabActive(TABS[0], "/")).toBe(true);
    expect(isTabActive(TABS[0], "/research")).toBe(false);
    expect(isTabActive(TABS[0], "/marketplace")).toBe(false);
  });

  it("research tab is active on /research and /pricing", () => {
    expect(isTabActive(TABS[1], "/research")).toBe(true);
    expect(isTabActive(TABS[1], "/pricing")).toBe(true);
    expect(isTabActive(TABS[1], "/research?q=pikachu")).toBe(true);
    expect(isTabActive(TABS[1], "/card/123")).toBe(true);
    expect(isTabActive(TABS[1], "/marketplace")).toBe(false);
  });

  it("marketplace tab is active on /marketplace, /auction, /cart, /seller", () => {
    expect(isTabActive(TABS[2], "/marketplace")).toBe(true);
    expect(isTabActive(TABS[2], "/marketplace/510001")).toBe(true);
    expect(isTabActive(TABS[2], "/auction/123")).toBe(true);
    expect(isTabActive(TABS[2], "/cart")).toBe(true);
    expect(isTabActive(TABS[2], "/seller/dashboard")).toBe(true);
    expect(isTabActive(TABS[2], "/profile")).toBe(false);
  });

  it("grading tab is active on /grading", () => {
    expect(isTabActive(TABS[3], "/grading")).toBe(true);
    expect(isTabActive(TABS[3], "/grading/submit")).toBe(true);
    expect(isTabActive(TABS[3], "/marketplace")).toBe(false);
  });

  it("profile tab is active on /profile, /orders, /notifications, /wishlist", () => {
    expect(isTabActive(TABS[4], "/profile")).toBe(true);
    expect(isTabActive(TABS[4], "/orders")).toBe(true);
    expect(isTabActive(TABS[4], "/orders/123")).toBe(true);
    expect(isTabActive(TABS[4], "/notifications")).toBe(true);
    expect(isTabActive(TABS[4], "/wishlist")).toBe(true);
    expect(isTabActive(TABS[4], "/marketplace")).toBe(false);
  });

  it("only one tab is active at a time for common routes", () => {
    const routes = ["/", "/research", "/marketplace", "/grading", "/profile"];
    for (const route of routes) {
      const activeTabs = TABS.filter((tab) => isTabActive(tab, route));
      expect(activeTabs.length).toBe(1);
    }
  });
});
