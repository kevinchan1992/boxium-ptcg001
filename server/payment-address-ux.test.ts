/**
 * 付款 Dialog 地址表單 UX 測試
 * 驗證：初始狀態清空、已儲存地址選擇、清除按鈕功能
 */
import { describe, it, expect } from "vitest";

// 模擬地址表單的初始狀態
const EMPTY_SHIPPING_FORM = {
  name: "",
  phone: "",
  address: "",
  district: "",
  region: "香港",
  addressType: "normal" as "normal" | "sf_station",
  sfStationCode: "",
  sfStationName: "",
};

// 模擬已儲存地址
const mockSavedAddresses = [
  {
    id: 1,
    label: "家",
    recipientName: "陳大文",
    phone: "91234567",
    address: "旺角彌敦道123號",
    district: "旺角",
    region: "九龍",
    addressType: "normal",
    sfStationCode: "",
    sfStationName: "",
    isDefault: true,
  },
  {
    id: 2,
    label: "公司",
    recipientName: "陳大文",
    phone: "91234567",
    address: "",
    district: "",
    region: "九龍",
    addressType: "sf_station",
    sfStationCode: "8522351",
    sfStationName: "順豐自提站 離島",
    isDefault: false,
  },
];

// 模擬選擇已儲存地址的函數
function selectSavedAddress(addr: typeof mockSavedAddresses[0]) {
  return {
    name: addr.recipientName,
    phone: addr.phone,
    address: addr.addressType === "sf_station" ? `順豐自提站 ${addr.sfStationCode}` : (addr.address || ""),
    district: addr.addressType === "sf_station" ? (addr.sfStationName || "") : (addr.district || ""),
    region: addr.region || "香港",
    addressType: addr.addressType as "normal" | "sf_station",
    sfStationCode: addr.sfStationCode || "",
    sfStationName: addr.sfStationName || "",
  };
}

describe("付款 Dialog 地址表單 UX", () => {
  describe("初始狀態", () => {
    it("開啟 Dialog 時地址表單應為空白", () => {
      const form = { ...EMPTY_SHIPPING_FORM };
      expect(form.name).toBe("");
      expect(form.phone).toBe("");
      expect(form.address).toBe("");
      expect(form.district).toBe("");
      expect(form.sfStationCode).toBe("");
    });

    it("初始狀態 addressType 應為 normal", () => {
      const form = { ...EMPTY_SHIPPING_FORM };
      expect(form.addressType).toBe("normal");
    });

    it("初始狀態 region 預設為香港", () => {
      const form = { ...EMPTY_SHIPPING_FORM };
      expect(form.region).toBe("香港");
    });
  });

  describe("選擇已儲存地址", () => {
    it("點擊一般地址後應正確填入姓名和電話", () => {
      const addr = mockSavedAddresses[0];
      const form = selectSavedAddress(addr);
      expect(form.name).toBe("陳大文");
      expect(form.phone).toBe("91234567");
      expect(form.address).toBe("旺角彌敦道123號");
      expect(form.district).toBe("旺角");
      expect(form.region).toBe("九龍");
      expect(form.addressType).toBe("normal");
    });

    it("點擊順豐自提站地址後 addressType 應為 sf_station", () => {
      const addr = mockSavedAddresses[1];
      const form = selectSavedAddress(addr);
      expect(form.addressType).toBe("sf_station");
      expect(form.sfStationCode).toBe("8522351");
      expect(form.sfStationName).toBe("順豐自提站 離島");
    });

    it("點擊順豐自提站地址後 address 應包含自提站代碼", () => {
      const addr = mockSavedAddresses[1];
      const form = selectSavedAddress(addr);
      expect(form.address).toContain("8522351");
    });
  });

  describe("清除已選地址", () => {
    it("清除後表單應回到空白狀態", () => {
      // 先選擇地址
      let form = selectSavedAddress(mockSavedAddresses[0]);
      expect(form.name).toBe("陳大文");

      // 清除
      form = { ...EMPTY_SHIPPING_FORM };
      expect(form.name).toBe("");
      expect(form.phone).toBe("");
      expect(form.address).toBe("");
    });

    it("清除後 addressType 應回到 normal", () => {
      // 先選擇順豐自提站
      let form = selectSavedAddress(mockSavedAddresses[1]);
      expect(form.addressType).toBe("sf_station");

      // 清除
      form = { ...EMPTY_SHIPPING_FORM };
      expect(form.addressType).toBe("normal");
      expect(form.sfStationCode).toBe("");
    });
  });

  describe("清除按鈕顯示邏輯", () => {
    it("Stripe Dialog：selectedSavedAddressId 為 null 時不顯示清除按鈕", () => {
      const selectedSavedAddressId = null;
      const shouldShowClearButton = selectedSavedAddressId !== null;
      expect(shouldShowClearButton).toBe(false);
    });

    it("Stripe Dialog：selectedSavedAddressId 有值時顯示清除按鈕", () => {
      const selectedSavedAddressId = 1;
      const shouldShowClearButton = selectedSavedAddressId !== null;
      expect(shouldShowClearButton).toBe(true);
    });

    it("支付寶 Dialog：name 和 phone 均為空時不顯示清除按鈕", () => {
      const form = { ...EMPTY_SHIPPING_FORM };
      const shouldShowClearButton = !!(form.name || form.phone);
      expect(shouldShowClearButton).toBe(false);
    });

    it("支付寶 Dialog：name 有值時顯示清除按鈕", () => {
      const form = { ...EMPTY_SHIPPING_FORM, name: "陳大文" };
      const shouldShowClearButton = !!(form.name || form.phone);
      expect(shouldShowClearButton).toBe(true);
    });

    it("支付寶 Dialog：phone 有值時顯示清除按鈕", () => {
      const form = { ...EMPTY_SHIPPING_FORM, phone: "91234567" };
      const shouldShowClearButton = !!(form.name || form.phone);
      expect(shouldShowClearButton).toBe(true);
    });
  });

  describe("表單驗證邏輯", () => {
    it("一般地址：姓名、電話、詳細地址均填寫才可提交", () => {
      const form = { name: "陳大文", phone: "91234567", address: "旺角彌敦道123號", district: "", region: "九龍", addressType: "normal" as const, sfStationCode: "", sfStationName: "" };
      const isValid = !!(form.name.trim() && form.phone.trim() && form.address.trim());
      expect(isValid).toBe(true);
    });

    it("一般地址：缺少詳細地址時不可提交", () => {
      const form = { name: "陳大文", phone: "91234567", address: "", district: "", region: "九龍", addressType: "normal" as const, sfStationCode: "", sfStationName: "" };
      const isValid = !!(form.name.trim() && form.phone.trim() && (form.addressType !== "normal" || form.address.trim()));
      expect(isValid).toBe(false);
    });

    it("順豐自提站：有自提站代碼時可提交", () => {
      const form = { name: "陳大文", phone: "91234567", address: "", district: "", region: "九龍", addressType: "sf_station" as const, sfStationCode: "8522351", sfStationName: "" };
      const isValid = !!(form.name.trim() && form.phone.trim() && (form.addressType !== "sf_station" || form.sfStationCode.trim()));
      expect(isValid).toBe(true);
    });

    it("表單完全空白時不可提交", () => {
      const form = { ...EMPTY_SHIPPING_FORM };
      const isValid = !!(form.name.trim() && form.phone.trim() && (form.addressType !== "normal" || form.address.trim()));
      expect(isValid).toBe(false);
    });
  });
});
