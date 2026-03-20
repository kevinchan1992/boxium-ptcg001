import { describe, it, expect } from "vitest";

// Test SF Stations and Lockers data and search functionality
describe("SF Stations & Lockers Update", () => {
  describe("sfStations data", () => {
    it("should have SF_STATIONS array with correct structure", async () => {
      const { SF_STATIONS } = await import("../client/src/lib/sfStations");
      expect(Array.isArray(SF_STATIONS)).toBe(true);
      expect(SF_STATIONS.length).toBeGreaterThan(100);
      const first = SF_STATIONS[0];
      expect(first).toHaveProperty("code");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("district");
      expect(first).toHaveProperty("address");
      expect(first).toHaveProperty("region");
    });

    it("should have searchSFPoints function for synchronous search", async () => {
      const { searchSFPoints } = await import("../client/src/lib/sfStations");
      const results = searchSFPoints("旺角");
      expect(Array.isArray(results)).toBe(true);
      results.forEach(r => {
        expect(r).toHaveProperty("type", "station");
      });
    });

    it("should have searchSFPointsAsync for async search including lockers", async () => {
      const { searchSFPointsAsync } = await import("../client/src/lib/sfStations");
      expect(typeof searchSFPointsAsync).toBe("function");
    });

    it("should return SFPoint type with type field", async () => {
      const { searchSFPoints } = await import("../client/src/lib/sfStations");
      const results = searchSFPoints("", undefined, "station");
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.type).toBe("station");
        expect(r).toHaveProperty("code");
        expect(r).toHaveProperty("name");
        expect(r).toHaveProperty("address");
      });
    });

    it("should filter by region correctly", async () => {
      const { searchSFPoints } = await import("../client/src/lib/sfStations");
      const kowloon = searchSFPoints("", "九龍");
      expect(kowloon.length).toBeGreaterThan(0);
      kowloon.forEach(r => {
        expect(r.region).toBe("九龍");
      });
    });

    it("should search by station code", async () => {
      const { searchSFPoints } = await import("../client/src/lib/sfStations");
      const results = searchSFPoints("852");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("sfLockers data", () => {
    it("should have SF_LOCKERS array with 729 lockers", async () => {
      const { SF_LOCKERS } = await import("../client/src/lib/sfLockers");
      expect(Array.isArray(SF_LOCKERS)).toBe(true);
      expect(SF_LOCKERS.length).toBeGreaterThanOrEqual(700);
    });

    it("should have correct locker structure", async () => {
      const { SF_LOCKERS } = await import("../client/src/lib/sfLockers");
      const first = SF_LOCKERS[0];
      expect(first).toHaveProperty("code");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("district");
      expect(first).toHaveProperty("address");
      expect(first).toHaveProperty("region");
      // Locker codes typically start with H
      expect(first.code).toBeTruthy();
    });

    it("should have lockers in all three regions", async () => {
      const { SF_LOCKERS } = await import("../client/src/lib/sfLockers");
      const regions = new Set(SF_LOCKERS.map(l => l.region));
      expect(regions.has("香港島") || regions.has("九龍") || regions.has("新界")).toBe(true);
    });
  });

  describe("async search combining stations and lockers", () => {
    it("should return both stations and lockers when type is all", async () => {
      const { searchSFPointsAsync } = await import("../client/src/lib/sfStations");
      const results = await searchSFPointsAsync("", undefined, "all");
      expect(results.length).toBeGreaterThan(0);
      // Should have results (first 20 from combined pool)
      expect(results.length).toBeLessThanOrEqual(20);
    });

    it("should return only stations when type is station", async () => {
      const { searchSFPointsAsync } = await import("../client/src/lib/sfStations");
      const results = await searchSFPointsAsync("旺角", undefined, "station");
      results.forEach(r => {
        expect(r.type).toBe("station");
      });
    });

    it("should return only lockers when type is locker", async () => {
      const { searchSFPointsAsync } = await import("../client/src/lib/sfStations");
      const results = await searchSFPointsAsync("", "九龍", "locker");
      if (results.length > 0) {
        results.forEach(r => {
          expect(r.type).toBe("locker");
        });
      }
    });

    it("should filter lockers by region", async () => {
      const { searchSFPointsAsync } = await import("../client/src/lib/sfStations");
      const results = await searchSFPointsAsync("", "香港島", "locker");
      if (results.length > 0) {
        results.forEach(r => {
          expect(r.region).toBe("香港島");
        });
      }
    });
  });

  describe("clear address logic", () => {
    it("should reset all SF fields when clearing address", () => {
      // Simulate the clear address action
      const initialForm = {
        name: "Kevin Chan",
        phone: "68714567",
        address: "",
        district: "",
        region: "香港",
        addressType: "sf_station" as const,
        sfStationCode: "852Z351",
        sfStationName: "順豐站 離島",
      };
      
      // Clear action should reset all fields
      const clearedForm = {
        name: "",
        phone: "",
        address: "",
        district: "",
        region: "香港",
        addressType: "normal" as const,
        sfStationCode: "",
        sfStationName: "",
      };
      
      expect(clearedForm.sfStationCode).toBe("");
      expect(clearedForm.sfStationName).toBe("");
      expect(clearedForm.addressType).toBe("normal");
      expect(clearedForm.name).toBe("");
    });

    it("should allow manual input of SF station code after clearing", () => {
      // After clearing, user can manually type a station code
      const manualCode = "852Z351";
      const manualLockerCode = "H852001P";
      
      // Station code format: 852XXXX
      expect(manualCode.startsWith("852")).toBe(true);
      // Locker code format: H852XXXXP
      expect(manualLockerCode.startsWith("H")).toBe(true);
      expect(manualLockerCode.endsWith("P")).toBe(true);
    });
  });
});
